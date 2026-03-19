import { describe, it, expect } from 'vitest';
import { generateSessionToken, validateSessionToken } from '../src/session-token';

describe('session-token', () => {
  describe('generateSessionToken', () => {
    it('generates a token with expected fields', () => {
      const session = generateSessionToken();
      expect(session.token).toBeTruthy();
      expect(session.token.length).toBe(64); // SHA-256 hex = 64 chars
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.expiresAt).toBeGreaterThan(session.createdAt);
    });

    it('generates unique tokens', () => {
      const a = generateSessionToken();
      const b = generateSessionToken();
      expect(a.token).not.toBe(b.token);
    });
  });

  describe('validateSessionToken', () => {
    it('validates a matching token', () => {
      const session = generateSessionToken();
      const result = validateSessionToken(session.token, session);
      expect(result.ok).toBe(true);
    });

    it('rejects an empty token', () => {
      const session = generateSessionToken();
      const result = validateSessionToken('', session);
      expect(result.ok).toBe(false);
    });

    it('rejects a mismatched token', () => {
      const session = generateSessionToken();
      const result = validateSessionToken('wrong-token', session);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Invalid');
      }
    });

    it('rejects an expired token', () => {
      const session = generateSessionToken();
      // Manually expire it
      const expired = { ...session, expiresAt: Date.now() - 1000 };
      const result = validateSessionToken(session.token, expired);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('expired');
      }
    });
  });
});
