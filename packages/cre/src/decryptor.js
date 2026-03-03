/**
 * @fileoverview Decryptor — Threshold Decryption for encrypted bet payloads.
 *
 * ⚠️ SECURITY CRITICAL (Gate S2)
 *
 * This module handles sensitive user intent data. Rules:
 *   1. Plaintext MUST NEVER be logged or persisted outside function scope.
 *   2. Integrity check: sha3_256(plaintext) MUST match the on-chain commitmentHash.
 *   3. All errors must be descriptive but MUST NOT leak plaintext content.
 *
 * In the production Chainlink CRE environment, the DON key share is provided
 * securely by the DON runtime. This module abstracts the decryption primitive
 * so it can be swapped for different threshold schemes.
 *
 * @module @banhmicast/cre/decryptor
 */

import { COMMITMENT_HASH_LENGTH } from '../../shared/constants.js';

/**
 * Creates a decryptor instance.
 *
 * @param {Object} [options] - Decryptor configuration.
 * @param {Function} [options.decryptFn] - Custom decryption primitive (for testing).
 *   Signature: (encryptedData: Uint8Array, keyShare: Uint8Array) => Uint8Array
 * @param {Function} [options.hashFn] - Custom SHA3-256 hash function (for testing).
 *   Signature: (data: Uint8Array) => string (hex-encoded)
 * @returns {Object} Decryptor with `decryptPayload` method.
 */
export function createDecryptor(options = {}) {
    const decryptFn = options.decryptFn || defaultDecrypt;
    const hashFn = options.hashFn || defaultHash;

    /**
     * Decrypt an encrypted bet payload and verify its integrity.
     *
     * @param {Uint8Array} encryptedData - Raw encrypted blob from Walrus.
     * @param {Uint8Array} donKeyShare - DON's threshold key share for decryption.
     * @param {string} expectedHash - Hex-encoded SHA3-256 hash from on-chain commitment.
     * @param {string} user - Bettor's Sui address (for building the DecryptedOrder).
     * @returns {import('../../shared/types.js').DecryptedOrder} The decrypted order.
     * @throws {Error} If decryption fails or hash doesn't match (tamper detection).
     */
    function decryptPayload(encryptedData, donKeyShare, expectedHash, user) {
        if (!encryptedData || encryptedData.length === 0) {
            throw new Error('decryptPayload: encryptedData must not be empty');
        }
        if (!donKeyShare || donKeyShare.length === 0) {
            throw new Error('decryptPayload: donKeyShare must not be empty');
        }

        // Step 1: Decrypt using the threshold key share
        let plaintext;
        try {
            plaintext = decryptFn(encryptedData, donKeyShare);
        } catch (err) {
            // Do NOT leak any details about the encryption failure
            throw new Error('decryptPayload: decryption failed — invalid data or key');
        }

        // Step 2: Verify integrity — sha3_256(plaintext) must match commitmentHash
        const computedHash = hashFn(plaintext);
        if (computedHash !== expectedHash) {
            // ⚠️ Tamper detected — MUST NOT log the plaintext
            throw new Error(
                'decryptPayload: commitment hash mismatch — payload was tampered'
            );
        }

        // Step 3: Parse plaintext into order fields
        // Expected format: JSON { outcomeIndex: number, investmentAmount: string(BigInt) }
        let parsed;
        try {
            const jsonStr = new TextDecoder().decode(plaintext);
            parsed = JSON.parse(jsonStr);
        } catch (err) {
            throw new Error('decryptPayload: malformed plaintext — cannot parse order');
        }

        if (typeof parsed.outcomeIndex !== 'number' || parsed.outcomeIndex < 0) {
            throw new Error('decryptPayload: invalid outcomeIndex in decrypted payload');
        }
        if (!parsed.investmentAmount) {
            throw new Error('decryptPayload: missing investmentAmount in decrypted payload');
        }

        /** @type {import('../../shared/types.js').DecryptedOrder} */
        const order = {
            outcomeIndex: parsed.outcomeIndex,
            investmentAmount: BigInt(parsed.investmentAmount),
            commitmentHash: expectedHash,
            user,
        };

        // ⚠️ plaintext goes out of scope here — never stored, never logged.
        return order;
    }

    return { decryptPayload };
}

// =============================================================================
// Default implementations (production stubs — swapped in CRE runtime)
// =============================================================================

/**
 * Default decryption stub. In production, replaced by the DON's threshold
 * decryption primitive. For development/testing, this is a passthrough.
 *
 * @param {Uint8Array} encryptedData
 * @param {Uint8Array} _keyShare
 * @returns {Uint8Array} Decrypted data.
 */
function defaultDecrypt(encryptedData, _keyShare) {
    // Identity function — real implementation uses threshold crypto
    return encryptedData;
}

/**
 * Default SHA3-256 stub. Returns hex-encoded hash.
 *
 * @param {Uint8Array} data
 * @returns {string} Hex-encoded hash.
 */
function defaultHash(data) {
    // For dev/test: use a simple hash. In production, use crypto.subtle or @noble/hashes.
    // This generates a deterministic hex string from the data.
    let hash = 0n;
    for (let i = 0; i < data.length; i++) {
        hash = (hash * 31n + BigInt(data[i])) % (2n ** 256n);
    }
    return hash.toString(16).padStart(64, '0');
}
