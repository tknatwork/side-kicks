/**
 * Tests for gumroad-client.ts — Gumroad license verification.
 *
 * Tests the verifyLicense function's validation logic, bypass mode,
 * and error handling. Actual Gumroad API calls are not made (no product ID set).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyLicense } from '../src/gumroad-client';
import type { LicenseTier, VerifyResult } from '../src/gumroad-client';

describe('gumroad-client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('verifyLicense (bypass mode)', () => {
    it('returns pro license in bypass mode', async () => {
      vi.stubEnv('LICENSE_BYPASS', 'true');

      const result = await verifyLicense('any-key');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.valid).toBe(true);
      expect(result.value.tier).toBe('pro');
      expect(result.value.email).toBe('dev@localhost');
    });
  });

  describe('verifyLicense (validation)', () => {
    beforeEach(() => {
      vi.stubEnv('LICENSE_BYPASS', 'false');
    });

    it('rejects empty license key', async () => {
      const result = await verifyLicense('');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('License key is required');
      }
    });

    it('rejects whitespace-only license key', async () => {
      const result = await verifyLicense('   ');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('License key is required');
      }
    });

    it('rejects when product ID is not configured', async () => {
      vi.stubEnv('DSB_GUMROAD_PRODUCT_ID', '');

      const result = await verifyLicense('some-key');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Gumroad product not configured');
      }
    });
  });

  describe('LicenseTier type', () => {
    it('supports free, pro, and team tiers', () => {
      const tiers: LicenseTier[] = ['free', 'pro', 'team'];
      expect(tiers).toHaveLength(3);
    });
  });

  describe('VerifyResult type shape', () => {
    it('captures all verification fields', () => {
      const result: VerifyResult = {
        valid: true,
        email: 'user@example.com',
        tier: 'pro',
        uses: 1,
        refunded: false,
        chargebacked: false,
      };
      expect(result.valid).toBe(true);
      expect(result.tier).toBe('pro');
    });
  });
});
