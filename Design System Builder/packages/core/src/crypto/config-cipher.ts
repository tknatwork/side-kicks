/**
 * Config Cipher — Session-based AES-256-GCM encryption for config payloads.
 *
 * Wraps the guardrails crypto module with:
 *   - Session key generation (random 256-bit key per config UI session)
 *   - Config-specific encrypt/decrypt (JSON serialization built in)
 *   - Hex key format for embedding in HTML (consumed by Web Crypto API)
 *
 * The browser-side counterpart uses SubtleCrypto.importKey('raw') with
 * the same hex key to encrypt before POSTing. This module decrypts
 * on the server side.
 *
 * @module core/crypto/config-cipher
 */

import * as crypto from 'node:crypto';
import { Result, encrypt, decrypt } from '@dsb/guardrails';
import type { EncryptedPayload } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** Encrypted config payload as transmitted from browser to server. */
export interface EncryptedConfig {
  /** Base64-encoded ciphertext. */
  readonly ciphertext: string;
  /** Base64-encoded IV (12 bytes for GCM). */
  readonly iv: string;
  /** Base64-encoded auth tag (16 bytes). */
  readonly authTag: string;
  /** Always 'aes-256-gcm'. */
  readonly algorithm: 'aes-256-gcm';
}

/** A session key with its hex representation for HTML embedding. */
export interface SessionKey {
  /** Raw 32-byte key buffer (for server-side encrypt/decrypt). */
  readonly key: Buffer;
  /** Hex-encoded key string (for embedding in generated HTML). */
  readonly hex: string;
}

// ============================================================================
// SECTION 2: SESSION KEY MANAGEMENT
// ============================================================================

/**
 * Generate a fresh AES-256-GCM session key.
 *
 * Called once per `dsb_open_config_ui` invocation. The hex form
 * is embedded in the generated HTML so the browser can encrypt
 * the config with Web Crypto API before POSTing.
 *
 * The raw Buffer form is held in MCP server process memory for
 * decryption. It is never written to disk.
 */
export function generateSessionKey(): SessionKey {
  const key = crypto.randomBytes(32);
  return {
    key,
    hex: key.toString('hex'),
  };
}

// ============================================================================
// SECTION 3: CONFIG ENCRYPTION / DECRYPTION
// ============================================================================

/**
 * Encrypt a config object for storage (e.g., in build-state.json).
 *
 * Serializes the config to JSON, then encrypts with AES-256-GCM.
 * Uses the guardrails `encrypt` function under the hood.
 *
 * @param config - Any JSON-serializable config object.
 * @param sessionKey - The session key (raw Buffer).
 * @returns Encrypted payload or error.
 */
export function encryptConfig(
  config: unknown,
  sessionKey: Buffer
): Result<EncryptedConfig, string> {
  const json = JSON.stringify(config);
  const result = encrypt(json, sessionKey);
  if (!result.ok) return result;

  return Result.ok({
    ciphertext: result.value.ciphertext,
    iv: result.value.iv,
    authTag: result.value.authTag,
    algorithm: result.value.algorithm,
  });
}

/**
 * Decrypt an encrypted config payload back to a parsed object.
 *
 * Handles payloads encrypted by either:
 *   - The browser (Web Crypto API, same AES-256-GCM format)
 *   - This module's `encryptConfig` function
 *
 * @param encrypted - The encrypted payload.
 * @param sessionKey - The session key (raw Buffer).
 * @returns Parsed config object or error.
 */
export function decryptConfig<T = unknown>(
  encrypted: EncryptedConfig,
  sessionKey: Buffer
): Result<T, string> {
  const payload: EncryptedPayload = {
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    algorithm: encrypted.algorithm,
  };

  const result = decrypt(payload, sessionKey);
  if (!result.ok) return result;

  try {
    const parsed = JSON.parse(result.value) as T;
    return Result.ok(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Decrypted data is not valid JSON: ${message}`);
  }
}

/**
 * Convert a hex key string back to a Buffer.
 *
 * Used when resuming a build: the hex key may be stored in MCP server
 * process state (never on disk) and needs conversion back to Buffer
 * for decrypt operations.
 *
 * @param hex - 64-character hex string (32 bytes).
 * @returns 32-byte key Buffer or error.
 */
export function sessionKeyFromHex(hex: string): Result<Buffer, string> {
  if (hex.length !== 64) {
    return Result.err(`Invalid session key hex: expected 64 chars, got ${hex.length}`);
  }

  if (!/^[0-9a-f]+$/i.test(hex)) {
    return Result.err('Invalid session key hex: contains non-hex characters');
  }

  return Result.ok(Buffer.from(hex, 'hex'));
}
