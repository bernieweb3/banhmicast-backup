# BanhMiCast CRE Workflow

This package contains the **Chainlink Runtime Environment (CRE) Workflow** for BanhMiCast — a privacy-preserving prediction market on **Ethereum Sepolia**.

## What This Workflow Does

The `banhmicast-batch` workflow runs on a cron schedule and:

1. **Reads** encrypted bet commitments from the batch config (committed on-chain to `BanhMiCastEscrow`)
2. **Computes** LMSR pricing using deterministic BigInt math inside a **WASM sandbox** (secure off-chain compute)
3. **Outputs** a signed `ExecutionResult` ready for on-chain submission to `BanhMiCastMarket` on Sepolia

This demonstrates the **Chainlink CRE as computation layer** architecture where:
- **Privacy** — user bets are decrypted inside the DON's WASM sandbox; plaintext never leaves
- **Verifiability** — LMSR computation is deterministic and reproducible on any DON node
- **Interoperability** — result targets Ethereum Sepolia via ECDSA-signed `ExecutionResult`

## Project Structure

```
packages/cre-workflow/
├── project.yaml              # Global: RPC URLs, cron schedule
├── banhmicast-batch/
│   ├── workflow.yaml         # Workflow config + targets
│   ├── main.go               # CRE workflow entry point
│   ├── lmsr.go               # LMSR pricing engine (Go port)
│   ├── decryptor.go          # Threshold decryption (Gate S2)
│   └── config.testnet.json   # Testnet config (commitments)
├── .env.example              # Required environment variables
└── README.md
```

## Prerequisites

```bash
# 1. Install Go 1.22+
brew install go

# 2. Install CRE CLI
npm install -g @chainlink/cre-cli

# 3. Create CRE account at https://cre.chain.link
# 4. Login
cre login

# 5. Copy and fill environment vars
cp .env.example .env
```

## Running the Simulation

```bash
cd packages/cre-workflow

# Simulate the batch workflow (no broadcast — dry run)
cre workflow simulate banhmicast-batch --target testnet-settings

# Simulate with verbose output
cre workflow simulate banhmicast-batch --target testnet-settings --verbose

# Simulate and broadcast to Sepolia (requires CRE_ETH_PRIVATE_KEY in .env)
cre workflow simulate banhmicast-batch --target testnet-settings --broadcast
```

## Environment Variables

| Variable | Description |
|:---|:---|
| `CRE_ETH_PRIVATE_KEY` | Deployer private key (only needed for `--broadcast`) |
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint (defaults to public node) |

## Chainlink Files (Hackathon README Requirement)

Files using Chainlink CRE:
- `packages/cre-workflow/banhmicast-batch/main.go` — CRE SDK workflow entry point
- `packages/cre-workflow/project.yaml` — CRE project config
- `packages/cre-workflow/banhmicast-batch/workflow.yaml` — CRE workflow config
- `packages/cre-workflow/banhmicast-batch/lmsr.go` — Off-chain LMSR compute (runs in DON WASM)

## Hackathon Requirements

| Requirement | Status |
|:---|:---|
| CRE Workflow | ✅ `banhmicast-batch` |
| Blockchain integration | ✅ Ethereum Sepolia (`BanhMiCastMarket`, `BanhMiCastEscrow`) |
| Secure off-chain compute | ✅ LMSR inside WASM sandbox |
| Simulation via CRE CLI | ✅ `cre workflow simulate` |
