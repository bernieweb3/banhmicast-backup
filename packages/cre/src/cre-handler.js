/**
 * @fileoverview CRE Handler — Main Chainlink CRE Entry Point.
 *
 * This is the script that the Chainlink DON invokes during each batch epoch.
 * It orchestrates the full pipeline:
 *
 *   1. Fetch encrypted blobs from Walrus.
 *   2. Decrypt each payload using the DON key share.
 *   3. Verify commitment hashes against on-chain data.
 *   4. Execute the batch through the LMSR engine.
 *   5. Return the signed `ExecutionResult` for on-chain submission.
 *
 * Error handling: All exceptions are caught and returned as structured
 * error objects — the CRE MUST NOT throw unhandled exceptions to the DON.
 *
 * @module @banhmicast/cre/cre-handler
 */

import { createWalrusClient } from './walrus-client.js';
import { createDecryptor } from './decryptor.js';
import { executeBatch } from './batch-processor.js';

/**
 * Creates the CRE handler with injected dependencies.
 *
 * @param {Object} [deps] - Dependency injection for testing.
 * @param {Object} [deps.walrusClient] - Walrus client instance.
 * @param {Object} [deps.decryptor] - Decryptor instance.
 * @returns {Object} Handler with `handleBatch` method.
 */
export function createCreHandler(deps = {}) {
    const walrusClient = deps.walrusClient || createWalrusClient();
    const decryptor = deps.decryptor || createDecryptor();

    /**
     * Main CRE batch handler — called by the Chainlink DON.
     *
     * @param {import('../../shared/types.js').BatchInput} input - Batch input payload.
     * @param {Uint8Array} donKeyShare - DON's threshold key share.
     * @returns {Promise<import('../../shared/types.js').ExecutionResult>} Execution result.
     * @throws {Error} Structured error with `code` and `message` fields.
     */
    async function handleBatch(input, donKeyShare) {
        try {
            // ── Validate input ──────────────────────────────────────────────
            if (!input || !input.currentState) {
                throw createError('INVALID_INPUT', 'Missing or invalid batch input');
            }
            if (!input.batch || input.batch.length === 0) {
                // Empty batch — return unchanged state
                return executeBatch(input.currentState, []);
            }

            // ── Step 1: Fetch encrypted blobs from Walrus ───────────────────
            const blobIds = input.batch.map((c) => c.blobId);
            let blobMap;
            try {
                blobMap = await walrusClient.fetchBatchBlobs(blobIds);
            } catch (err) {
                throw createError(
                    'WALRUS_FETCH_FAILED',
                    `Failed to fetch blobs from Walrus: ${err.message}`
                );
            }

            // ── Step 2-3: Decrypt & verify each commitment ──────────────────
            const decryptedOrders = [];
            const rejectedCommitments = [];

            for (const commitment of input.batch) {
                const encryptedData = blobMap.get(commitment.blobId);
                if (!encryptedData) {
                    rejectedCommitments.push({
                        user: commitment.user,
                        reason: 'Blob not found in Walrus response',
                    });
                    continue;
                }

                try {
                    const order = decryptor.decryptPayload(
                        encryptedData,
                        donKeyShare,
                        commitment.commitmentHash,
                        commitment.user
                    );
                    decryptedOrders.push(order);
                } catch (err) {
                    // Individual commitment failure — skip, don't abort batch
                    rejectedCommitments.push({
                        user: commitment.user,
                        reason: err.message,
                    });
                }
            }

            // ── Step 4: Execute batch through LMSR engine ───────────────────
            const result = executeBatch(input.currentState, decryptedOrders);

            // Attach metadata for debugging (no sensitive data)
            result._meta = {
                totalCommitments: input.batch.length,
                processedOrders: decryptedOrders.length,
                rejectedCount: rejectedCommitments.length,
            };

            return result;
        } catch (err) {
            // Wrap any unexpected error in a structured format
            if (err.code) throw err; // Already structured
            throw createError('CRE_INTERNAL_ERROR', err.message);
        }
    }

    return { handleBatch };
}

/**
 * Create a structured CRE error.
 *
 * @param {string} code - Machine-readable error code.
 * @param {string} message - Human-readable description.
 * @returns {Error} Error with `code` property.
 */
function createError(code, message) {
    const err = new Error(`[${code}] ${message}`);
    err.code = code;
    return err;
}
