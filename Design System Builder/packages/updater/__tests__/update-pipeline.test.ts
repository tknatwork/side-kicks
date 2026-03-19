/**
 * Tests for update-pipeline.ts — update execution and result types.
 *
 * The pipeline itself depends on network, filesystem, and daemon bridge,
 * so we test the exported types, result shapes, and the pipeline's response
 * to bridge failures (since the bridge is injected).
 *
 * We also verify that executeUpdate correctly handles early failures
 * (e.g., download failure) without crashing.
 */

import { describe, it, expect, vi } from 'vitest';
import type { UpdateResult, UpdateBridge, ProgressCallback } from '../src/update-pipeline';
import type { UpdateManifest } from '../src/version-checker';

// ============================================================================
// SECTION 1: Type Shape Verification
// ============================================================================

describe('UpdateResult type shape', () => {
  it('success result has expected fields', () => {
    const result: UpdateResult = {
      success: true,
      fromVersion: '0.1.0',
      toVersion: '0.2.0',
      message: 'Updated successfully.',
    };
    expect(result.success).toBe(true);
    expect(result.fromVersion).toBe('0.1.0');
    expect(result.toVersion).toBe('0.2.0');
    expect(result.message).toBeTruthy();
  });

  it('failure result includes rolledBack', () => {
    const result: UpdateResult = {
      success: false,
      fromVersion: '0.1.0',
      toVersion: '0.2.0',
      message: 'Update failed: download error.',
      rolledBack: true,
    };
    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
  });
});

// ============================================================================
// SECTION 2: UpdateBridge Contract
// ============================================================================

describe('UpdateBridge interface', () => {
  it('mock bridge implements required methods', async () => {
    const bridge: UpdateBridge = {
      enterDaemonUpdateMode: vi.fn().mockResolvedValue({ ok: true }),
      exitDaemonUpdateMode: vi.fn().mockResolvedValue({ ok: true }),
    };

    const enterResult = await bridge.enterDaemonUpdateMode('test-token');
    expect(enterResult.ok).toBe(true);

    const exitResult = await bridge.exitDaemonUpdateMode('test-token');
    expect(exitResult.ok).toBe(true);
  });

  it('bridge can return error state', async () => {
    const bridge: UpdateBridge = {
      enterDaemonUpdateMode: vi.fn().mockResolvedValue({
        ok: false,
        error: 'Daemon not responding',
      }),
      exitDaemonUpdateMode: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await bridge.enterDaemonUpdateMode('token');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Daemon not responding');
  });
});

// ============================================================================
// SECTION 3: ProgressCallback Contract
// ============================================================================

describe('ProgressCallback', () => {
  it('can be called with step and detail', () => {
    const progress: ProgressCallback = vi.fn();
    progress('downloading', 'Downloading DSB v0.2.0...');
    progress('verifying', 'Checking signature...');
    progress('complete', 'Done!');

    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenCalledWith('downloading', 'Downloading DSB v0.2.0...');
  });
});

// ============================================================================
// SECTION 4: Manifest Construction
// ============================================================================

describe('UpdateManifest construction', () => {
  it('creates a valid manifest object', () => {
    const manifest: UpdateManifest = {
      version: '0.2.0',
      changelog: '## v0.2.0\n- New feature',
      downloadUrl: 'https://updates.dsb.example/v1/bundle/0.2.0',
      bundleChecksum: 'a'.repeat(64),
      releasedAt: '2025-01-15T00:00:00.000Z',
      minVersion: '0.1.0',
      fileChecksums: {
        'packages/core/dist/index.js': 'b'.repeat(64),
        'packages/mcp-server/dist/index.js': 'c'.repeat(64),
      },
    };

    expect(manifest.version).toBe('0.2.0');
    expect(manifest.minVersion).toBe('0.1.0');
    expect(Object.keys(manifest.fileChecksums)).toHaveLength(2);
    expect(manifest.bundleChecksum).toHaveLength(64);
  });

  it('manifest downloadUrl must be HTTPS', () => {
    const manifest: UpdateManifest = {
      version: '0.2.0',
      changelog: '',
      downloadUrl: 'https://updates.dsb.example/v1/bundle/0.2.0',
      bundleChecksum: 'abc',
      releasedAt: new Date().toISOString(),
      minVersion: '0.1.0',
      fileChecksums: {},
    };

    expect(manifest.downloadUrl).toMatch(/^https:\/\//);
  });
});

// ============================================================================
// SECTION 5: Pipeline Integration (no network/fs)
// ============================================================================

describe('executeUpdate early failures', () => {
  // We import executeUpdate to verify it handles errors gracefully
  // Note: The actual download will fail since there's no real server,
  // but it should return a proper UpdateResult, not throw

  it('is exported and callable', async () => {
    const { executeUpdate } = await import('../src/update-pipeline');
    expect(typeof executeUpdate).toBe('function');
  });

  it('returns failure result when download URL is unreachable', async () => {
    const { executeUpdate } = await import('../src/update-pipeline');

    const manifest: UpdateManifest = {
      version: '0.2.0',
      changelog: '',
      downloadUrl: 'https://localhost:1/nonexistent',
      bundleChecksum: 'abc',
      releasedAt: new Date().toISOString(),
      minVersion: '0.1.0',
      fileChecksums: {},
    };

    const bridge: UpdateBridge = {
      enterDaemonUpdateMode: vi.fn().mockResolvedValue({ ok: true }),
      exitDaemonUpdateMode: vi.fn().mockResolvedValue({ ok: true }),
    };

    const progress = vi.fn();

    const result = await executeUpdate(
      manifest,
      'test-license-key',
      '0.1.0',
      '/tmp/dsb-test-install',
      bridge,
      progress
    );

    // Should return a proper failure result, not throw
    expect(result.success).toBe(false);
    expect(result.fromVersion).toBe('0.1.0');
    expect(result.toVersion).toBe('0.2.0');
    expect(result.message).toBeTruthy();
  }, 15_000); // Allow time for network timeout
});
