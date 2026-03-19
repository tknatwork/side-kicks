/**
 * Admin Public Key — Embedded secp256k1 public key for admin authentication.
 *
 * This is the ONLY admin-related key on user machines. It is a public key
 * (verify-only) — it can confirm that a signed admin challenge was created
 * by the holder of the private key, but it CANNOT create valid signatures.
 *
 * The corresponding private key:
 *   - Lives on a hardware wallet (Ledger/Trezor) owned by the DSB team
 *   - Is derived from a BIP-39 24-word mnemonic seed phrase
 *   - Uses BIP-32 HD derivation path: m/44'/0'/0'/0/0
 *   - Is NEVER distributed, committed, or stored digitally outside the hardware wallet
 *
 * Key type: secp256k1 (same as Bitcoin/Ethereum)
 *   - Chosen for BIP-32 hierarchical derivation support
 *   - Standard: SEC 2 v2, 256-bit elliptic curve
 *   - Verification: ECDSA signature verification via Node.js crypto
 *
 * PLACEHOLDER: Replace with the real generated public key before first release.
 * Generate with: openssl ec -in admin-private.pem -pubout -out admin-public.pem
 *
 * @module licensing/admin-public-key
 */

// ============================================================================
// SECTION 1: PUBLIC KEY
// ============================================================================

/**
 * PEM-encoded secp256k1 public key for admin authentication.
 *
 * To verify an admin signature:
 *   crypto.verify('sha256', challenge, ADMIN_PUBLIC_KEY, signature)
 *
 * PLACEHOLDER VALUE — will be replaced with real key at build time.
 */
export const ADMIN_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEPLACEHOLDERSECP256K1PUBLICKEYTHAT
WILLBEREPLACEDBEFOREFIRSTRELEASEAAAABBBBCCCCDDDDEEEEFFFFGGGG00000=
-----END PUBLIC KEY-----`;

/**
 * Algorithm identifier for secp256k1 ECDSA verification.
 * Used with crypto.verify() and crypto.createVerify().
 */
export const ADMIN_KEY_ALGORITHM = 'SHA256';

/**
 * BIP-32 derivation path used for the admin key.
 * Documented here for reference — the actual derivation happens
 * only on the hardware wallet, never in DSB code.
 */
export const ADMIN_DERIVATION_PATH = "m/44'/0'/0'/0/0";

/**
 * Maximum admin session duration (4 hours).
 * After this, admin mode automatically deactivates.
 */
export const ADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
