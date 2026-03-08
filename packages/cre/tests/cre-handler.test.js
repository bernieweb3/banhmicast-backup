/**
 * @fileoverview CRE Handler integration tests (all dependencies mocked).
 */

import { describe, test, expect } from '@jest/globals';
import { createCreHandler } from '../src/cre-handler.js';
import { PRECISION } from '../../shared/constants.js';

/** Simple hash matching decryptor's defaultHash. */
function simpleHash(data) {
    let hash = 0n;
    for (let i = 0; i < data.length; i++) {
        hash = (hash * 31n + BigInt(data[i])) % (2n ** 256n);
    }
    return hash.toString(16).padStart(64, '0');
}

function createTestBlob(outcomeIndex, investmentAmount) {
    const json = JSON.stringify({
        outcomeIndex,
        investmentAmount: investmentAmount.toString(),
    });
    return new TextEncoder().encode(json);
}

function mockMarketState() {
    return {
        marketId: '1',
        liquidityB: 1000n,
        sharesSupply: [0n, 0n],
        currentPrices: [PRECISION / 2n, PRECISION / 2n],
        isActive: true,
        lastBatchId: 0,
    };
}

describe('cre-handler', () => {
    test('full pipeline: happy path end-to-end', async () => {
        const blob1 = createTestBlob(0, 5_000_000n);
        const blob2 = createTestBlob(1, 3_000_000n);
        const hash1 = simpleHash(blob1);
        const hash2 = simpleHash(blob2);

        const handler = createCreHandler();
        const result = await handler.handleBatch(
            {
                marketId: '1',
                currentState: mockMarketState(),
                batch: [
                    { user: '0xA1', encryptedData: blob1, commitmentHash: hash1 },
                    { user: '0xA2', encryptedData: blob2, commitmentHash: hash2 },
                ],
            },
            new Uint8Array([1]) // dummy DON key share
        );

        expect(result.batchId).toBe(1);
        expect(result.payoutAdjustments.length).toBe(2);
        expect(result.newSharesSupply[0] > 0n).toBe(true);
        expect(result.newSharesSupply[1] > 0n).toBe(true);
        expect(result._meta.processedOrders).toBe(2);
        expect(result._meta.rejectedCount).toBe(0);
    });

    test('missing encrypted data → order rejected, batch continues', async () => {
        const blob = createTestBlob(0, 1_000_000n);
        const correctHash = simpleHash(blob);

        const handler = createCreHandler();
        const result = await handler.handleBatch(
            {
                marketId: '1',
                currentState: mockMarketState(),
                batch: [
                    { user: '0xGood', encryptedData: blob, commitmentHash: correctHash },
                    { user: '0xBad', encryptedData: null, commitmentHash: 'abc' },
                ],
            },
            new Uint8Array([1])
        );

        expect(result.payoutAdjustments.length).toBe(1);
        expect(result.payoutAdjustments[0].user).toBe('0xGood');
        expect(result._meta.rejectedCount).toBe(1);
    });

    test('invalid commitment hash → order rejected, batch continues', async () => {
        const blob = createTestBlob(0, 1_000_000n);
        const correctHash = simpleHash(blob);

        const handler = createCreHandler();
        const result = await handler.handleBatch(
            {
                marketId: '1',
                currentState: mockMarketState(),
                batch: [
                    { user: '0xGood', encryptedData: blob, commitmentHash: correctHash },
                    { user: '0xBad', encryptedData: blob, commitmentHash: 'wrong_hash' },
                ],
            },
            new Uint8Array([1])
        );

        // Good order processed, bad order rejected
        expect(result.payoutAdjustments.length).toBe(1);
        expect(result.payoutAdjustments[0].user).toBe('0xGood');
        expect(result._meta.rejectedCount).toBe(1);
    });

    test('empty batch returns unchanged state', async () => {
        const handler = createCreHandler();
        const result = await handler.handleBatch(
            {
                marketId: '1',
                currentState: mockMarketState(),
                batch: [],
            },
            new Uint8Array([1])
        );

        expect(result.batchId).toBe(1);
        expect(result.payoutAdjustments.length).toBe(0);
        expect(result.newSharesSupply).toEqual([0n, 0n]);
    });

    test('null input → structured error', async () => {
        const handler = createCreHandler();
        await expect(
            handler.handleBatch(null, new Uint8Array([1]))
        ).rejects.toThrow('INVALID_INPUT');
    });
});
