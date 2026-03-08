<div align="center">

# 🥖 BanhMiCast

**Privacy-Preserving Prediction Market on Ethereum Sepolia**  
*Joint-Outcome AMM · Chainlink CRE · Solidity Smart Contracts*

[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](./LICENSE)
[![ETH Sepolia](https://img.shields.io/badge/Ethereum-Sepolia%20Testnet-627EEA?logo=ethereum)](https://sepolia.etherscan.io)
[![Chainlink CRE](https://img.shields.io/badge/Chainlink-CRE%20Workflow-375BD2?logo=chainlink)](./packages/cre-workflow)

</div>

---

## Overview

BanhMiCast is a decentralised prediction market built on **Ethereum Sepolia**. It solves the two biggest problems in prediction markets today:

| Problem | BanhMiCast Solution |
|:---|:---|
| **Liquidity fragmentation** across many outcomes | **Joint-Outcome AMM (World Table)** — all outcomes share a unified pool |
| **Front-running & copy-trading bots** | **Encrypted Batching** — user intent stays hidden until the CRE batch is sealed |

The system uses **Chainlink Runtime Environment (CRE)** as a privacy-preserving off-chain compute layer and **Solidity on Ethereum Sepolia** for high-security on-chain settlement.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User (Browser)                              │
│  Client-side encrypt bet payload → submit commitment hash to Escrow │
└───────────────┬─────────────────────────────────────────────────────┘
                │
                ▼
   ┌────────────────────────────┐
   │  Ethereum Sepolia (L1)     │
   │  BetCommitment (Escrow)    │
   │  MarketObject (Market)     │
   └────────────┬───────────────┘
                │
                ▼
   ┌────────────────────────┐
   │  Chainlink CRE (WASM)  │
   │  1. Read commitments   │
   │  2. Decrypt batch      │
   │  3. LMSR compute       │
   │  4. ExecutionResult    │
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────────┐
   │  Ethereum Sepolia (L1)     │
   │  Verify DON signature      │
   │  Update WorldTable prices  │
   │  Mint share positions      │
   └────────────────────────────┘
```

### Key Components

| Package | Language | Purpose |
|:---|:---|:---|
| `packages/contracts` | Solidity + Foundry | On-chain: market state, escrow, DON verifier |
| `packages/cre-workflow` | Go + WASM | Chainlink CRE: LMSR compute, encrypted batching |
| `packages/cre` | JavaScript | Off-chain helpers: LMSR engine, batch processor, decryptor |
| `packages/shared` | JavaScript | Shared constants, types |
| `packages/frontend` | React + Vite | Web UI: Explore, War Room (WorldTable + BettingPanel), Portfolio |

---

## Chainlink CRE Integration

> 📋 **Hackathon requirement:** All Chainlink-related files are listed here.

| File | Role |
|:---|:---|
| [`packages/cre-workflow/banhmicast-batch/main.go`](./packages/cre-workflow/banhmicast-batch/main.go) | CRE Workflow entry point — `wasm.NewRunner` + `cron.Trigger` |
| [`packages/cre-workflow/banhmicast-batch/lmsr.go`](./packages/cre-workflow/banhmicast-batch/lmsr.go) | LMSR pricing engine in Go (pure BigInt) |
| [`packages/cre-workflow/project.yaml`](./packages/cre-workflow/project.yaml) | CRE project config (RPC targets) |
| [`packages/cre-workflow/banhmicast-batch/workflow.yaml`](./packages/cre-workflow/banhmicast-batch/workflow.yaml) | CRE workflow config (cron trigger + config path) |
| [`packages/cre-workflow/banhmicast-batch/config.testnet.json`](./packages/cre-workflow/banhmicast-batch/config.testnet.json) | Testnet simulation config (market ID, sample commitments) |

### Simulating the CRE Workflow

```bash
# 1. Install CRE CLI (see Prerequisites below)

# 2. Login
cre login

# 3. Run simulation (from project root)
cd packages/cre-workflow
cre workflow simulate banhmicast-batch --target testnet-settings

# With verbose output (recommended for demo)
cre workflow simulate banhmicast-batch --target testnet-settings --verbose
```

**Expected output:**

```
✓ Workflow compiled
[USER LOG] 🥖 BanhMiCast batch epoch started
[USER LOG]  Decryption complete  valid=2 rejected=0
[USER LOG] 🎯 ExecutionResult computed  allocations=2
[USER LOG] ✅ Batch complete — ready for Sepolia submission
✓ Simulation complete!
```

---

## Deployed Contracts (Ethereum Sepolia)

| Contract | Address |
|:---|:---|
| **BanhMiCastVerifier** | [`0x9db8fC6Fd8Ea07044C6dCA4AD4A1E21D8faCBa75`](https://sepolia.etherscan.io/address/0x9db8fC6Fd8Ea07044C6dCA4AD4A1E21D8faCBa75) |
| **BanhMiCastMarket** | [`0xD782a3f67dc7d870aB8bb368FC429dC0BcBd4935`](https://sepolia.etherscan.io/address/0xD782a3f67dc7d870aB8bb368FC429dC0BcBd4935) |
| **BanhMiCastEscrow** | [`0x21241e3991811AcA1840D8471642A2C48b9D0E75`](https://sepolia.etherscan.io/address/0x21241e3991811AcA1840D8471642A2C48b9D0E75) |

---

## Prerequisites

| Tool | Version | Install |
|:---|:---|:---|
| Go | ≥ 1.22 | `brew install go` |
| Foundry | latest | `curl -L https://foundry.paradigm.xyz \| bash` |
| CRE CLI | v1.2.0 | [Download binary](https://github.com/smartcontractkit/cre-cli/releases) |
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| MetaMask | latest | With Sepolia testnet + test ETH from [faucet](https://sepoliafaucet.com) |

### Installing CRE CLI (macOS ARM)

```bash
# Download
curl -L https://github.com/smartcontractkit/cre-cli/releases/download/v1.2.0/cre_darwin_arm64.zip -o /tmp/cre.zip
unzip /tmp/cre.zip -d /tmp/cre-bin

# Install
sudo cp /tmp/cre-bin/cre_v1.2.0_darwin_arm64 /opt/homebrew/bin/cre
chmod +x /opt/homebrew/bin/cre

# Verify
cre version   # → CRE CLI version v1.2.0
```

---

## Installation

```bash
# Clone
git clone https://github.com/bernieweb3/banhmicast.git
cd banhmicast

# Install JavaScript dependencies (CRE helpers + tests)
cd packages/cre && npm install
cd ../shared && npm install

# Install and run frontend
cd ../frontend && npm install
npm run dev   # → http://localhost:5173
```

### Build & Test Contracts (Foundry)

```bash
cd packages/contracts

# Build
forge build

# Test (26 unit tests)
forge test -v
```

### Run CRE JavaScript Tests

```bash
cd packages/cre
npm test
```

---

## Running the CRE Workflow Simulation

```bash
# From project root
cd packages/cre-workflow

# Create .env (optional — only needed for --broadcast)
cp .env.example .env

# Simulate (dry-run, no wallet needed)
cre workflow simulate banhmicast-batch --target testnet-settings

# Non-interactive mode (for CI/demo)
cre workflow simulate banhmicast-batch --target testnet-settings \
    --non-interactive --trigger-index 0
```

### How It Works

1. **Cron trigger** fires — CRE CLI compiles `main.go` to WASM and starts the workflow.
2. **Read encrypted payloads** — the workflow reads committed encrypted bets directly from the batch config.
3. **Decrypt & verify** — inside the WASM sandbox; plaintext never leaves.
4. **LMSR batch compute** — deterministic BigInt pricing, sorted by commitment hash.
5. **ExecutionResult** — JSON output contains new share supplies, price updates (`5×10¹⁷ = 50%`), and per-user allocations.

---

## How the LMSR Pricing Works

BanhMiCast uses the **Logarithmic Market Scoring Rule**:

```
C(q) = b × ln( Σ exp(qᵢ / b) )
P(i) = exp(qᵢ / b) / Σ exp(qⱼ / b)
```

- `b` — liquidity parameter (controls price sensitivity); set at market creation.
- `qᵢ` — outstanding shares for outcome `i`.
- Prices always sum to 1 (probability-preserving).

All arithmetic uses `BigInt` with 18-decimal fixed-point precision to avoid floating-point drift across DON nodes.

---

## Deploying to Ethereum Sepolia

```bash
cd packages/contracts

# Set your private key
export CRE_ETH_PRIVATE_KEY=0x<your_key>

# Deploy contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://1rpc.io/sepolia \
  --private-key $CRE_ETH_PRIVATE_KEY \
  --broadcast

# Seed demo markets (after deploy)
forge script script/SeedMarkets.s.sol:SeedMarkets \
  --rpc-url https://1rpc.io/sepolia \
  --private-key $CRE_ETH_PRIVATE_KEY \
  --broadcast
```

---

## Project Structure

```
banhmicast/
├── packages/
│   ├── contracts/             # Solidity smart contracts (Foundry)
│   │   └── src/
│   │       ├── BanhMiCastMarket.sol    # WorldTable (AMM state)
│   │       ├── BanhMiCastEscrow.sol    # Collateral locking & payout
│   │       ├── BanhMiCastVerifier.sol  # DON ECDSA verification
│   │       └── BanhMiCastErrors.sol    # Custom error library
│   ├── cre-workflow/          # Chainlink CRE Workflow (Go → WASM)
│   │   ├── project.yaml
│   │   └── banhmicast-batch/
│   │       ├── main.go        # Workflow entry point
│   │       ├── lmsr.go        # LMSR pricing engine
│   │       ├── workflow.yaml
│   │       └── config.testnet.json
│   ├── cre/                   # JS off-chain helpers
│   │   └── src/
│   │       ├── cre-handler.js
│   │       ├── lmsr-engine.js
│   │       ├── batch-processor.js
│   │       └── decryptor.js
│   ├── frontend/              # React web UI (Vite + ethers.js)
│   │   └── src/
│   │       ├── components/    # MarketCard, WorldTable, BettingPanel, etc.
│   │       ├── pages/         # ExplorePage, MarketPage, PortfolioPage
│   │       ├── styles/        # Obsidian Crust design system CSS
│   │       └── lib/           # eth-config.js, useWallet.jsx
│   └── shared/                # Shared constants & types
├── scripts/
│   └── test-all.sh
├── LICENSE
└── README.md
```

---

## Security

- **Anti-Front-Running** — bets are encrypted client-side before submission; validators only see commitment hashes.
- **Threshold Decryption** — no single CRE node can decrypt a batch alone; requires a 2/3 quorum of DON nodes.
- **Replay Protection** — `lastBatchId` in `BanhMiCastMarket` prevents batch replay attacks.
- **Emergency Refund** — if no CRE update occurs within the 30-minute grace period, users can call `emergencyRefund()` to reclaim collateral.

---

## License

This project is licensed under a **Custom Proprietary License**. In summary:

- **Research / Educational use** requires prior written permission from the author.
- **Commercial use** is strictly prohibited.
- **Modification** requires prior written permission from the author.
- **Hackathon submissions** are permitted only with written permission **and** ≥ 70% original code.
- **Startup competition use** is unconditionally prohibited.

See [`LICENSE`](./LICENSE) for the full, legally binding terms.

📧 Permission requests: **bernie.web3@gmail.com**

---

## Team — Phú Nhuận Builder

| Role | Name |
|:---|:---|
| 🏆 **Leader** | Phung The Anh |
| 💻 **Vice Leader / Core Developer** | Bernie Nguyen |
| 🔬 **Member / Researcher** | Khai Truong |

📧 Contact: [bernie.web3@gmail.com](mailto:bernie.web3@gmail.com)

---

<div align="center">

Built with ❤️ on Ethereum Sepolia · Powered by Chainlink CRE

</div>
