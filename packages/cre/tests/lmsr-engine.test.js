/**
 * @fileoverview LMSR Engine tests.
 *
 * Tests: calculateCost, calculatePrices, solveLmsr, bigIntExp, bigIntLn.
 */

import { describe, test, expect } from '@jest/globals';
import {
    calculateCost,
    calculatePrices,
    solveLmsr,
    bigIntExp,
    bigIntLn,
} from '../src/lmsr-engine.js';
import { PRECISION } from '../../shared/constants.js';

describe('bigIntExp', () => {
    test('e^0 == 1', () => {
        expect(bigIntExp(0n)).toBe(PRECISION);
    });

    test('e^1 ≈ 2.718 (within 0.1%)', () => {
        const result = bigIntExp(PRECISION); // e^(1.0)
        // e = 2.718281828... → 2718281828459045235n in 18-decimal
        const expected = 2_718_281_828_459_045_235n;
        const diff = result > expected ? result - expected : expected - result;
        const tolerance = expected / 1000n; // 0.1%
        expect(diff < tolerance).toBe(true);
    });

    test('e^(-1) ≈ 0.3679 (within 0.1%)', () => {
        const result = bigIntExp(-PRECISION);
        const expected = 367_879_441_171_442_321n;
        const diff = result > expected ? result - expected : expected - result;
        const tolerance = expected / 1000n;
        expect(diff < tolerance).toBe(true);
    });
});

describe('bigIntLn', () => {
    test('ln(1) == 0', () => {
        expect(bigIntLn(PRECISION)).toBe(0n);
    });

    test('ln(e) ≈ 1.0 (within 0.1%)', () => {
        const e = bigIntExp(PRECISION); // compute e first
        const result = bigIntLn(e);
        const diff = result > PRECISION ? result - PRECISION : PRECISION - result;
        const tolerance = PRECISION / 1000n;
        expect(diff < tolerance).toBe(true);
    });

    test('ln(2) ≈ 0.693 (within 0.1%)', () => {
        const result = bigIntLn(2n * PRECISION); // ln(2)
        const expected = 693_147_180_559_945_309n;
        const diff = result > expected ? result - expected : expected - result;
        const tolerance = expected / 100n; // 1%
        expect(diff < tolerance).toBe(true);
    });
});

describe('calculateCost', () => {
    test('basic: 2 outcomes, equal shares → cost is defined', () => {
        const shares = [100n, 100n];
        const b = 1000n;
        const cost = calculateCost(shares, b);
        expect(cost > 0n).toBe(true);
    });

    test('cost increases when shares increase', () => {
        const b = 1000n;
        const c1 = calculateCost([100n, 100n], b);
        const c2 = calculateCost([200n, 100n], b);
        expect(c2 > c1).toBe(true);
    });

    test('symmetry: Cost([a,b]) == Cost([b,a])', () => {
        const b = 500n;
        const c1 = calculateCost([150n, 300n], b);
        const c2 = calculateCost([300n, 150n], b);
        // Should be equal (or within rounding)
        const diff = c1 > c2 ? c1 - c2 : c2 - c1;
        expect(diff <= 1n).toBe(true);
    });

    test('throws on empty shares', () => {
        expect(() => calculateCost([], 100n)).toThrow();
    });

    test('throws on b <= 0', () => {
        expect(() => calculateCost([100n], 0n)).toThrow();
    });
});

describe('calculatePrices', () => {
    test('equal shares → approximately equal prices', () => {
        const prices = calculatePrices([0n, 0n], 1000n);
        // Both should be ≈ 0.5 (PRECISION / 2)
        const halfPrecision = PRECISION / 2n;
        for (const p of prices) {
            const diff = p > halfPrecision ? p - halfPrecision : halfPrecision - p;
            expect(diff < PRECISION / 100n).toBe(true); // within 1%
        }
    });

    test('prices sum to approximately PRECISION (= 1.0)', () => {
        const prices = calculatePrices([200n, 50n, 100n], 500n);
        const sum = prices.reduce((a, b) => a + b, 0n);
        const diff = sum > PRECISION ? sum - PRECISION : PRECISION - sum;
        // Allow ±10 for rounding
        expect(diff <= 10n).toBe(true);
    });

    test('higher shares → higher price', () => {
        const prices = calculatePrices([500n, 100n], 300n);
        expect(prices[0] > prices[1]).toBe(true);
    });

    test('3 outcomes with various shares', () => {
        const prices = calculatePrices([100n, 200n, 300n], 400n);
        expect(prices.length).toBe(3);
        // Price should increase with shares: price[0] < price[1] < price[2]
        expect(prices[2] > prices[1]).toBe(true);
        expect(prices[1] > prices[0]).toBe(true);
    });
});

describe('solveLmsr', () => {
    test('basic: investing yields positive shares', () => {
        const shares = [0n, 0n];
        const b = 1000n;
        const investment = 100_000_000n; // 0.1 ETH
        const delta = solveLmsr(shares, 0, investment, b);
        expect(delta > 0n).toBe(true);
    });

    test('higher investment → more shares', () => {
        const shares = [100n, 100n];
        const b = 500n;
        const d1 = solveLmsr(shares, 0, 1_000_000n, b);
        const d2 = solveLmsr(shares, 0, 10_000_000n, b);
        expect(d2 > d1).toBe(true);
    });

    test('high demand → fewer shares per unit (price impact)', () => {
        const b = 500n;
        // First buyer at equilibrium
        const d1 = solveLmsr([0n, 0n], 0, 1_000_000n, b);
        // Second buyer after imbalance
        const d2 = solveLmsr([d1, 0n], 0, 1_000_000n, b);
        // Second buyer should get fewer shares due to higher price
        expect(d1 > d2).toBe(true);
    });

    test('throws on invalid outcomeIndex', () => {
        expect(() => solveLmsr([0n, 0n], 5, 100n, 100n)).toThrow();
    });

    test('throws on zero investment', () => {
        expect(() => solveLmsr([0n, 0n], 0, 0n, 100n)).toThrow();
    });
});
