"use strict";
/**
 * Crypto — AES-256-GCM encryption/decryption and HKDF key derivation.
 *
 * Uses Node.js built-in crypto (zero external dependencies for security code).
 * All encrypted assets use AES-256-GCM with authenticated encryption.
 *
 * @module crypto
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveKey = deriveKey;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.sha256 = sha256;
exports.sha256File = sha256File;
exports.hmacSha256 = hmacSha256;
const crypto = __importStar(require("node:crypto"));
const result_1 = require("./result");
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
function deriveKey(ikm, salt, info, keyLength = 32) {
    try {
        const key = crypto.hkdfSync('sha256', Buffer.from(ikm, 'utf-8'), Buffer.from(salt, 'utf-8'), Buffer.from(info, 'utf-8'), keyLength);
        return result_1.Result.ok(Buffer.from(key));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Key derivation failed: ${message}`);
    }
}
/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param plaintext - The data to encrypt (string).
 * @param key - 32-byte encryption key (from deriveKey).
 * @returns Encrypted payload with ciphertext, IV, and auth tag.
 */
function encrypt(plaintext, key) {
    if (key.length !== 32) {
        return result_1.Result.err(`Invalid key length: expected 32 bytes, got ${key.length}`);
    }
    try {
        const iv = crypto.randomBytes(12); // 96-bit IV for GCM
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf-8'),
            cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();
        return result_1.Result.ok({
            ciphertext: encrypted.toString('base64'),
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
            algorithm: 'aes-256-gcm',
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Encryption failed: ${message}`);
    }
}
/**
 * Decrypt an AES-256-GCM encrypted payload.
 *
 * @param payload - The encrypted payload.
 * @param key - 32-byte decryption key (same key used for encryption).
 * @returns Decrypted plaintext string.
 */
function decrypt(payload, key) {
    if (key.length !== 32) {
        return result_1.Result.err(`Invalid key length: expected 32 bytes, got ${key.length}`);
    }
    if (payload.algorithm !== 'aes-256-gcm') {
        return result_1.Result.err(`Unsupported algorithm: ${payload.algorithm}`);
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
        return result_1.Result.ok(decrypted.toString('utf-8'));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Decryption failed (wrong key or corrupted data): ${message}`);
    }
}
// ============================================================================
// SECTION 3: HASHING
// ============================================================================
/**
 * Compute SHA-256 hash of a string.
 */
function sha256(input) {
    return crypto.createHash('sha256').update(input, 'utf-8').digest('hex');
}
/**
 * Compute SHA-256 hash of a file.
 *
 * @param filePath - Absolute path to the file.
 * @returns Hex-encoded SHA-256 hash.
 */
function sha256File(filePath) {
    try {
        const fs = require('node:fs');
        const content = fs.readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        return result_1.Result.ok(hash);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to hash file "${filePath}": ${message}`);
    }
}
/**
 * Compute HMAC-SHA256 for integrity signing.
 *
 * @param data - The data to sign.
 * @param secret - The signing secret.
 * @returns Hex-encoded HMAC.
 */
function hmacSha256(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}
