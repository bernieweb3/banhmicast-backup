# BanhMiCast CRE Workflow

This package contains the **Chainlink Runtime Environment (CRE) Workflow** for BanhMiCast — a privacy-preserving prediction market on Sui.

## What This Workflow Does

The `banhmicast-batch` workflow runs on a cron schedule and:

1. **Fetches** encrypted bet commitments from the **Walrus decentralised storage API** (external data source)
2. **Computes** LMSR pricing using deterministic BigInt math inside a **WASM sandbox** (secure off-chain compute)
3. **Outputs** a signed `ExecutionResult` ready for on-chain submission to Sui

This demonstrates the **Chainlink CRE as computation layer** architecture where:
- **Privacy** — user bets are decrypted inside the DON's WASM sandbox; plaintext never leaves
- **Verifiability** — LMSR computation is deterministic and reproducible on any DON node
- **Interoperability** — result targets Sui (via adapter when CRE native Sui support ships)

## Project Structure

```
packages/cre-workflow/
├── project.yaml              # Global: RPC URLs, cron schedule
├── workflow.yaml             # Workflow config + targets
├── .env.example              # Required environment variables
└── banhmicast-batch/
    ├── main.go               # CRE workflow entry point
    ├── lmsr.go               # LMSR pricing engine (Go port)
    ├── walrus.go             # Walrus HTTP client
    ├── decryptor.go          # Threshold decryption (Gate S2)
    └── config.testnet.json   # Testnet config
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

# Simulate and broadcast to Sepolia (optional demo)
cre workflow simulate banhmicast-batch --target testnet-settings --broadcast
```

## Chainlink Files (Hackathon README Requirement)

Files using Chainlink CRE:
- `packages/cre-workflow/banhmicast-batch/main.go` — CRE SDK workflow entry point
- `packages/cre-workflow/project.yaml` — CRE project config
- `packages/cre-workflow/workflow.yaml` — CRE workflow config
- `packages/cre-workflow/banhmicast-batch/lmsr.go` — Off-chain LMSR compute (runs in DON WASM)
- `packages/cre-workflow/banhmicast-batch/walrus.go` — External API integration (Walrus)

## Hackathon Requirements

| Requirement | Status |
|:---|:---|
| CRE Workflow | ✅ `banhmicast-batch` |
| Blockchain integration | ✅ Walrus (Sui ecosystem) |
| External API | ✅ Walrus Aggregator HTTP API |
| Simulation via CRE CLI | ✅ `cre workflow simulate` |
| Live deployment | 🔜 When CRE native Sui support ships |
