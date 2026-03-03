/// BanhMiCast — Error Constants Module
/// All application-level error codes used across the Move package.
/// Do NOT use numeric `0` for errors; always reference these named constants.
module banhmicast::errors {

    // =========================================================================
    // Market Lifecycle Errors (1xx)
    // =========================================================================

    /// Market is not accepting new bets (closed or resolved).
    const E_MARKET_CLOSED: u64 = 100;

    /// Market has not been resolved yet; cannot claim payout.
    const E_MARKET_NOT_RESOLVED: u64 = 101;

    /// Market is already resolved; cannot resolve again.
    const E_MARKET_ALREADY_RESOLVED: u64 = 102;

    /// Invalid number of outcomes (must be >= 2).
    const E_INVALID_OUTCOMES_COUNT: u64 = 103;

    // =========================================================================
    // Bet / Commitment Errors (2xx)
    // =========================================================================

    /// Collateral amount is below the minimum bet threshold.
    const E_INSUFFICIENT_FUNDS: u64 = 200;

    /// Commitment hash length is not 32 bytes (sha3_256 output).
    const E_INVALID_HASH: u64 = 201;

    /// Outstanding bet commitment blob_id is empty.
    const E_EMPTY_BLOB_ID: u64 = 202;

    /// Emergency refund attempted before the grace period has elapsed.
    const E_GRACE_PERIOD_NOT_ELAPSED: u64 = 203;

    /// User position does not match the winning outcome.
    const E_WRONG_OUTCOME: u64 = 204;

    // =========================================================================
    // CRE / Batch Errors (3xx)
    // =========================================================================

    /// The DON signature over the batch payload is invalid.
    const E_INVALID_PROOF: u64 = 300;

    /// Batch ID is not the expected next sequential value (replay protection).
    const E_OUT_OF_SEQUENCE: u64 = 301;

    /// The number of allocations doesn't match the batch commitment count.
    const E_BATCH_SIZE_MISMATCH: u64 = 302;

    /// Price impact of the batch exceeds the configured slippage guard.
    const E_SLIPPAGE_EXCEEDED: u64 = 303;

    /// Liquidity parameter `b` cannot be zero.
    const E_INSUFFICIENT_LIQUIDITY: u64 = 304;

    // =========================================================================
    // Access Control Errors (4xx)
    // =========================================================================

    /// Caller does not hold the required AdminCap capability.
    const E_NOT_AUTHORIZED: u64 = 400;

    // =========================================================================
    // Public Accessor Functions
    // All error codes are exposed as public functions so other modules
    // can reference them via `errors::e_market_closed()` etc.
    // =========================================================================

    public fun e_market_closed(): u64 { E_MARKET_CLOSED }
    public fun e_market_not_resolved(): u64 { E_MARKET_NOT_RESOLVED }
    public fun e_market_already_resolved(): u64 { E_MARKET_ALREADY_RESOLVED }
    public fun e_invalid_outcomes_count(): u64 { E_INVALID_OUTCOMES_COUNT }

    public fun e_insufficient_funds(): u64 { E_INSUFFICIENT_FUNDS }
    public fun e_invalid_hash(): u64 { E_INVALID_HASH }
    public fun e_empty_blob_id(): u64 { E_EMPTY_BLOB_ID }
    public fun e_grace_period_not_elapsed(): u64 { E_GRACE_PERIOD_NOT_ELAPSED }
    public fun e_wrong_outcome(): u64 { E_WRONG_OUTCOME }

    public fun e_invalid_proof(): u64 { E_INVALID_PROOF }
    public fun e_out_of_sequence(): u64 { E_OUT_OF_SEQUENCE }
    public fun e_batch_size_mismatch(): u64 { E_BATCH_SIZE_MISMATCH }
    public fun e_slippage_exceeded(): u64 { E_SLIPPAGE_EXCEEDED }
    public fun e_insufficient_liquidity(): u64 { E_INSUFFICIENT_LIQUIDITY }

    public fun e_not_authorized(): u64 { E_NOT_AUTHORIZED }
}
