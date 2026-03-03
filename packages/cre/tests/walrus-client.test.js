/**
 * @fileoverview Walrus Client tests (mocked HTTP).
 */

import { describe, test, expect, jest } from '@jest/globals';
import { createWalrusClient } from '../src/walrus-client.js';

/**
 * Create a mock fetch function.
 * @param {Object} config
 * @param {number} config.status - HTTP status code.
 * @param {Uint8Array|null} config.body - Response body.
 * @returns {Function} Mock fetch.
 */
function mockFetch(config) {
    return async (_url, _opts) => ({
        ok: config.status >= 200 && config.status < 300,
        status: config.status,
        arrayBuffer: async () =>
            config.body ? config.body.buffer.slice(0) : new ArrayBuffer(0),
    });
}

describe('walrus-client', () => {
    test('fetchBlob: success returns Uint8Array', async () => {
        const testData = new Uint8Array([1, 2, 3, 4, 5]);
        const client = createWalrusClient({
            fetchFn: mockFetch({ status: 200, body: testData }),
        });

        const result = await client.fetchBlob('blob-123');
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBe(5);
    });

    test('fetchBlob: 404 throws descriptive error', async () => {
        const client = createWalrusClient({
            fetchFn: mockFetch({ status: 404, body: null }),
        });

        await expect(client.fetchBlob('nonexistent')).rejects.toThrow(
            'not found'
        );
    });

    test('fetchBlob: throws on empty blobId', async () => {
        const client = createWalrusClient({
            fetchFn: mockFetch({ status: 200, body: new Uint8Array(0) }),
        });

        await expect(client.fetchBlob('')).rejects.toThrow('non-empty string');
    });

    test('fetchBatchBlobs: parallel fetch returns Map', async () => {
        let callCount = 0;
        const blobData = {
            'blob-1': new Uint8Array([1]),
            'blob-2': new Uint8Array([2]),
            'blob-3': new Uint8Array([3]),
        };

        const client = createWalrusClient({
            fetchFn: async (url) => {
                callCount++;
                const id = url.split('/').pop();
                return {
                    ok: true,
                    status: 200,
                    arrayBuffer: async () => blobData[id].buffer.slice(0),
                };
            },
        });

        const result = await client.fetchBatchBlobs(['blob-1', 'blob-2', 'blob-3']);
        expect(result.size).toBe(3);
        expect(callCount).toBe(3);
        expect(result.get('blob-1')).toBeInstanceOf(Uint8Array);
    });

    test('fetchBatchBlobs: empty array returns empty Map', async () => {
        const client = createWalrusClient({
            fetchFn: mockFetch({ status: 200, body: new Uint8Array(0) }),
        });

        const result = await client.fetchBatchBlobs([]);
        expect(result.size).toBe(0);
    });
});
