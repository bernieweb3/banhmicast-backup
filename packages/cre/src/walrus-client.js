/**
 * @fileoverview Walrus Client — Fetch encrypted blobs from Walrus storage.
 *
 * Provides HTTP-based access to the Walrus decentralised storage network.
 * Supports single and parallel batch fetching with retry logic.
 *
 * @module @banhmicast/cre/walrus-client
 */

/**
 * Default Walrus aggregator endpoint.
 * In production, this is injected via CRE environment config.
 */
const DEFAULT_WALRUS_URL = 'https://aggregator.walrus-testnet.walrus.space';

/**
 * Maximum retry attempts for a single blob fetch.
 */
const MAX_RETRIES = 3;

/**
 * Timeout per request in milliseconds.
 */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Creates a Walrus client instance.
 *
 * @param {Object} [options] - Client configuration.
 * @param {string} [options.baseUrl] - Walrus aggregator base URL.
 * @param {Function} [options.fetchFn] - Custom fetch function (for testing/mocking).
 * @returns {Object} Walrus client with `fetchBlob` and `fetchBatchBlobs` methods.
 */
export function createWalrusClient(options = {}) {
    const baseUrl = options.baseUrl || DEFAULT_WALRUS_URL;
    const fetchFn = options.fetchFn || globalThis.fetch;

    /**
     * Fetch a single encrypted blob by its Walrus Blob ID.
     *
     * @param {string} blobId - The Walrus Blob ID.
     * @returns {Promise<Uint8Array>} The raw encrypted blob data.
     * @throws {Error} If blob not found or fetch fails after retries.
     */
    async function fetchBlob(blobId) {
        if (!blobId || typeof blobId !== 'string') {
            throw new Error('fetchBlob: blobId must be a non-empty string');
        }

        let lastError;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

                const response = await fetchFn(`${baseUrl}/v1/blobs/${blobId}`, {
                    signal: controller.signal,
                });

                clearTimeout(timeout);

                if (response.status === 404) {
                    throw new Error(`Blob not found: ${blobId}`);
                }

                if (!response.ok) {
                    throw new Error(
                        `Walrus fetch failed (HTTP ${response.status}): ${blobId}`
                    );
                }

                const buffer = await response.arrayBuffer();
                return new Uint8Array(buffer);
            } catch (err) {
                lastError = err;
                // Don't retry on 404 — blob genuinely doesn't exist
                if (err.message.includes('not found')) throw err;
                // Exponential backoff before retry
                if (attempt < MAX_RETRIES) {
                    await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
                }
            }
        }

        throw new Error(
            `fetchBlob: all ${MAX_RETRIES} attempts failed for ${blobId}: ${lastError?.message}`
        );
    }

    /**
     * Fetch multiple blobs in parallel.
     *
     * @param {string[]} blobIds - Array of Walrus Blob IDs.
     * @returns {Promise<Map<string, Uint8Array>>} Map of blobId → data.
     * @throws {Error} If any blob fetch fails.
     */
    async function fetchBatchBlobs(blobIds) {
        if (!Array.isArray(blobIds) || blobIds.length === 0) {
            return new Map();
        }

        const results = await Promise.all(
            blobIds.map(async (id) => {
                const data = await fetchBlob(id);
                return [id, data];
            })
        );

        return new Map(results);
    }

    return { fetchBlob, fetchBatchBlobs };
}
