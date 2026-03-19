import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  activate,
  deactivate,
  getActivationStatus,
  getActivationRecord,
  loadActivation,
} from '../src/activation';
import type { ActivationRecord } from '../src/activation';

describe('activation', () => {
  beforeEach(() => {
    deactivate();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getActivationStatus (no activation)', () => {
    it('returns not activated', () => {
      vi.stubEnv('LICENSE_BYPASS', 'false');
      const status = getActivationStatus();
      expect(status.activated).toBe(false);
      expect(status.tier).toBe('free');
      expect(status.email).toBe('');
    });
  });

  describe('activate (bypass mode)', () => {
    it('activates with dev bypass', async () => {
      vi.stubEnv('LICENSE_BYPASS', 'true');

      const result = await activate('any-key');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.tier).toBe('pro');
      expect(result.value.email).toBe('dev@localhost');
    });

    it('sets activation status after bypass activate', async () => {
      vi.stubEnv('LICENSE_BYPASS', 'true');

      await activate('any-key');
      const status = getActivationStatus();
      expect(status.activated).toBe(true);
      expect(status.tier).toBe('pro');
    });
  });

  describe('deactivate', () => {
    it('clears activation state', async () => {
      vi.stubEnv('LICENSE_BYPASS', 'true');
      await activate('any-key');
      expect(getActivationStatus().activated).toBe(true);

      vi.stubEnv('LICENSE_BYPASS', 'false');
      deactivate();
      expect(getActivationStatus().activated).toBe(false);
    });
  });

  describe('loadActivation', () => {
    it('restores a persisted activation record', () => {
      vi.stubEnv('LICENSE_BYPASS', 'false');

      const record: ActivationRecord = {
        licenseKey: 'test-key',
        email: 'test@example.com',
        tier: 'pro',
        activatedAt: Date.now() - 1000,
        lastVerifiedAt: Date.now() - 1000,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      loadActivation(record);

      const status = getActivationStatus();
      expect(status.activated).toBe(true);
      expect(status.tier).toBe('pro');
      expect(status.email).toBe('test@example.com');
      expect(status.daysUntilRevalidation).toBeGreaterThan(0);
    });

    it('degrades to free tier when activation has expired', () => {
      vi.stubEnv('LICENSE_BYPASS', 'false');

      const record: ActivationRecord = {
        licenseKey: 'test-key',
        email: 'test@example.com',
        tier: 'pro',
        activatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        lastVerifiedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 1000, // expired
      };

      loadActivation(record);

      const status = getActivationStatus();
      expect(status.activated).toBe(true); // still activated (record exists)
      expect(status.tier).toBe('free');     // but degraded to free
      expect(status.offlineMode).toBe(true);
    });
  });

  describe('getActivationRecord', () => {
    it('returns null when not activated', () => {
      expect(getActivationRecord()).toBeNull();
    });

    it('returns the record after activation', async () => {
      vi.stubEnv('LICENSE_BYPASS', 'true');
      await activate('test-key');

      const record = getActivationRecord();
      expect(record).not.toBeNull();
      expect(record!.licenseKey).toBe('DEV-BYPASS');
    });
  });
});
