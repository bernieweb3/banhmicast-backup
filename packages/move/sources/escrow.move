/// BanhMiCast — Escrow Module
///
/// Handles user bet commitments ("Encrypted Batching") and emergency refunds.
///
/// Design:
///   - `commit_bet` creates a `BetCommitment` owned object.  The commitment
///     stores only the *hash* and the *Walrus Blob ID* of the encrypted bet —
///     never the plaintext direction or amount.
///   - The collateral is locked inside the `BetCommitment` as a `Balance<SUI>`
///     until the CRE processes the batch and `resolve_batch_with_cre` mints a
///     `UserPosition` in its place.
///   - `emergency_refund` unwinds a stale commitment after the grace period,
///     protecting users if the Chainlink DON becomes unresponsive (liveness
///     failure mitigation from TDD Section 4).
module banhmicast::escrow {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;
    use banhmicast::errors;
    use banhmicast::market::{Self, MarketObject};

    // =========================================================================
    // Constants
    // =========================================================================

    /// Minimum bet in MIST (0.001 SUI).
    const MIN_BET_MIST: u64 = 1_000_000;

    /// Grace period in milliseconds before emergency refund is allowed (30 min).
    const GRACE_PERIOD_MS: u64 = 30 * 60 * 1_000;

    // Error code mirrors — match values in errors.move; needed for
    // #[expected_failure(abort_code = banhmicast::escrow::E_X)] in tests.
    const E_MARKET_CLOSED: u64 = 100;
    const E_INSUFFICIENT_FUNDS: u64 = 200;
    const E_INVALID_HASH: u64 = 201;
    const E_EMPTY_BLOB_ID: u64 = 202;
    const E_GRACE_PERIOD_NOT_ELAPSED: u64 = 203;

    // =========================================================================
    // Structs
    // =========================================================================

    /// Represents a user's "intent" — collateral locked, bet direction hidden.
    ///
    /// Ownership: Owned by the bettor (transferred on creation).
    ///
    /// Lifecycle:
    ///   Created → Consumed by CRE batch resolution OR by emergency_refund.
    public struct BetCommitment has key, store {
        id: UID,
        /// The bettor's address.
        owner: address,
        /// ID of the target MarketObject.
        market_id: ID,
        /// Walrus Blob ID storing the encrypted (outcomeIndex, amount) payload.
        /// This string is public; the content is encrypted.
        encrypted_payload_cid: std::string::String,
        /// SHA3-256(plain_bet_details) — used by the CRE to verify the Walrus
        /// blob wasn't tampered with after the commitment was made.
        commitment_hash: vector<u8>,
        /// SUI locked as collateral; released when the batch executes.
        collateral_locked: Balance<SUI>,
        /// Epoch timestamp (ms) when this commitment was created.
        epoch_locked_ms: u64,
    }

    // =========================================================================
    // Events
    // =========================================================================

    /// Emitted when a user creates an encrypted bet commitment.
    public struct BetCommittedEvent has copy, drop {
        commitment_id: ID,
        market_id: ID,
        owner: address,
        collateral_mist: u64,
        epoch_locked_ms: u64,
    }

    /// Emitted when a user reclaims collateral after a liveness failure.
    public struct EmergencyRefundEvent has copy, drop {
        commitment_id: ID,
        market_id: ID,
        owner: address,
        refund_mist: u64,
    }

    // =========================================================================
    // Task 2.2.1 — commit_bet
    // =========================================================================

    /// Locks user collateral and records the encrypted bet commitment on-chain.
    ///
    /// The commitment does NOT reveal the outcome direction — only the Walrus
    /// Blob ID and the SHA3-256 hash of the plaintext.  The Chainlink CRE
    /// resolves the actual bet direction off-chain during batch execution.
    ///
    /// @param market: The target shared MarketObject.
    /// @param payment: SUI coin to lock as collateral.
    /// @param encrypted_payload_cid: Walrus Blob ID of the encrypted payload.
    /// @param commitment_hash: sha3_256(outcomeIndex || amount) — exactly 32 bytes.
    /// @param clock: Sui Clock for timestamping.
    public fun commit_bet(
        market: &MarketObject,
        payment: Coin<SUI>,
        encrypted_payload_cid: std::string::String,
        commitment_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Guard: market must be open.
        assert!(market::is_active(market), errors::e_market_closed());

        // Guard: minimum bet.
        assert!(
            coin::value(&payment) >= MIN_BET_MIST,
            errors::e_insufficient_funds()
        );

        // Guard: commitment hash must be exactly 32 bytes (SHA3-256).
        assert!(
            vector::length(&commitment_hash) == 32,
            errors::e_invalid_hash()
        );

        // Guard: blob ID must not be empty.
        assert!(
            !std::string::is_empty(&encrypted_payload_cid),
            errors::e_empty_blob_id()
        );

        let collateral_mist = coin::value(&payment);
        let epoch_locked_ms = clock::timestamp_ms(clock);
        let sender = tx_context::sender(ctx);
        let market_id = object::id(market);

        let commitment_uid = object::new(ctx);
        let commitment_id = object::uid_to_inner(&commitment_uid);

        let bet_commitment = BetCommitment {
            id: commitment_uid,
            owner: sender,
            market_id,
            encrypted_payload_cid,
            commitment_hash,
            collateral_locked: coin::into_balance(payment),
            epoch_locked_ms,
        };

        event::emit(BetCommittedEvent {
            commitment_id,
            market_id,
            owner: sender,
            collateral_mist,
            epoch_locked_ms,
        });

        transfer::transfer(bet_commitment, sender);
    }

    // =========================================================================
    // Task 2.2.2 — emergency_refund
    // =========================================================================

    /// Reclaims locked collateral if the Chainlink DON has failed to process
    /// the batch within the grace period.
    ///
    /// This is the "Liveness Failure" safety net described in TDD Section 4.
    /// After GRACE_PERIOD_MS (30 min), the user can call this function to
    /// destroy their `BetCommitment` and recover their SUI.
    ///
    /// @param commitment: The user's BetCommitment (consumed by this call).
    /// @param clock: Sui Clock for current timestamp.
    public fun emergency_refund(
        commitment: BetCommitment,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now_ms = clock::timestamp_ms(clock);
        // Guard: grace period must have elapsed.
        assert!(
            now_ms >= commitment.epoch_locked_ms + GRACE_PERIOD_MS,
            errors::e_grace_period_not_elapsed()
        );

        let refund_mist = balance::value(&commitment.collateral_locked);
        let owner = commitment.owner;
        let market_id = commitment.market_id;

        // Destructure and delete the commitment object
        // (returns storage rebate to the caller).
        let BetCommitment {
            id,
            owner: _,
            market_id: _,
            encrypted_payload_cid: _,
            commitment_hash: _,
            collateral_locked,
            epoch_locked_ms: _,
        } = commitment;
        object::delete(id);

        // Return collateral to the owner.
        let refund_coin = coin::from_balance(collateral_locked, ctx);
        transfer::public_transfer(refund_coin, owner);

        event::emit(EmergencyRefundEvent {
            commitment_id: object::id_from_address(owner), // use owner addr as unique ref
            market_id,
            owner,
            refund_mist,
        });
    }

    // =========================================================================
    // Getters (for tests)
    // =========================================================================

    /// Returns the locked collateral amount in MIST.
    public fun collateral_mist(commitment: &BetCommitment): u64 {
        balance::value(&commitment.collateral_locked)
    }

    /// Returns the commitment hash.
    public fun commitment_hash(commitment: &BetCommitment): &vector<u8> {
        &commitment.commitment_hash
    }

    /// Returns the owner address.
    public fun owner(commitment: &BetCommitment): address {
        commitment.owner
    }

    /// Returns the market_id.
    public fun market_id(commitment: &BetCommitment): ID {
        commitment.market_id
    }

    /// Returns the epoch locked timestamp in ms.
    public fun epoch_locked_ms(commitment: &BetCommitment): u64 {
        commitment.epoch_locked_ms
    }

    // =========================================================================
    // Test-only helpers
    // =========================================================================

    #[test_only]
    public fun grace_period_ms(): u64 { GRACE_PERIOD_MS }

    #[test_only]
    public fun min_bet_mist(): u64 { MIN_BET_MIST }
}
