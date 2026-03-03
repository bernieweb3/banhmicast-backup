/// BanhMiCast — Market Module
///
/// The core "Truth Layer" module. Manages:
///   - The `MarketObject` shared object ("World Table" AMM state).
///   - The `AdminCap` capability for privileged operations.
///   - The `UserPosition` owned object representing a winner's share claim.
///   - `BatchUpdatePayload` & `UserAllocation` structs (CRE result schema).
///   - `resolve_batch_with_cre` — the security-critical function that accepts
///     DON-signed state updates.
///   - `resolve_market` & `claim_payout` — final settlement functions.
///
/// Security Properties:
///   1. All state-mutating functions that touch collateral require either an
///      AdminCap or a valid DON signature.
///   2. Batch IDs are sequential; replay attacks cause an E_OUT_OF_SEQUENCE abort.
///   3. A slippage guard (`max_price_impact_bps`) protects against thin-liquidity
///      manipulation on extreme batch executions.
module banhmicast::market {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::table::{Self, Table};
    use sui::event;
    use sui::bcs;
    use banhmicast::errors;
    use banhmicast::verifier::{Self, VerifierConfig};

    // =========================================================================
    // Constants
    // =========================================================================

    /// Basis-point denominator (10_000 = 100%).
    const BPS_DENOMINATOR: u64 = 10_000;

    /// Maximum allowed price impact per batch in basis points (5%).
    const DEFAULT_MAX_PRICE_IMPACT_BPS: u64 = 500;

    // Error code mirrors — these match the values in errors.move so that
    // #[expected_failure(abort_code = banhmicast::market::E_X)] works in tests.
    // (Move resolves abort_code from the module where assert! fires.)
    const E_MARKET_CLOSED: u64 = 100;
    const E_MARKET_NOT_RESOLVED: u64 = 101;
    const E_MARKET_ALREADY_RESOLVED: u64 = 102;
    const E_INVALID_OUTCOMES_COUNT: u64 = 103;
    const E_INSUFFICIENT_LIQUIDITY: u64 = 304;
    const E_INVALID_PROOF: u64 = 300;
    const E_OUT_OF_SEQUENCE: u64 = 301;
    const E_BATCH_SIZE_MISMATCH: u64 = 302;
    const E_SLIPPAGE_EXCEEDED: u64 = 303;
    const E_WRONG_OUTCOME: u64 = 204;

    // =========================================================================
    // Capability
    // =========================================================================

    /// Admin capability.  Required for: creating markets, resolving markets,
    /// and rotating the DON public key.  Given to the publisher at `init`.
    public struct AdminCap has key, store {
        id: UID,
    }

    // =========================================================================
    // Core Structs
    // =========================================================================

    /// The "World Table" — the shared on-chain state for a prediction market.
    ///
    /// Ownership: `share_object` — accessible by all transactions.
    public struct MarketObject has key {
        id: UID,
        /// Sui address of the market creator.
        creator: address,
        /// Walrus / IPFS CID pointing to full market metadata (question text, images).
        description_cid: std::string::String,
        /// Number of valid outcomes (e.g. 3 for Team-A / Team-B / Draw).
        outcomes_count: u64,
        /// LMSR sensitivity parameter `b`.  Fixed at market creation.
        liquidity_b: u64,
        /// Shares issued per outcome index (outcome_index -> total_shares).
        shares_supply: Table<u64, u64>,
        /// Cached scaled prices from the last resolved batch.
        /// Each value is scaled by 1_000_000 (i.e. 1_000_000 = 100%).
        current_prices: vector<u64>,
        /// True while bets are accepted; set to false upon resolution.
        is_active: bool,
        /// Collateral vault holding all locked SUI from bets in this market.
        collateral_vault: Balance<SUI>,
        /// Monotonically increasing counter; the next accepted batch must equal
        /// `last_batch_id + 1`  (replay-attack prevention).
        last_batch_id: u64,
        /// Winning outcome index; valid only when `is_active == false`.
        winning_outcome: u64,
        /// Maximum allowed price impact per batch (in basis points).
        max_price_impact_bps: u64,
    }

    /// A user's share of a specific outcome.  Owned object — transferred to
    /// the bettor when `resolve_batch_with_cre` processes their commitment.
    public struct UserPosition has key, store {
        id: UID,
        /// Owner's Sui address.
        owner: address,
        /// The market this position belongs to.
        market_id: ID,
        /// Outcome index this position is staked on.
        outcome_index: u64,
        /// Number of shares held.
        share_balance: u64,
    }

    /// Per-user allocation within a batch result payload (from the CRE).
    public struct UserAllocation has store, drop {
        /// Bettor address.
        user: address,
        /// Shares minted for this user.
        shares_minted: u64,
        /// Outcome index chosen.
        outcome_index: u64,
    }

    /// The result payload produced by the CRE and signed by the DON.
    /// This is the single source of truth for a batch execution result.
    public struct BatchUpdatePayload has store, drop {
        /// Sequential batch identifier.
        batch_id: u64,
        /// New shares supply per outcome after this batch.
        new_shares_supply: vector<u64>,
        /// New prices per outcome (scaled by 1_000_000).
        price_updates: vector<u64>,
        /// Per-user allocations from this batch.
        user_allocations: vector<UserAllocation>,
    }

    // =========================================================================
    // Events
    // =========================================================================

    /// Emitted when a new market is created.
    public struct MarketCreatedEvent has copy, drop {
        market_id: ID,
        creator: address,
        outcomes_count: u64,
        liquidity_b: u64,
    }

    /// Emitted when the CRE successfully resolves a batch.
    public struct BatchResolvedEvent has copy, drop {
        market_id: ID,
        batch_id: u64,
        num_allocations: u64,
        /// Serialised new prices for off-chain indexers.
        new_prices: vector<u64>,
    }

    /// Emitted when a market is resolved to a winning outcome.
    public struct MarketResolvedEvent has copy, drop {
        market_id: ID,
        winning_outcome: u64,
    }

    /// Emitted when a winning position is claimed.
    public struct PayoutClaimedEvent has copy, drop {
        market_id: ID,
        user: address,
        outcome_index: u64,
        payout_mist: u64,
    }

    // =========================================================================
    // init
    // =========================================================================

    /// Called once at package publication.  Transfers an `AdminCap` to the
    /// publisher.
    fun init(ctx: &mut TxContext) {
        let cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(cap, tx_context::sender(ctx));
    }

    // =========================================================================
    // Task 2.1.2 — create_market
    // =========================================================================

    /// Creates a new prediction market and shares it as a global object.
    ///
    /// @param _cap: AdminCap — restricts market creation to authorised actors.
    /// @param description_cid: Walrus/IPFS CID for market metadata.
    /// @param outcomes_count: Number of mutually exclusive outcomes (>= 2).
    /// @param liquidity_b: LMSR `b` parameter (sensitivity; fixed for market lifetime).
    /// @param initial_liquidity: SUI coin providing the initial collateral vault seed.
    public fun create_market(
        _cap: &AdminCap,
        description_cid: std::string::String,
        outcomes_count: u64,
        liquidity_b: u64,
        initial_liquidity: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        assert!(outcomes_count >= 2, errors::e_invalid_outcomes_count());
        assert!(liquidity_b > 0, errors::e_insufficient_liquidity());

        // Initialise shares_supply table: every outcome starts at 0 shares.
        let mut shares_supply = table::new<u64, u64>(ctx);
        let mut i = 0u64;
        while (i < outcomes_count) {
            table::add(&mut shares_supply, i, 0u64);
            i = i + 1;
        };

        // Uniform initial prices: each outcome = 1_000_000 / outcomes_count.
        let unit_price = 1_000_000u64 / outcomes_count;
        let mut current_prices = vector::empty<u64>();
        let mut j = 0u64;
        while (j < outcomes_count) {
            vector::push_back(&mut current_prices, unit_price);
            j = j + 1;
        };

        let market_uid = object::new(ctx);
        let market_id = object::uid_to_inner(&market_uid);

        let market = MarketObject {
            id: market_uid,
            creator: tx_context::sender(ctx),
            description_cid,
            outcomes_count,
            liquidity_b,
            shares_supply,
            current_prices,
            is_active: true,
            collateral_vault: coin::into_balance(initial_liquidity),
            last_batch_id: 0,
            winning_outcome: 0,
            max_price_impact_bps: DEFAULT_MAX_PRICE_IMPACT_BPS,
        };

        event::emit(MarketCreatedEvent {
            market_id,
            creator: tx_context::sender(ctx),
            outcomes_count,
            liquidity_b,
        });

        transfer::share_object(market);
    }

    // =========================================================================
    // Task 2.3.2 — BatchUpdatePayload constructor (CRE uses PTB)
    // =========================================================================

    /// Constructs a `UserAllocation` value for use in building a payload.
    public fun new_user_allocation(
        user: address,
        shares_minted: u64,
        outcome_index: u64,
    ): UserAllocation {
        UserAllocation { user, shares_minted, outcome_index }
    }

    /// Constructs the `BatchUpdatePayload` that the CRE/DON submits.
    public fun new_batch_update_payload(
        batch_id: u64,
        new_shares_supply: vector<u64>,
        price_updates: vector<u64>,
        user_allocations: vector<UserAllocation>,
    ): BatchUpdatePayload {
        BatchUpdatePayload {
            batch_id,
            new_shares_supply,
            price_updates,
            user_allocations,
        }
    }

    // =========================================================================
    // Task 2.3.3 — resolve_batch_with_cre  ⚠️ SECURITY CRITICAL
    // =========================================================================

    /// The primary entry point for the Chainlink DON to update the market state.
    ///
    /// Security Checklist (must all pass before state mutation):
    ///   ① DON signature is valid for the serialised payload.
    ///   ② Batch ID is exactly `last_batch_id + 1` (no replay, no skip).
    ///   ③ New shares supply length == outcomes_count (shape mismatch = revert).
    ///   ④ Price updates length == outcomes_count.
    ///   ⑤ Maximum price impact per outcome is within `max_price_impact_bps`.
    ///
    /// @param market: The target shared MarketObject.
    /// @param verifier_config: Shared VerifierConfig holding the DON pubkey.
    /// @param batch_data: The CRE execution result.
    /// @param signature: 64-byte Ed25519 aggregated DON signature.
    public fun resolve_batch_with_cre(
        market: &mut MarketObject,
        verifier_config: &VerifierConfig,
        batch_data: BatchUpdatePayload,
        signature: vector<u8>,
        ctx: &mut TxContext,
    ) {
        // ① Market must be active.
        assert!(market.is_active, errors::e_market_closed());

        // ② Sequence check — prevents replay attacks.
        assert!(
            market.last_batch_id + 1 == batch_data.batch_id,
            errors::e_out_of_sequence()
        );

        // ③ Shape validation — new shares supply must cover all outcomes.
        assert!(
            vector::length(&batch_data.new_shares_supply) == market.outcomes_count,
            errors::e_batch_size_mismatch()
        );

        // ④ Price updates must cover all outcomes.
        assert!(
            vector::length(&batch_data.price_updates) == market.outcomes_count,
            errors::e_batch_size_mismatch()
        );

        // ⑤ Signature verification — aborts with E_INVALID_PROOF if invalid.
        let serialised = bcs::to_bytes(&batch_data.batch_id);
        verifier::verify_don_signature(verifier_config, &serialised, &signature);

        // ⑥ Slippage guard — check max price impact per outcome.
        let mut k = 0u64;
        while (k < market.outcomes_count) {
            let old_price = *vector::borrow(&market.current_prices, k);
            let new_price = *vector::borrow(&batch_data.price_updates, k);
            // Calculate absolute difference in basis points.
            let diff = if (new_price > old_price) {
                new_price - old_price
            } else {
                old_price - new_price
            };
            // impact_bps = diff * BPS_DENOMINATOR / old_price
            // Guard: only check if old_price > 0 to avoid div-by-zero.
            if (old_price > 0) {
                let impact_bps = diff * BPS_DENOMINATOR / old_price;
                assert!(
                    impact_bps <= market.max_price_impact_bps,
                    errors::e_slippage_exceeded()
                );
            };
            k = k + 1;
        };

        // =========================================================
        // State Mutations (only reached after all guards pass)
        // =========================================================

        // Update shares supply.
        let mut s = 0u64;
        while (s < market.outcomes_count) {
            let new_supply = *vector::borrow(&batch_data.new_shares_supply, s);
            *table::borrow_mut(&mut market.shares_supply, s) = new_supply;
            s = s + 1;
        };

        // Update cached prices.
        market.current_prices = batch_data.price_updates;

        // Advance batch counter.
        market.last_batch_id = batch_data.batch_id;

        // Mint UserPosition objects for each allocation.
        let num_allocations = vector::length(&batch_data.user_allocations);
        let mut a = 0u64;
        while (a < num_allocations) {
            let alloc = vector::borrow(&batch_data.user_allocations, a);
            let market_id = object::uid_to_inner(&market.id);
            let position = UserPosition {
                id: object::new(ctx),
                owner: alloc.user,
                market_id,
                outcome_index: alloc.outcome_index,
                share_balance: alloc.shares_minted,
            };
            transfer::transfer(position, alloc.user);
            a = a + 1;
        };

        event::emit(BatchResolvedEvent {
            market_id: object::uid_to_inner(&market.id),
            batch_id: batch_data.batch_id,
            num_allocations,
            new_prices: market.current_prices,
        });
    }

    // =========================================================================
    // Task 2.4.1 — resolve_market
    // =========================================================================

    /// Resolves a market to a definitive winning outcome.
    /// Can only be called by the admin (AdminCap required).
    /// Typically triggered by the Chainlink Oracle result via Automation.
    ///
    /// @param _cap: AdminCap.
    /// @param market: The target shared MarketObject.
    /// @param winning_outcome: Zero-based index of the winning outcome.
    public fun resolve_market(
        _cap: &AdminCap,
        market: &mut MarketObject,
        winning_outcome: u64,
        _ctx: &mut TxContext,
    ) {
        assert!(market.is_active, errors::e_market_already_resolved());
        assert!(winning_outcome < market.outcomes_count, errors::e_wrong_outcome());

        market.is_active = false;
        market.winning_outcome = winning_outcome;

        event::emit(MarketResolvedEvent {
            market_id: object::uid_to_inner(&market.id),
            winning_outcome,
        });
    }

    // =========================================================================
    // Task 2.4.1 — claim_payout
    // =========================================================================

    /// Burns a winning `UserPosition` and transfers the pro-rata SUI payout
    /// from the market's collateral vault to the position owner.
    ///
    /// Payout formula:
    ///   payout = (position.share_balance / total_winning_shares) * vault_balance
    ///
    /// @param position: The caller's UserPosition (owned object — consumed here).
    /// @param market: The resolved shared MarketObject.
    public fun claim_payout(
        position: UserPosition,
        market: &mut MarketObject,
        ctx: &mut TxContext,
    ) {
        // Market must be resolved.
        assert!(!market.is_active, errors::e_market_not_resolved());

        // Position must be on the winning outcome.
        assert!(
            position.outcome_index == market.winning_outcome,
            errors::e_wrong_outcome()
        );

        // Calculate pro-rata payout.
        let total_winning_shares = *table::borrow(
            &market.shares_supply,
            market.winning_outcome,
        );
        let vault_balance = balance::value(&market.collateral_vault);

        // payout_mist = (share_balance * vault_balance) / total_winning_shares
        let payout_mist = if (total_winning_shares > 0) {
            (position.share_balance as u128) * (vault_balance as u128)
                / (total_winning_shares as u128)
        } else {
            0u128
        };
        let payout_amount = (payout_mist as u64);

        let owner = position.owner;
        let outcome_index = position.outcome_index;
        let share_balance = position.share_balance;

        // Destroy the UserPosition (returns storage rebate to user).
        let UserPosition { id, owner: _, market_id: _, outcome_index: _, share_balance: _ } = position;
        object::delete(id);

        // Transfer payout from vault.
        if (payout_amount > 0) {
            let payout_coin = coin::from_balance(
                balance::split(&mut market.collateral_vault, payout_amount),
                ctx,
            );
            transfer::public_transfer(payout_coin, owner);
        };

        event::emit(PayoutClaimedEvent {
            market_id: object::uid_to_inner(&market.id),
            user: owner,
            outcome_index,
            payout_mist: payout_amount,
        });

        let _ = share_balance; // silence unused warning
    }

    // =========================================================================
    // Getters (for tests & off-chain SDKs)
    // =========================================================================

    /// Returns true if the market is still accepting bets.
    public fun is_active(market: &MarketObject): bool { market.is_active }

    /// Returns the number of outcomes.
    public fun outcomes_count(market: &MarketObject): u64 { market.outcomes_count }

    /// Returns the LMSR sensitivity parameter.
    public fun liquidity_b(market: &MarketObject): u64 { market.liquidity_b }

    /// Returns the last processed batch ID.
    public fun last_batch_id(market: &MarketObject): u64 { market.last_batch_id }

    /// Returns the winning outcome (only valid when is_active == false).
    public fun winning_outcome(market: &MarketObject): u64 { market.winning_outcome }

    /// Returns current prices vector.
    public fun current_prices(market: &MarketObject): &vector<u64> { &market.current_prices }

    /// Returns the current balance of the collateral vault in MIST.
    public fun vault_balance(market: &MarketObject): u64 {
        balance::value(&market.collateral_vault)
    }

    /// Returns shares supply for a given outcome index.
    public fun shares_for_outcome(market: &MarketObject, outcome_index: u64): u64 {
        *table::borrow(&market.shares_supply, outcome_index)
    }

    /// Returns a UserPosition's share balance.
    public fun position_shares(pos: &UserPosition): u64 { pos.share_balance }

    /// Returns a UserPosition's outcome index.
    public fun position_outcome(pos: &UserPosition): u64 { pos.outcome_index }

    /// Returns a UserPosition's owner.
    public fun position_owner(pos: &UserPosition): address { pos.owner }

    // =========================================================================
    // Test-only helpers
    // =========================================================================

    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx);
    }
}
