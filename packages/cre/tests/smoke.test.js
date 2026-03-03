/**
 * @fileoverview Smoke test to verify CRE test framework is operational.
 */
import { describe, test, expect } from '@jest/globals';
import { PRECISION, MAX_BATCH_SIZE, MIN_BET_AMOUNT } from '../../shared/constants.js';

describe('Shared Constants', () => {
    test('PRECISION is 10^18', () => {
        expect(PRECISION).toBe(10n ** 18n);
    });

    test('MAX_BATCH_SIZE is a positive integer', () => {
        expect(MAX_BATCH_SIZE).toBeGreaterThan(0);
        expect(Number.isInteger(MAX_BATCH_SIZE)).toBe(true);
    });

    test('MIN_BET_AMOUNT is a positive BigInt', () => {
        expect(MIN_BET_AMOUNT).toBeGreaterThan(0n);
    });
});
