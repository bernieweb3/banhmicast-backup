/**
 * @fileoverview Shared type definitions for BanhMiCast (JSDoc-based types).
 * These types define the communication schema between CRE and Sui Move contracts
 * as specified in SDD Section 1.2.
 * @module @banhmicast/shared/types
 */

// =============================================================================
// Market State Types
// =============================================================================

/**
 * The current on-chain state of a prediction market ("World Table").
 * @typedef {Object} MarketState
 * @property {string} marketId - Sui Object ID of the MarketObject.
 * @property {bigint} liquidityB - The 'b' parameter (LMSR sensitivity).
 * @property {bigint[]} sharesSupply - Current shares per outcome (indexed by outcome).
 * @property {bigint[]} currentPrices - Cached prices from the last batch (scaled by PRECISION).
 * @property {boolean} isActive - Whether the market is still accepting bets.
 * @property {number} lastBatchId - ID of the last processed batch.
 */

// =============================================================================
// Batch Input Types (To CRE)
// =============================================================================

/**
 * A single encrypted bet commitment from a user.
 * @typedef {Object} BatchCommitment
 * @property {string} user - Sui address of the bettor.
 * @property {string} blobId - Walrus Blob ID containing the encrypted payload.
 * @property {string} commitmentHash - Hex-encoded SHA3-256 hash of the plaintext bet.
 */

/**
 * Input payload sent to the CRE for batch execution.
 * @typedef {Object} BatchInput
 * @property {string} marketId - Sui Object ID.
 * @property {MarketState} currentState - Snapshot of the market state.
 * @property {BatchCommitment[]} batch - Array of encrypted commitments to process.
 */

// =============================================================================
// Decrypted Order (Internal to CRE)
// =============================================================================

/**
 * A decrypted user order, visible only inside the CRE context.
 * @typedef {Object} DecryptedOrder
 * @property {number} outcomeIndex - The chosen outcome (0-indexed).
 * @property {bigint} investmentAmount - Amount invested in MIST.
 * @property {string} commitmentHash - Verification hash to match on-chain commitment.
 * @property {string} user - Sui address of the bettor.
 */

// =============================================================================
// Batch Output Types (From CRE to Sui)
// =============================================================================

/**
 * Payout adjustment for a single user within a batch.
 * @typedef {Object} UserAllocation
 * @property {string} user - Sui address.
 * @property {bigint} sharesMinted - Number of shares minted for this user.
 * @property {number} outcomeIndex - Which outcome the shares belong to.
 */

/**
 * The result of batch execution, to be signed by the DON and submitted to Sui.
 * @typedef {Object} ExecutionResult
 * @property {string} marketId - Sui Object ID.
 * @property {number} batchId - Sequential batch identifier.
 * @property {bigint[]} newSharesSupply - Updated shares per outcome after batch.
 * @property {bigint[]} priceUpdates - New prices per outcome (scaled by PRECISION).
 * @property {UserAllocation[]} payoutAdjustments - Per-user share allocations.
 * @property {string} proof - Hex-encoded DON aggregated signature.
 */

export { };
