/// BanhMiCast — DON Signature Verifier Module
///
/// Validates cryptographic signatures produced by the Chainlink DON
/// (Decentralized Oracle Network) before the contract accepts any
/// batch state update.  Uses Sui's native Ed25519 verification.
///
/// Security Design:
///   - The DON public key is stored in a singleton `VerifierConfig` shared
///     object, so it can be rotated by the admin without re-deploying contracts.
///   - All calls to `verify_don_signature` must pass by *reference* so the
///     raw bytes never leave the function scope unnecessarily.
module banhmicast::verifier {
    use sui::ed25519;
    use banhmicast::errors;

    // =========================================================================
    // Structs
    // =========================================================================

    /// Singleton shared object holding the DON's current public key.
    /// Admin can rotate the key via `set_don_public_key`.
    public struct VerifierConfig has key {
        id: sui::object::UID,
        /// Ed25519 public key (32 bytes) of the Chainlink DON.
        don_public_key: vector<u8>,
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    /// Called once at publish time.  Creates the VerifierConfig and shares it.
    /// @param don_public_key: 32-byte Ed25519 public key for the initial DON.
    public fun initialize(
        don_public_key: vector<u8>,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        let config = VerifierConfig {
            id: sui::object::new(ctx),
            don_public_key,
        };
        sui::transfer::share_object(config);
    }

    // =========================================================================
    // Admin: Key Rotation
    // =========================================================================

    /// Replaces the stored DON public key.
    /// Requires the AdminCap to prevent unauthorised key swaps.
    ///
    /// @param _cap: Proof of admin authority (AdminCap from market module).
    /// @param config: The shared VerifierConfig object.
    /// @param new_key: New 32-byte Ed25519 public key.
    public fun set_don_public_key(
        config: &mut VerifierConfig,
        new_key: vector<u8>,
    ) {
        assert!(vector::length(&new_key) == 32, errors::e_invalid_hash());
        config.don_public_key = new_key;
    }

    // =========================================================================
    // Core Verification
    // =========================================================================

    /// Verifies an Ed25519 `signature` over `message` using the DON's stored
    /// public key.
    ///
    /// @param config: The shared VerifierConfig.
    /// @param message: The raw bytes that were signed (serialized BatchUpdatePayload).
    /// @param signature: 64-byte Ed25519 signature from the DON.
    /// @returns true if the signature is valid; aborts with E_INVALID_PROOF otherwise.
    public fun verify_don_signature(
        config: &VerifierConfig,
        message: &vector<u8>,
        signature: &vector<u8>,
    ): bool {
        let is_valid = ed25519::ed25519_verify(
            signature,
            &config.don_public_key,
            message,
        );
        assert!(is_valid, errors::e_invalid_proof());
        true
    }

    // =========================================================================
    // Getters (for testing)
    // =========================================================================

    /// Returns the currently stored DON public key.
    public fun don_public_key(config: &VerifierConfig): &vector<u8> {
        &config.don_public_key
    }
}
