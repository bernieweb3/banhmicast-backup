/// BanhMiCast — Unit Tests: Market Module
#[test_only]
module banhmicast::market_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin;
    use sui::sui::SUI;
    use banhmicast::market::{Self, AdminCap, MarketObject};

    const ADMIN: address = @0xAD;

    // =========================================================================
    // Helpers
    // =========================================================================

    fun setup_admin_and_market(scenario: &mut Scenario) {
        ts::next_tx(scenario, ADMIN);
        { market::test_init(ts::ctx(scenario)); };

        ts::next_tx(scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(scenario);
            let initial_liquidity = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(scenario));
            market::create_market(
                &cap,
                std::string::utf8(b"test_market_cid"),
                2,
                10_000u64,
                initial_liquidity,
                ts::ctx(scenario),
            );
            ts::return_to_sender(scenario, cap);
        };
    }

    // =========================================================================
    // Test: create_market — success
    // =========================================================================

    #[test]
    fun test_create_market_success() {
        let mut scenario = ts::begin(ADMIN);
        setup_admin_and_market(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let market = ts::take_shared<MarketObject>(&mut scenario);
            assert!(market::is_active(&market), 0);
            assert!(market::outcomes_count(&market) == 2, 1);
            assert!(market::liquidity_b(&market) == 10_000, 2);
            assert!(market::last_batch_id(&market) == 0, 3);
            assert!(market::vault_balance(&market) == 1_000_000_000, 4);
            ts::return_shared(market);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: create_market — abort on invalid outcomes count (< 2)
    // =========================================================================

    #[test]
    #[expected_failure(abort_code = banhmicast::market::E_INVALID_OUTCOMES_COUNT, location = banhmicast::market)]
    fun test_create_market_invalid_outcomes() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        { market::test_init(ts::ctx(&mut scenario)); };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&mut scenario);
            let initial_liquidity = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            market::create_market(
                &cap,
                std::string::utf8(b"bad_market"),
                1,          // INVALID: must be >= 2
                10_000,
                initial_liquidity,
                ts::ctx(&mut scenario),
            );
            ts::return_to_sender(&mut scenario, cap);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: create_market — abort on zero liquidity_b
    // =========================================================================

    #[test]
    #[expected_failure(abort_code = banhmicast::market::E_INSUFFICIENT_LIQUIDITY, location = banhmicast::market)]
    fun test_create_market_zero_liquidity() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        { market::test_init(ts::ctx(&mut scenario)); };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&mut scenario);
            let initial_liquidity = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            market::create_market(
                &cap,
                std::string::utf8(b"zero_b"),
                2,
                0,          // INVALID: must be > 0
                initial_liquidity,
                ts::ctx(&mut scenario),
            );
            ts::return_to_sender(&mut scenario, cap);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: resolve_market — success
    // =========================================================================

    #[test]
    fun test_resolve_market_success() {
        let mut scenario = ts::begin(ADMIN);
        setup_admin_and_market(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&mut scenario);
            let mut market = ts::take_shared<MarketObject>(&mut scenario);
            market::resolve_market(&cap, &mut market, 0, ts::ctx(&mut scenario));
            assert!(!market::is_active(&market), 0);
            assert!(market::winning_outcome(&market) == 0, 1);
            ts::return_shared(market);
            ts::return_to_sender(&mut scenario, cap);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: resolve_market — abort if already resolved
    // =========================================================================

    #[test]
    #[expected_failure(abort_code = banhmicast::market::E_MARKET_ALREADY_RESOLVED, location = banhmicast::market)]
    fun test_resolve_market_double_resolve() {
        let mut scenario = ts::begin(ADMIN);
        setup_admin_and_market(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&mut scenario);
            let mut market = ts::take_shared<MarketObject>(&mut scenario);
            market::resolve_market(&cap, &mut market, 0, ts::ctx(&mut scenario));
            // Second call must abort
            market::resolve_market(&cap, &mut market, 1, ts::ctx(&mut scenario));
            ts::return_shared(market);
            ts::return_to_sender(&mut scenario, cap);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: resolve_market — correct state after resolution
    // =========================================================================

    #[test]
    fun test_resolve_market_sets_winner() {
        let mut scenario = ts::begin(ADMIN);
        setup_admin_and_market(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&mut scenario);
            let mut market = ts::take_shared<MarketObject>(&mut scenario);
            market::resolve_market(&cap, &mut market, 1, ts::ctx(&mut scenario)); // outcome 1 wins
            assert!(!market::is_active(&market), 0);
            assert!(market::winning_outcome(&market) == 1, 1);
            ts::return_shared(market);
            ts::return_to_sender(&mut scenario, cap);
        };
        ts::end(scenario);
    }
}
