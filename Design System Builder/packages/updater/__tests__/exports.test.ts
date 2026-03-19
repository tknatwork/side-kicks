/**
 * Tests for the @dsb/updater barrel exports.
 *
 * Verifies that all expected functions, types, and constants are
 * properly re-exported from the package index.
 */

import { describe, it, expect } from 'vitest';

describe('@dsb/updater exports', () => {
  it('exports all constants', async () => {
    const updater = await import('../src/index');

    // Endpoints
    expect(typeof updater.UPDATE_SERVER_URL).toBe('string');
    expect(typeof updater.MANIFEST_ENDPOINT).toBe('string');
    expect(typeof updater.BUNDLE_ENDPOINT).toBe('string');

    // Crypto
    expect(typeof updater.UPDATE_PUBLIC_KEY).toBe('string');

    // Timing
    expect(typeof updater.UPDATE_CHECK_TIMEOUT_MS).toBe('number');
    expect(typeof updater.BUNDLE_DOWNLOAD_TIMEOUT_MS).toBe('number');
    expect(typeof updater.UPDATE_TOKEN_TTL_MS).toBe('number');

    // Version
    expect(typeof updater.CURRENT_VERSION).toBe('string');

    // TLS
    expect(typeof updater.MIN_TLS_VERSION).toBe('string');
  });

  it('exports path functions', async () => {
    const updater = await import('../src/index');

    expect(typeof updater.backupDir).toBe('function');
    expect(typeof updater.stagingDir).toBe('function');
    expect(typeof updater.bundlePath).toBe('function');
  });

  it('exports version checker functions', async () => {
    const updater = await import('../src/index');

    expect(typeof updater.checkForUpdates).toBe('function');
    expect(typeof updater.fetchSignedManifest).toBe('function');
    expect(typeof updater.verifyManifestSignature).toBe('function');
    expect(typeof updater.isNewerVersion).toBe('function');
    expect(typeof updater.isVersionAtLeast).toBe('function');
  });

  it('exports update pipeline', async () => {
    const updater = await import('../src/index');

    expect(typeof updater.executeUpdate).toBe('function');
  });

  it('exports publish pipeline', async () => {
    const updater = await import('../src/index');

    expect(typeof updater.publishUpdate).toBe('function');
  });
});
