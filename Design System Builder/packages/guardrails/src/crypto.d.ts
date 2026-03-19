/**
 * Crypto — AES-256-GCM encryption/decryption and HKDF key derivation.
 *
 * Uses Node.js built-in crypto (zero external dependencies for security code).
 * All encrypted assets use AES-256-GCM with authenticated encryption.
 *
 * @module crypto
 */
import { Result } from './result';
/**
 * Derive an encryption key from input key material using HKDF (RFC 5869).
 *
 * @param ikm - Input key material (e.g., license_key + machine_fingerprint).
 * @param salt - Salt value (e.g., build_version_hash).
 * @param info - Context string (e.g., "dsb-asset-encryption").
 * @param keyLength - Desired key length in bytes (default: 32 for AES-256).
 * @returns Derived key as a Buffer.
 */
export declare function deriveKey(ikm: string, salt: string, info: string, keyLength?: number): Result<Buffer, string>;
/** Encrypted payload format. */
export interface EncryptedPayload {
    /** Base64-encoded ciphertext. */
    readonly ciphertext: string;
    /** Base64-encoded initialization vector (12 bytes). */
    readonly iv: string;
    /** Base64-encoded authentication tag (16 bytes). */
    readonly authTag: string;
    /** Encryption algorithm identifier. */
    readonly algorithm: 'aes-256-gcm';
}
/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param plaintext - The data to encrypt (string).
 * @param key - 32-byte encryption key (from deriveKey).
 * @returns Encrypted payload with ciphertext, IV, and auth tag.
 */
export declare function encrypt(plaintext: string, key: Buffer): Result<EncryptedPayload, string>;
/**
 * Decrypt an AES-256-GCM encrypted payload.
 *
 * @param payload - The encrypted payload.
 * @param key - 32-byte decryption key (same key used for encryption).
 * @returns Decrypted plaintext string.
 */
export declare function decrypt(payload: EncryptedPayload, key: Buffer): Result<string, string>;
/**
 * Compute SHA-256 hash of a string.
 */
export declare function sha256(input: string): string;
/**
 * Compute SHA-256 hash of a file.
 *
 * @param filePath - Absolute path to the file.
 * @returns Hex-encoded SHA-256 hash.
 */
export declare function sha256File(filePath: string): Result<string, string>;
/**
 * Compute HMAC-SHA256 for integrity signing.
 *
 * @param data - The data to sign.
 * @param secret - The signing secret.
 * @returns Hex-encoded HMAC.
 */
export declare function hmacSha256(data: string, secret: string): string;
//# sourceMappingURL=crypto.d.ts.map