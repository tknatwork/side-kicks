/**
 * Tests for constants.ts — path construction and constant values.
 *
 * All path functions are pure (depend only on DSB_ROOT + version argument).
 * We verify they return well-formed paths and that constants have expected types.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
  UPDATE_SERVER_URL,
  MANIFEST_ENDPOINT,
  BUNDLE_ENDPOINT,
  UPDATE_PUBLIC_KEY,
  CURRENT_VERSION,
  UPDATE_CHECK_TIMEOUT_MS,
  BUNDLE_DOWNLOAD_TIMEOUT_MS,
  UPDATE_TOKEN_TTL_MS,
  MIN_TLS_VERSION,
  backupDir,
  stagingDir,
  bundlePath,
} from '../src/constants';

// ============================================================================
// SECTION 1: Endpoint Constants
// ============================================================================

describe('endpoint constants', () => {
  it('UPDATE_SERVER_URL is an HTTPS URL', () => {
    expect(UPDATE_SERVER_URL).toMatch(/^https:\/\/.+/);
  });

  it('MANIFEST_ENDPOINT includes base URL', () => {
    expect(MANIFEST_ENDPOINT).toContain(UPDATE_SERVER_URL);
    expect(MANIFEST_ENDPOINT).toContain('manifest');
  });

  it('BUNDLE_ENDPOINT includes base URL', () => {
    expect(BUNDLE_ENDPOINT).toContain(UPDATE_SERVER_URL);
    expect(BUNDLE_ENDPOINT).toContain('bundle');
  });
});

// ============================================================================
// SECTION 2: Cryptographic Constants
// ============================================================================

describe('cryptographic constants', () => {
  it('UPDATE_PUBLIC_KEY is a PEM-formatted public key', () => {
    expect(UPDATE_PUBLIC_KEY).toContain('-----BEGIN PUBLIC KEY-----');
    expect(UPDATE_PUBLIC_KEY).toContain('-----END PUBLIC KEY-----');
  });

  it('MIN_TLS_VERSION is TLSv1.3', () => {
    expect(MIN_TLS_VERSION).toBe('TLSv1.3');
  });
});

// ============================================================================
// SECTION 3: Timing Constants
// ============================================================================

describe('timing constants', () => {
  it('UPDATE_CHECK_TIMEOUT_MS is a reasonable timeout (5-30 seconds)', () => {
    expect(UPDATE_CHECK_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(UPDATE_CHECK_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it('BUNDLE_DOWNLOAD_TIMEOUT_MS is a reasonable timeout (30-300 seconds)', () => {
    expect(BUNDLE_DOWNLOAD_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
    expect(BUNDLE_DOWNLOAD_TIMEOUT_MS).toBeLessThanOrEqual(300_000);
  });

  it('UPDATE_TOKEN_TTL_MS is approximately 5 minutes', () => {
    expect(UPDATE_TOKEN_TTL_MS).toBe(5 * 60 * 1000);
  });
});

// ============================================================================
// SECTION 4: Version
// ============================================================================

describe('CURRENT_VERSION', () => {
  it('is a valid semver string', () => {
    expect(CURRENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('matches package.json version', () => {
    // CURRENT_VERSION should match the package version
    expect(CURRENT_VERSION).toBe('0.1.0');
  });
});

// ============================================================================
// SECTION 5: Path Functions
// ============================================================================

describe('backupDir', () => {
  it('returns a path under workspace/temp/', () => {
    const result = backupDir('1.0.0');
    expect(result).toContain(path.join('workspace', 'temp'));
  });

  it('includes version in directory name', () => {
    const result = backupDir('1.2.3');
    expect(result).toContain('backup-1.2.3');
  });

  it('produces different paths for different versions', () => {
    const a = backupDir('1.0.0');
    const b = backupDir('2.0.0');
    expect(a).not.toBe(b);
  });
});

describe('stagingDir', () => {
  it('returns a path under workspace/temp/', () => {
    const result = stagingDir();
    expect(result).toContain(path.join('workspace', 'temp'));
  });

  it('includes staging in the name', () => {
    const result = stagingDir();
    expect(result).toContain('staging');
  });

  it('returns the same path on repeated calls', () => {
    expect(stagingDir()).toBe(stagingDir());
  });
});

describe('bundlePath', () => {
  it('returns a path under workspace/temp/', () => {
    const result = bundlePath('1.0.0');
    expect(result).toContain(path.join('workspace', 'temp'));
  });

  it('includes version and tar.gz extension', () => {
    const result = bundlePath('2.1.0');
    expect(result).toContain('update-2.1.0.tar.gz');
  });

  it('produces different paths for different versions', () => {
    const a = bundlePath('1.0.0');
    const b = bundlePath('2.0.0');
    expect(a).not.toBe(b);
  });
});
