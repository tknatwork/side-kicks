/**
 * Crypto — AES-256-GCM encryption/decryption and HKDF key derivation.
 *
 * Uses Node.js built-in crypto (zero external dependencies for security code).
 * All encrypted assets use AES-256-GCM with authenticated encryption.
 *
 * @module crypto
 */

import * as crypto from 'node:crypto';
import { Result } from './result';

// ============================================================================
// SECTION 1: KEY DERIVATION
// ============================================================================

/**
 * Derive an encryption key from input key material using HKDF (RFC 5869).
 *
 * @param ikm - Input key material (e.g., license_key + machine_fingerprint).
 * @param salt - Salt value (e.g., build_version_hash).
 * @param info - Context string (e.g., "dsb-asset-encryption").
 * @param keyLength - Desired key length in bytes (default: 32 for AES-256).
 * @returns Derived key as a Buffer.
 */
export function deriveKey(
  ikm: string,
  salt: string,
  info: string,
  keyLength: number = 32
): Result<Buffer, string> {
  try {
    const key = crypto.hkdfSync(
      'sha256',
      Buffer.from(ikm, 'utf-8'),
      Buffer.from(salt, 'utf-8'),
      Buffer.from(info, 'utf-8'),
      keyLength
    );
    return Result.ok(Buffer.from(key));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Key derivation failed: ${message}`);
  }
}

// ============================================================================
// SECTION 2: AES-256-GCM ENCRYPTION
// ============================================================================

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
export function encrypt(
  plaintext: string,
  key: Buffer
): Result<EncryptedPayload, string> {
  if (key.length !== 32) {
    return Result.err(`Invalid key length: expected 32 bytes, got ${key.length}`);
  }

  try {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return Result.ok({
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: 'aes-256-gcm',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Encryption failed: ${message}`);
  }
}

/**
 * Decrypt an AES-256-GCM encrypted payload.
 *
 * @param payload - The encrypted payload.
 * @param key - 32-byte decryption key (same key used for encryption).
 * @returns Decrypted plaintext string.
 */
export function decrypt(
  payload: EncryptedPayload,
  key: Buffer
): Result<string, string> {
  if (key.length !== 32) {
    return Result.err(`Invalid key length: expected 32 bytes, got ${key.length}`);
  }

  if (payload.algorithm !== 'aes-256-gcm') {
    return Result.err(`Unsupported algorithm: ${payload.algorithm}`);
  }

  try {
    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return Result.ok(decrypted.toString('utf-8'));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Decryption failed (wrong key or corrupted data): ${message}`);
  }
}

// ============================================================================
// SECTION 3: HASHING
// ============================================================================

/**
 * Compute SHA-256 hash of a string.
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex');
}

/**
 * Compute SHA-256 hash of a file.
 *
 * @param filePath - Absolute path to the file.
 * @returns Hex-encoded SHA-256 hash.
 */
export function sha256File(filePath: string): Result<string, string> {
  try {
    const fs = require('node:fs');
    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return Result.ok(hash);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to hash file "${filePath}": ${message}`);
  }
}

/**
 * Compute HMAC-SHA256 for integrity signing.
 *
 * @param data - The data to sign.
 * @param secret - The signing secret.
 * @returns Hex-encoded HMAC.
 */
export function hmacSha256(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}
