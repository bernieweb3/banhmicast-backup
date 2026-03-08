/**
 * @fileoverview Shared constants for BanhMiCast across contracts and CRE packages.
 * @module @banhmicast/shared/constants
 */

// =============================================================================
// LMSR Math Constants
// =============================================================================

/** Precision scale for fixed-point BigInt arithmetic (18 decimals). */
export const PRECISION = 10n ** 18n;

/** Maximum number of outcomes per market ("World Table" dimension limit). */
export const MAX_OUTCOMES = 256;

// =============================================================================
// On-chain Constants (must mirror values in Solidity contracts)
// =============================================================================

/** Minimum bet amount in wei (1 ETH = 1e18 wei). */
export const MIN_BET_AMOUNT = 1_000_000_000_000_000n; // 0.001 ETH

/** Grace period before emergency refund is allowed (30 minutes in ms). */
export const GRACE_PERIOD_MS = 30n * 60n * 1000n;

/** Maximum price impact per batch (5% = 500 basis points). */
export const MAX_PRICE_IMPACT_BPS = 500n;

// =============================================================================
// CRE / Batching Constants
// =============================================================================

/** Maximum number of orders in a single batch. */
export const MAX_BATCH_SIZE = 500;

/** Batch interval / epoch duration in milliseconds. */
export const BATCH_INTERVAL_MS = 2000;

/** Length of keccak256 hash in bytes. */
export const COMMITMENT_HASH_LENGTH = 32;
