# BanhMiCast — Sui Testnet Deployment Info

**Deployed:** 2026-03-03T15:22 +07:00  
**Network:** Sui Testnet  
**Deployer:** `0xf2446652a28718799ce13c6f1895befa36259169e5da884dff2448ca20f7b63b`

---

## Contract Addresses

| Object | ID |
|:---|:---|
| **PackageID** | `0x352a63e9364222707eeeaae0d49bac9bce2b089a2ceeeebf0716f7701932c32f` |
| **AdminCap** | `0xad729894d5bb7ca264c8f28896005651c48956bdd9ae5b67070695b832f22437` |
| **UpgradeCap** | `0x703b26f2af5a17627f1d8572325cd46b32218e934b0e9eb0c5b191c6f302ea78` |
| **VerifierConfig** (shared) | `0x1ff1edb05cc6818bb0dff0819434d382e5546c22c2280aa0ad3bfb78c0bd4f5b` |

> ⚠️ **Note:** VerifierConfig currently holds a **placeholder DON public key** (32 zero bytes).
> Before mainnet, call `verifier::set_don_public_key(adminCap, realDonKey)` to update it.

## Modules Published

- `errors`
- `escrow`  
- `market`
- `verifier`

## Transaction Info

| Field | Value |
|:---|:---|
| Gas Used | 59,545,080 MIST (~0.060 SUI) |
| Tx Digest | `3VzpFWs9Am24oHDYD14UauqkPX8exHwgJCrqLQSDKUgE` |

## SuiScan Links

- [Package on SuiScan](https://suiscan.xyz/testnet/object/0x352a63e9364222707eeeaae0d49bac9bce2b089a2ceeeebf0716f7701932c32f)
- [AdminCap on SuiScan](https://suiscan.xyz/testnet/object/0xad729894d5bb7ca264c8f28896005651c48956bdd9ae5b67070695b832f22437)

## Next Steps

After deploying, call `verifier::initialize(don_public_key)` via PTB to create the shared `VerifierConfig` object.
Then call `market::create_market(adminCap, ...)` to create the first market.
