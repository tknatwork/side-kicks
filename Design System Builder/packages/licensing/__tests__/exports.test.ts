/**
 * Tests for @dsb/licensing barrel exports.
 */

import { describe, it, expect } from 'vitest';

describe('@dsb/licensing exports', () => {
  it('exports gumroad client', async () => {
    const licensing = await import('../src/index');
    expect(typeof licensing.verifyLicense).toBe('function');
  });

  it('exports activation functions', async () => {
    const licensing = await import('../src/index');
    expect(typeof licensing.activate).toBe('function');
    expect(typeof licensing.getActivationStatus).toBe('function');
    expect(typeof licensing.revalidate).toBe('function');
    expect(typeof licensing.deactivate).toBe('function');
    expect(typeof licensing.loadActivation).toBe('function');
    expect(typeof licensing.getActivationRecord).toBe('function');
  });

  it('exports session token functions', async () => {
    const licensing = await import('../src/index');
    expect(typeof licensing.generateSessionToken).toBe('function');
    expect(typeof licensing.validateSessionToken).toBe('function');
  });

  it('exports feature gate functions', async () => {
    const licensing = await import('../src/index');
    expect(typeof licensing.checkFeatureAccess).toBe('function');
    expect(typeof licensing.getFeaturesForTier).toBe('function');
    expect(typeof licensing.getFeatureMatrix).toBe('function');
  });

  it('exports admin auth functions', async () => {
    const licensing = await import('../src/index');
    expect(typeof licensing.generateAdminChallenge).toBe('function');
    expect(typeof licensing.verifyAdminSignature).toBe('function');
    expect(typeof licensing.isAdminMode).toBe('function');
    expect(typeof licensing.getAdminSession).toBe('function');
    expect(typeof licensing.deactivateAdminMode).toBe('function');
    expect(typeof licensing.getAdminTimeRemaining).toBe('function');
  });

  it('exports admin public key constants', async () => {
    const licensing = await import('../src/index');
    expect(typeof licensing.ADMIN_PUBLIC_KEY).toBe('string');
    expect(typeof licensing.ADMIN_KEY_ALGORITHM).toBe('string');
    expect(typeof licensing.ADMIN_DERIVATION_PATH).toBe('string');
    expect(typeof licensing.ADMIN_SESSION_TTL_MS).toBe('number');
  });
});
