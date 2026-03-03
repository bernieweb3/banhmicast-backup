/**
 * @fileoverview Decryptor tests — including tamper detection.
 */

import { describe, test, expect } from '@jest/globals';
import { createDecryptor } from '../src/decryptor.js';

/**
 * Create a test payload and its "hash".
 */
function createTestPayload(outcomeIndex, investmentAmount) {
    const json = JSON.stringify({
        outcomeIndex,
        investmentAmount: investmentAmount.toString(),
    });
    const bytes = new TextEncoder().encode(json);
    return bytes;
}

/**
 * Simple deterministic hash (matches the defaultHash in decryptor).
 */
function simpleHash(data) {
    let hash = 0n;
    for (let i = 0; i < data.length; i++) {
        hash = (hash * 31n + BigInt(data[i])) % (2n ** 256n);
    }
    return hash.toString(16).padStart(64, '0');
}

describe('decryptor', () => {
    test('decrypt valid payload returns correct DecryptedOrder', () => {
        const payload = createTestPayload(1, 5_000_000n);
        const hash = simpleHash(payload);

        const dec = createDecryptor();
        const order = dec.decryptPayload(
            payload,
            new Uint8Array([1]), // dummy key
            hash,
            '0xUserA'
        );

        expect(order.outcomeIndex).toBe(1);
        expect(order.investmentAmount).toBe(5_000_000n);
        expect(order.commitmentHash).toBe(hash);
        expect(order.user).toBe('0xUserA');
    });

    test('tampered payload → hash mismatch → throws', () => {
        const payload = createTestPayload(0, 1_000_000n);
        const wrongHash = '00'.repeat(32); // definitely wrong

        const dec = createDecryptor();
        expect(() =>
            dec.decryptPayload(payload, new Uint8Array([1]), wrongHash, '0xUser')
        ).toThrow('tampered');
    });

    test('empty encrypted data → throws', () => {
        const dec = createDecryptor();
        expect(() =>
            dec.decryptPayload(new Uint8Array(0), new Uint8Array([1]), 'abc', '0x')
        ).toThrow('empty');
    });

    test('empty key share → throws', () => {
        const payload = createTestPayload(0, 100n);
        const dec = createDecryptor();
        expect(() =>
            dec.decryptPayload(payload, new Uint8Array(0), 'abc', '0x')
        ).toThrow('empty');
    });

    test('decryption failure → generic error (no leak)', () => {
        const dec = createDecryptor({
            decryptFn: () => {
                throw new Error('crypto error');
            },
        });

        expect(() =>
            dec.decryptPayload(
                new Uint8Array([1]),
                new Uint8Array([1]),
                'abc',
                '0x'
            )
        ).toThrow('decryption failed');
    });

    test('malformed JSON → throws parsing error', () => {
        const badData = new TextEncoder().encode('not json {{{');
        const hash = simpleHash(badData);

        const dec = createDecryptor();
        expect(() =>
            dec.decryptPayload(badData, new Uint8Array([1]), hash, '0x')
        ).toThrow('malformed');
    });
});
