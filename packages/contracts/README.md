# BanhMiCast Contracts

**Solidity smart contracts for BanhMiCast** — a privacy-preserving prediction market on **Ethereum Sepolia**.

Built with [Foundry](https://book.getfoundry.sh/).

---

## Deployed Contracts (Sepolia Testnet)

| Contract | Address | Explorer |
|:---|:---|:---|
| **BanhMiCastVerifier** | `0x9db8fC6Fd8Ea07044C6dCA4AD4A1E21D8faCBa75` | [Etherscan](https://sepolia.etherscan.io/address/0x9db8fC6Fd8Ea07044C6dCA4AD4A1E21D8faCBa75) |
| **BanhMiCastMarket** | `0xD782a3f67dc7d870aB8bb368FC429dC0BcBd4935` | [Etherscan](https://sepolia.etherscan.io/address/0xD782a3f67dc7d870aB8bb368FC429dC0BcBd4935) |
| **BanhMiCastEscrow** | `0x21241e3991811AcA1840D8471642A2C48b9D0E75` | [Etherscan](https://sepolia.etherscan.io/address/0x21241e3991811AcA1840D8471642A2C48b9D0E75) |

---

## Contract Overview

| Contract | Purpose |
|:---|:---|
| `BanhMiCastMarket.sol` | World Table AMM state — market creation, batch resolution, payout claims |
| `BanhMiCastEscrow.sol` | Encrypted bet commitment — locks ETH collateral, emergency refund |
| `BanhMiCastVerifier.sol` | DON ECDSA signature verification |
| `BanhMiCastErrors.sol` | Custom error library (gas-efficient reverts) |

---

## Usage

### Build

```shell
forge build
```

### Test

```shell
# Run all 26 unit tests
forge test -v

# With gas report
forge test --gas-report
```

### Format

```shell
forge fmt
```

### Deploy to Sepolia

```shell
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://1rpc.io/sepolia \
  --private-key $CRE_ETH_PRIVATE_KEY \
  --broadcast
```

### Seed Demo Markets

```shell
forge script script/SeedMarkets.s.sol:SeedMarkets \
  --rpc-url https://1rpc.io/sepolia \
  --private-key $CRE_ETH_PRIVATE_KEY \
  --broadcast
```

### Local Devnet (Anvil)

```shell
anvil
forge script script/Deploy.s.sol:Deploy --rpc-url http://localhost:8545 --broadcast
```

### Cast (interact with deployed contracts)

```shell
# Check if market 1 is active
cast call 0xD782a3f67dc7d870aB8bb368FC429dC0BcBd4935 "isActive(uint256)" 1 --rpc-url https://1rpc.io/sepolia

# Get minimum bet
cast call 0x21241e3991811AcA1840D8471642A2C48b9D0E75 "MIN_BET_WEI()" --rpc-url https://1rpc.io/sepolia
```

---

## Help

```shell
forge --help
anvil --help
cast --help
```

Full Foundry docs: https://book.getfoundry.sh/
