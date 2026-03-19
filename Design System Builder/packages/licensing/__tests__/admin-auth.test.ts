/**
 * Tests for admin-auth.ts — challenge-response admin authentication.
 *
 * Tests the challenge generation, session management, and TTL logic.
 * Signature verification with the placeholder key will reject (expected).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateAdminChallenge,
  verifyAdminSignature,
  isAdminMode,
  getAdminSession,
  deactivateAdminMode,
  getAdminTimeRemaining,
} from '../src/admin-auth';

describe('admin-auth', () => {
  beforeEach(() => {
    // Reset state before each test
    deactivateAdminMode();
  });

  // ─── Challenge Generation ──────────────────────────────────────────

  describe('generateAdminChallenge', () => {
    it('returns a 64-character hex string (32 bytes)', () => {
      const challenge = generateAdminChallenge();
      expect(challenge).toHaveLength(64);
      expect(challenge).toMatch(/^[0-9a-f]+$/);
    });

    it('generates unique challenges each time', () => {
      const a = generateAdminChallenge();
      const b = generateAdminChallenge();
      expect(a).not.toBe(b);
    });
  });

  // ─── Signature Verification ────────────────────────────────────────

  describe('verifyAdminSignature', () => {
    it('rejects when no pending challenge exists', () => {
      const result = verifyAdminSignature('fake-sig');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('No pending admin challenge');
      }
    });

    it('rejects a signature with the placeholder public key', () => {
      generateAdminChallenge();
      // A random base64 string won't match the placeholder key
      const result = verifyAdminSignature(Buffer.from('x'.repeat(64)).toString('base64'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Should fail at verification — either "failed" or crypto error
        expect(result.error).toBeTruthy();
      }
    });

    it('clears the pending challenge after failed verification', () => {
      generateAdminChallenge();
      verifyAdminSignature('invalid');

      // Second attempt should fail with "no pending challenge"
      const result = verifyAdminSignature('invalid');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('No pending');
      }
    });
  });

  // ─── Session Management ────────────────────────────────────────────

  describe('isAdminMode', () => {
    it('returns false when no session is active', () => {
      expect(isAdminMode()).toBe(false);
    });

    it('returns false after deactivation', () => {
      deactivateAdminMode();
      expect(isAdminMode()).toBe(false);
    });
  });

  describe('getAdminSession', () => {
    it('returns null when not in admin mode', () => {
      expect(getAdminSession()).toBeNull();
    });
  });

  describe('deactivateAdminMode', () => {
    it('clears both session and pending challenge', () => {
      generateAdminChallenge();
      deactivateAdminMode();
      expect(isAdminMode()).toBe(false);
      expect(getAdminSession()).toBeNull();
    });
  });

  describe('getAdminTimeRemaining', () => {
    it('returns 0 when not in admin mode', () => {
      expect(getAdminTimeRemaining()).toBe(0);
    });
  });
});
