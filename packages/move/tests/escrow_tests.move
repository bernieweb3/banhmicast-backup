/// BanhMiCast — Unit Tests: Escrow Module
#[test_only]
module banhmicast::escrow_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin;
    use sui::sui::SUI;
    use sui::clock;
    use banhmicast::market::{Self, AdminCap, MarketObject};
    use banhmicast::escrow::{Self, BetCommitment};

    const ADMIN: address = @0xAD;
    const USER_A: address = @0xA1;

    fun dummy_hash(): vector<u8> {
        let mut h = vector::empty<u8>();
        let mut i = 0u8;
        while (i < 32) {
            vector::push_back(&mut h, 0u8);
            i = i + 1;
        };
        h
    }

    fun setup(scenario: &mut ts::Scenario) {
        ts::next_tx(scenario, ADMIN);
        { market::test_init(ts::ctx(scenario)); };
        ts::next_tx(scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(scenario);
            let liq = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(scenario));
            market::create_market(
                &cap,
                std::string::utf8(b"test_cid"),
                2, 10_000,
                liq,
                ts::ctx(scenario),
            );
            ts::return_to_sender(scenario, cap);
        };
    }

    // =========================================================================
    // Test: commit_bet — success
    // =========================================================================

    #[test]
    fun test_commit_bet_success() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);

        ts::next_tx(&mut scenario, USER_A);
        {
            let market = ts::take_shared<MarketObject>(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(5_000_000, ts::ctx(&mut scenario));
            let clk = clock::create_for_testing(ts::ctx(&mut scenario));
            escrow::commit_bet(
                &market, payment,
                std::string::utf8(b"walrus-blob-id-123"),
                dummy_hash(),
                &clk,
                ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clk);
            ts::return_shared(market);
        };

        ts::next_tx(&mut scenario, USER_A);
        {
            let commitment = ts::take_from_sender<BetCommitment>(&mut scenario);
            assert!(escrow::collateral_mist(&commitment) == 5_000_000, 0);
            assert!(escrow::owner(&commitment) == USER_A, 1);
            ts::return_to_sender(&mut scenario, commitment);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: commit_bet — abort if market is closed
    // =========================================================================

    #[test]
    #[expected_failure(abort_code = banhmicast::escrow::E_MARKET_CLOSED, location = banhmicast::escrow)]
    fun test_commit_bet_market_closed() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&mut scenario);
            let mut market = ts::take_shared<MarketObject>(&mut scenario);
            market::resolve_market(&cap, &mut market, 0, ts::ctx(&mut scenario));
            ts::return_shared(market);
            ts::return_to_sender(&mut scenario, cap);
        };

        ts::next_tx(&mut scenario, USER_A);
        {
            let market = ts::take_shared<MarketObject>(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(5_000_000, ts::ctx(&mut scenario));
            let clk = clock::create_for_testing(ts::ctx(&mut scenario));
            escrow::commit_bet(
                &market, payment,
                std::string::utf8(b"blob"),
                dummy_hash(), &clk,
                ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clk);
            ts::return_shared(market);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: commit_bet — abort if payment below minimum
    // =========================================================================

    #[test]
    #[expected_failure(abort_code = banhmicast::escrow::E_INSUFFICIENT_FUNDS, location = banhmicast::escrow)]
    fun test_commit_bet_insufficient_funds() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);

        ts::next_tx(&mut scenario, USER_A);
        {
            let market = ts::take_shared<MarketObject>(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(999_999, ts::ctx(&mut scenario));
            let clk = clock::create_for_testing(ts::ctx(&mut scenario));
            escrow::commit_bet(
                &market, payment,
                std::string::utf8(b"blob"),
                dummy_hash(), &clk,
                ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clk);
            ts::return_shared(market);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: commit_bet — abort if commitment hash wrong length
    // =========================================================================

    #[test]
    #[expected_failure(abort_code = banhmicast::escrow::E_INVALID_HASH, location = banhmicast::escrow)]
    fun test_commit_bet_invalid_hash() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);

        ts::next_tx(&mut scenario, USER_A);
        {
            let market = ts::take_shared<MarketObject>(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(5_000_000, ts::ctx(&mut scenario));
            let clk = clock::create_for_testing(ts::ctx(&mut scenario));
            let bad_hash = vector[0u8, 1u8]; // only 2 bytes
            escrow::commit_bet(
                &market, payment,
                std::string::utf8(b"blob"),
                bad_hash, &clk,
                ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clk);
            ts::return_shared(market);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: commit_bet — abort if blob_id is empty
    // =========================================================================

    #[test]
    #[expected_failure(abort_code = banhmicast::escrow::E_EMPTY_BLOB_ID, location = banhmicast::escrow)]
    fun test_commit_bet_empty_blob_id() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);

        ts::next_tx(&mut scenario, USER_A);
        {
            let market = ts::take_shared<MarketObject>(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(5_000_000, ts::ctx(&mut scenario));
            let clk = clock::create_for_testing(ts::ctx(&mut scenario));
            escrow::commit_bet(
                &market, payment,
                std::string::utf8(b""), // EMPTY
                dummy_hash(), &clk,
                ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clk);
            ts::return_shared(market);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: emergency_refund — success after grace period
    // =========================================================================

    #[test]
    fun test_emergency_refund_after_timeout() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);

        ts::next_tx(&mut scenario, USER_A);
        {
            let market = ts::take_shared<MarketObject>(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(5_000_000, ts::ctx(&mut scenario));
            let mut clk = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clk, 0);
            escrow::commit_bet(
                &market, payment,
                std::string::utf8(b"blob-id"),
                dummy_hash(), &clk,
                ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clk);
            ts::return_shared(market);
        };

        // Emergency refund after 31 minutes
        ts::next_tx(&mut scenario, USER_A);
        {
            let commitment = ts::take_from_sender<BetCommitment>(&mut scenario);
            let mut clk = clock::create_for_testing(ts::ctx(&mut scenario));
            let grace = escrow::grace_period_ms();
            clock::set_for_testing(&mut clk, grace + 60_000);
            escrow::emergency_refund(commitment, &clk, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clk);
        };

        ts::next_tx(&mut scenario, USER_A);
        {
            let refund_coin = ts::take_from_sender<sui::coin::Coin<SUI>>(&mut scenario);
            assert!(sui::coin::value(&refund_coin) == 5_000_000, 0);
            ts::return_to_sender(&mut scenario, refund_coin);
        };
        ts::end(scenario);
    }

    // =========================================================================
    // Test: emergency_refund — abort before grace period
    // =========================================================================

    #[test]
    #[expected_failure(abort_code = banhmicast::escrow::E_GRACE_PERIOD_NOT_ELAPSED, location = banhmicast::escrow)]
    fun test_emergency_refund_too_early() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);

        ts::next_tx(&mut scenario, USER_A);
        {
            let market = ts::take_shared<MarketObject>(&mut scenario);
            let payment = coin::mint_for_testing<SUI>(5_000_000, ts::ctx(&mut scenario));
            let mut clk = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clk, 0);
            escrow::commit_bet(
                &market, payment,
                std::string::utf8(b"blob-id"),
                dummy_hash(), &clk,
                ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clk);
            ts::return_shared(market);
        };

        ts::next_tx(&mut scenario, USER_A);
        {
            let commitment = ts::take_from_sender<BetCommitment>(&mut scenario);
            let mut clk = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clk, 60_000); // 1 minute — too early
            escrow::emergency_refund(commitment, &clk, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clk);
        };
        ts::end(scenario);
    }
}
