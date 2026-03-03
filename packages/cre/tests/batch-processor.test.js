/**
 * @fileoverview Batch Processor tests.
 */

import { describe, test, expect } from '@jest/globals';
import { executeBatch } from '../src/batch-processor.js';
import { PRECISION } from '../../shared/constants.js';

/** @returns {import('../../shared/types.js').MarketState} */
function mockMarketState() {
    return {
        marketId: '0xMARKET',
        liquidityB: 1000n,
        sharesSupply: [0n, 0n],
        currentPrices: [PRECISION / 2n, PRECISION / 2n],
        isActive: true,
        lastBatchId: 0,
    };
}

/** @returns {import('../../shared/types.js').DecryptedOrder} */
function mockOrder(user, outcomeIndex, amount, hash = '') {
    return {
        user,
        outcomeIndex,
        investmentAmount: amount,
        commitmentHash: hash || `hash_${user}`,
    };
}

describe('executeBatch', () => {
    test('empty batch returns unchanged state', () => {
        const state = mockMarketState();
        const result = executeBatch(state, []);
        expect(result.batchId).toBe(1);
        expect(result.newSharesSupply).toEqual([0n, 0n]);
        expect(result.payoutAdjustments).toEqual([]);
    });

    test('single order batch produces valid output', () => {
        const state = mockMarketState();
        const orders = [mockOrder('0xA1', 0, 10_000_000n)];
        const result = executeBatch(state, orders);

        expect(result.batchId).toBe(1);
        expect(result.newSharesSupply[0] > 0n).toBe(true);
        expect(result.newSharesSupply[1]).toBe(0n);
        expect(result.payoutAdjustments.length).toBe(1);
        expect(result.payoutAdjustments[0].user).toBe('0xA1');
        expect(result.payoutAdjustments[0].sharesMinted > 0n).toBe(true);
        expect(result.payoutAdjustments[0].outcomeIndex).toBe(0);
    });

    test('multi-order batch processes all orders', () => {
        const state = mockMarketState();
        const orders = [
            mockOrder('0xA1', 0, 5_000_000n, 'aaa'),
            mockOrder('0xA2', 1, 3_000_000n, 'bbb'),
            mockOrder('0xA3', 0, 7_000_000n, 'ccc'),
        ];
        const result = executeBatch(state, orders);

        expect(result.payoutAdjustments.length).toBe(3);
        expect(result.newSharesSupply[0] > 0n).toBe(true);
        expect(result.newSharesSupply[1] > 0n).toBe(true);
    });

    test('deterministic ordering: same input → same output regardless of order', () => {
        const state = mockMarketState();
        const ordersA = [
            mockOrder('0xA1', 0, 5_000_000n, 'zzz'),
            mockOrder('0xA2', 1, 3_000_000n, 'aaa'),
        ];
        const ordersB = [
            mockOrder('0xA2', 1, 3_000_000n, 'aaa'),
            mockOrder('0xA1', 0, 5_000_000n, 'zzz'),
        ];

        const resultA = executeBatch(state, ordersA);
        const resultB = executeBatch(state, ordersB);

        // Both should produce identical results after sorting by commitmentHash
        expect(resultA.newSharesSupply).toEqual(resultB.newSharesSupply);
        expect(resultA.priceUpdates).toEqual(resultB.priceUpdates);
    });

    test('invalid outcome index orders are skipped', () => {
        const state = mockMarketState();
        const orders = [
            mockOrder('0xA1', 0, 5_000_000n, 'aaa'),
            mockOrder('0xBAD', 99, 5_000_000n, 'bbb'), // invalid
        ];
        const result = executeBatch(state, orders);

        // Only 1 payout adjustment (the valid one)
        expect(result.payoutAdjustments.length).toBe(1);
        expect(result.payoutAdjustments[0].user).toBe('0xA1');
    });

    test('throws on invalid marketState', () => {
        expect(() => executeBatch(null, [])).toThrow();
    });

    test('prices in result sum to approximately PRECISION', () => {
        const state = mockMarketState();
        const orders = [
            mockOrder('0xA1', 0, 10_000_000n, 'abc'),
            mockOrder('0xA2', 1, 5_000_000n, 'def'),
        ];
        const result = executeBatch(state, orders);
        const sum = result.priceUpdates.reduce((a, b) => a + b, 0n);
        const diff = sum > PRECISION ? sum - PRECISION : PRECISION - sum;
        expect(diff <= 10n).toBe(true);
    });
});
