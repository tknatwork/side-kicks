import { describe, it, expect } from 'vitest';
import { deriveKey, encrypt, decrypt, sha256, hmacSha256 } from '../src/crypto';

describe('crypto', () => {
  describe('deriveKey', () => {
    it('derives a 32-byte key from input material', () => {
      const result = deriveKey('license-key-123', 'v1.0.0-hash', 'dsb-asset-encryption');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(32);
      }
    });

    it('produces deterministic keys for the same inputs', () => {
      const key1 = deriveKey('same-ikm', 'same-salt', 'same-info');
      const key2 = deriveKey('same-ikm', 'same-salt', 'same-info');
      expect(key1.ok).toBe(true);
      expect(key2.ok).toBe(true);
      if (key1.ok && key2.ok) {
        expect(key1.value.toString('hex')).toBe(key2.value.toString('hex'));
      }
    });

    it('produces different keys for different inputs', () => {
      const key1 = deriveKey('ikm-a', 'salt', 'info');
      const key2 = deriveKey('ikm-b', 'salt', 'info');
      expect(key1.ok).toBe(true);
      expect(key2.ok).toBe(true);
      if (key1.ok && key2.ok) {
        expect(key1.value.toString('hex')).not.toBe(key2.value.toString('hex'));
      }
    });
  });

  describe('encrypt / decrypt round-trip', () => {
    it('encrypts and decrypts plaintext correctly', () => {
      const keyResult = deriveKey('test-key', 'test-salt', 'test-info');
      expect(keyResult.ok).toBe(true);
      if (!keyResult.ok) return;

      const plaintext = 'This is a secret agent prompt for Design System Builder.';
      const encryptResult = encrypt(plaintext, keyResult.value);
      expect(encryptResult.ok).toBe(true);
      if (!encryptResult.ok) return;

      const decryptResult = decrypt(encryptResult.value, keyResult.value);
      expect(decryptResult.ok).toBe(true);
      if (decryptResult.ok) {
        expect(decryptResult.value).toBe(plaintext);
      }
    });

    it('fails to decrypt with wrong key', () => {
      const correctKey = deriveKey('correct-key', 'salt', 'info');
      const wrongKey = deriveKey('wrong-key', 'salt', 'info');
      expect(correctKey.ok).toBe(true);
      expect(wrongKey.ok).toBe(true);
      if (!correctKey.ok || !wrongKey.ok) return;

      const encrypted = encrypt('secret data', correctKey.value);
      expect(encrypted.ok).toBe(true);
      if (!encrypted.ok) return;

      const decrypted = decrypt(encrypted.value, wrongKey.value);
      expect(decrypted.ok).toBe(false);
    });

    it('rejects invalid key length', () => {
      const shortKey = Buffer.from('too-short');
      const encryptResult = encrypt('test', shortKey);
      expect(encryptResult.ok).toBe(false);
      if (!encryptResult.ok) {
        expect(encryptResult.error).toContain('Invalid key length');
      }
    });

    it('handles empty plaintext', () => {
      const keyResult = deriveKey('key', 'salt', 'info');
      expect(keyResult.ok).toBe(true);
      if (!keyResult.ok) return;

      const encrypted = encrypt('', keyResult.value);
      expect(encrypted.ok).toBe(true);
      if (!encrypted.ok) return;

      const decrypted = decrypt(encrypted.value, keyResult.value);
      expect(decrypted.ok).toBe(true);
      if (decrypted.ok) {
        expect(decrypted.value).toBe('');
      }
    });

    it('handles large plaintext', () => {
      const keyResult = deriveKey('key', 'salt', 'info');
      expect(keyResult.ok).toBe(true);
      if (!keyResult.ok) return;

      const largePlaintext = 'A'.repeat(100_000);
      const encrypted = encrypt(largePlaintext, keyResult.value);
      expect(encrypted.ok).toBe(true);
      if (!encrypted.ok) return;

      const decrypted = decrypt(encrypted.value, keyResult.value);
      expect(decrypted.ok).toBe(true);
      if (decrypted.ok) {
        expect(decrypted.value).toBe(largePlaintext);
      }
    });
  });

  describe('sha256', () => {
    it('produces consistent hashes', () => {
      const hash1 = sha256('hello');
      const hash2 = sha256('hello');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', () => {
      expect(sha256('hello')).not.toBe(sha256('world'));
    });

    it('produces 64-character hex strings', () => {
      expect(sha256('test').length).toBe(64);
      expect(/^[0-9a-f]+$/.test(sha256('test'))).toBe(true);
    });
  });

  describe('hmacSha256', () => {
    it('produces consistent HMACs', () => {
      const hmac1 = hmacSha256('data', 'secret');
      const hmac2 = hmacSha256('data', 'secret');
      expect(hmac1).toBe(hmac2);
    });

    it('produces different HMACs for different secrets', () => {
      expect(hmacSha256('data', 'secret1')).not.toBe(hmacSha256('data', 'secret2'));
    });
  });
});
