/**
 * Tests for admin-public-key.ts — constants verification.
 */

import { describe, it, expect } from 'vitest';
import {
  ADMIN_PUBLIC_KEY,
  ADMIN_KEY_ALGORITHM,
  ADMIN_DERIVATION_PATH,
  ADMIN_SESSION_TTL_MS,
} from '../src/admin-public-key';

describe('admin-public-key constants', () => {
  it('ADMIN_PUBLIC_KEY is PEM-formatted', () => {
    expect(ADMIN_PUBLIC_KEY).toContain('-----BEGIN PUBLIC KEY-----');
    expect(ADMIN_PUBLIC_KEY).toContain('-----END PUBLIC KEY-----');
  });

  it('ADMIN_KEY_ALGORITHM is SHA256', () => {
    expect(ADMIN_KEY_ALGORITHM).toBe('SHA256');
  });

  it('ADMIN_DERIVATION_PATH follows BIP-32 format', () => {
    expect(ADMIN_DERIVATION_PATH).toMatch(/^m\/\d+'\/\d+'\/\d+'\/\d+\/\d+$/);
  });

  it('ADMIN_SESSION_TTL_MS is 4 hours', () => {
    expect(ADMIN_SESSION_TTL_MS).toBe(4 * 60 * 60 * 1000);
  });
});
