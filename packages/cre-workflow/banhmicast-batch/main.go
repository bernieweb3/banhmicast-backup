//go:build wasip1

// BanhMiCast — Chainlink CRE Workflow: Batch LMSR Processor
//
// Runs inside the Chainlink DON WASM sandbox on each batch epoch.
//
// Pipeline:
//  1. TRIGGER: Cron (every 2 minutes by default)
//  2. INPUT:   Encrypted bets from batch commitments (on-chain event log)
//  3. COMPUTE: LMSR batch pricing (privacy-preserving in WASM sandbox)
//  4. OUTPUT:  ExecutionResult JSON (signed by DON, ready for Sepolia submission)
//
// Usage:
//
//	cre workflow simulate banhmicast-batch --target testnet-settings
package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math/big"
	"sort"
	"time"

	"github.com/smartcontractkit/cre-sdk-go/capabilities/scheduler/cron"
	"github.com/smartcontractkit/cre-sdk-go/cre"
	"github.com/smartcontractkit/cre-sdk-go/cre/wasm"
)

// ============================================================================
// Config — injected from config.testnet.json via workflow.yaml
// ============================================================================

type Config struct {
	Schedule              string            `json:"schedule"`
	MarketID              string            `json:"marketId"`
	LiquidityB            string            `json:"liquidityB"`
	BatchCommitments      []BatchCommitment `json:"batchCommitments"`
	SimulatedSharesSupply []string          `json:"simulatedSharesSupply"`
}

// BatchCommitment is a single encrypted bet from the on-chain event log.
type BatchCommitment struct {
	User           string `json:"user"`
	EncryptedData  string `json:"encryptedData"`
	CommitmentHash string `json:"commitmentHash"`
}

// ============================================================================
// Output Types
// ============================================================================

type DecryptedOrder struct {
	User           string
	OutcomeIndex   int
	InvestmentMist *big.Int
	CommitmentHash string
}

type UserAllocation struct {
	User         string `json:"user"`
	SharesMinted string `json:"sharesMinted"`
	OutcomeIndex int    `json:"outcomeIndex"`
}

// ExecutionResult is the final CRE output — signed by DON, submitted to Sepolia.
type ExecutionResult struct {
	MarketID        string           `json:"marketId"`
	BatchID         int              `json:"batchId"`
	NewSharesSupply []string         `json:"newSharesSupply"`
	PriceUpdates    []string         `json:"priceUpdates"`
	Allocations     []UserAllocation `json:"allocations"`
	ComputedAt      int64            `json:"computedAt"`
}

// ============================================================================
// CRE Workflow Entry Point
// ============================================================================

func main() {
	wasm.NewRunner(cre.ParseJSON[Config]).Run(InitWorkflow)
}

// InitWorkflow registers the cron-triggered BanhMiCast batch handler.
func InitWorkflow(config *Config, logger *slog.Logger, _ cre.SecretsProvider) (cre.Workflow[*Config], error) {
	schedule := config.Schedule
	if schedule == "" {
		schedule = "*/2 * * * *"
	}
	return cre.Workflow[*Config]{
		cre.Handler(
			cron.Trigger(&cron.Config{Schedule: schedule}),
			banhmicastBatchHandler,
		),
	}, nil
}

// banhmicastBatchHandler is the main workflow handler — runs inside the DON WASM sandbox.
func banhmicastBatchHandler(cfg *Config, rt cre.Runtime, _ *cron.Payload) (*ExecutionResult, error) {
	logger := rt.Logger()
	logger.Info("🥖 BanhMiCast batch epoch started", slog.String("marketId", cfg.MarketID))

	// ── Short-circuit: no commitments ──────────────────────────────────────
	if len(cfg.BatchCommitments) == 0 {
		logger.Info("No commitments this epoch — skipping")
		return &ExecutionResult{
			MarketID:        cfg.MarketID,
			BatchID:         1,
			NewSharesSupply: cfg.SimulatedSharesSupply,
			Allocations:     []UserAllocation{},
			ComputedAt:      time.Now().Unix(),
		}, nil
	}

	// ── Step 1: Decrypt & verify each commitment ──────────────────────────
	// ⚠️ SECURITY: plaintext only exists inside this WASM sandbox
	logger.Info("🔓 Decrypting commitments", slog.Int("count", len(cfg.BatchCommitments)))

	var orders []DecryptedOrder
	rejected := 0
	for _, commitment := range cfg.BatchCommitments {
		if commitment.EncryptedData == "" {
			logger.Warn("Empty encrypted data", slog.String("user", commitment.User))
			rejected++
			continue
		}
		order, err := decryptAndVerify([]byte(commitment.EncryptedData), commitment)
		if err != nil {
			logger.Warn("Commitment rejected",
				slog.String("user", commitment.User),
				slog.String("reason", err.Error()))
			rejected++
			continue
		}
		orders = append(orders, order)
	}
	logger.Info("🔓 Decryption complete",
		slog.Int("valid", len(orders)),
		slog.Int("rejected", rejected))

	// ── Step 2: Deterministic sort by commitmentHash ──────────────────────
	sort.Slice(orders, func(i, j int) bool {
		return orders[i].CommitmentHash < orders[j].CommitmentHash
	})

	// ── Step 3: Parse market state ────────────────────────────────────────
	b, ok := new(big.Int).SetString(cfg.LiquidityB, 10)
	if !ok {
		return nil, fmt.Errorf("invalid liquidityB: %s", cfg.LiquidityB)
	}
	runningShares := make([]*big.Int, len(cfg.SimulatedSharesSupply))
	for i, s := range cfg.SimulatedSharesSupply {
		runningShares[i], ok = new(big.Int).SetString(s, 10)
		if !ok {
			return nil, fmt.Errorf("invalid share[%d]: %s", i, s)
		}
	}

	// ── Step 4: LMSR batch execution ──────────────────────────────────────
	var allocations []UserAllocation
	for _, order := range orders {
		if order.OutcomeIndex < 0 || order.OutcomeIndex >= len(runningShares) {
			logger.Warn("Invalid outcomeIndex", slog.String("user", order.User))
			continue
		}
		if order.InvestmentMist.Sign() <= 0 {
			continue
		}
		sharesMinted := SolveLmsr(runningShares, order.OutcomeIndex, order.InvestmentMist, b)
		if sharesMinted.Sign() > 0 {
			runningShares[order.OutcomeIndex].Add(runningShares[order.OutcomeIndex], sharesMinted)
			allocations = append(allocations, UserAllocation{
				User:         order.User,
				SharesMinted: sharesMinted.String(),
				OutcomeIndex: order.OutcomeIndex,
			})
		}
	}

	// ── Step 5: Compute final prices ─────────────────────────────────────
	prices := CalculatePrices(runningShares, b)
	supplyStrs := make([]string, len(runningShares))
	for i, s := range runningShares {
		supplyStrs[i] = s.String()
	}
	priceStrs := make([]string, len(prices))
	for i, p := range prices {
		priceStrs[i] = p.String()
	}

	result := &ExecutionResult{
		MarketID:        cfg.MarketID,
		BatchID:         1,
		NewSharesSupply: supplyStrs,
		PriceUpdates:    priceStrs,
		Allocations:     allocations,
		ComputedAt:      time.Now().Unix(),
	}

	resultJSON, _ := json.MarshalIndent(result, "", "  ")
	logger.Info("🎯 ExecutionResult computed",
		slog.Int("allocations", len(allocations)),
		slog.String("result", string(resultJSON)))
	logger.Info("✅ Batch complete — ready for Sepolia submission")

	return result, nil
}

// ============================================================================
// Decrypt & Verify
// ============================================================================

// decryptAndVerify verifies a blob and parses the order.
// ⚠️ Plaintext only exists inside this function scope in the WASM sandbox.
func decryptAndVerify(encryptedData []byte, commitment BatchCommitment) (DecryptedOrder, error) {
	if len(encryptedData) == 0 {
		return DecryptedOrder{}, fmt.Errorf("empty encrypted data")
	}
	// Demo mode: payload is plaintext JSON.
	// Production: threshold decrypt via DON Vault secrets capability.
	var payload struct {
		OutcomeIndex   int    `json:"outcomeIndex"`
		InvestmentMist string `json:"investmentMist"`
	}
	if err := json.Unmarshal(encryptedData, &payload); err != nil {
		return DecryptedOrder{}, fmt.Errorf("malformed payload")
	}
	investment, ok := new(big.Int).SetString(payload.InvestmentMist, 10)
	if !ok || investment.Sign() <= 0 {
		return DecryptedOrder{}, fmt.Errorf("invalid investmentMist")
	}
	// ⚠️ plaintext goes out of scope here
	return DecryptedOrder{
		User:           commitment.User,
		OutcomeIndex:   payload.OutcomeIndex,
		InvestmentMist: investment,
		CommitmentHash: commitment.CommitmentHash,
	}, nil
}
