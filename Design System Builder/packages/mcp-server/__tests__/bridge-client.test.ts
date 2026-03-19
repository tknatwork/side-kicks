/**
 * Tests for BridgeClient — HTTP client for orchestration server communication.
 *
 * Tests the BridgeClient class methods, URL construction, header handling,
 * and error paths. Since we can't bind ports in the sandbox, we test the
 * class construction and method existence, and verify error handling when
 * the server is unreachable.
 */

import { describe, it, expect, vi } from 'vitest';
import { BridgeClient } from '../src/bridge-client';
import type { BridgeCommand, BridgeResult, BridgeStatus } from '../src/bridge-client';

// ============================================================================
// SECTION 1: Construction
// ============================================================================

describe('BridgeClient construction', () => {
  it('creates a client with port and session token', () => {
    const client = new BridgeClient(9877, 'test-token-123');
    expect(client).toBeDefined();
  });

  it('exposes expected public methods', () => {
    const client = new BridgeClient(9877, 'test-token');
    expect(typeof client.sendCommand).toBe('function');
    expect(typeof client.sendBatch).toBe('function');
    expect(typeof client.getStatus).toBe('function');
    expect(typeof client.healthCheck).toBe('function');
    expect(typeof client.clearQueue).toBe('function');
    expect(typeof client.getConfigResults).toBe('function');
    expect(typeof client.clearConfigResults).toBe('function');
    expect(typeof client.getBuildStatus).toBe('function');
    expect(typeof client.getLockdownStatus).toBe('function');
    expect(typeof client.liftLockdown).toBe('function');
    expect(typeof client.sendDaemonHeartbeat).toBe('function');
    expect(typeof client.enterDaemonUpdateMode).toBe('function');
    expect(typeof client.exitDaemonUpdateMode).toBe('function');
    expect(typeof client.reportTamperAlert).toBe('function');
  });
});

// ============================================================================
// SECTION 2: Type Shapes
// ============================================================================

describe('BridgeClient types', () => {
  it('BridgeCommand has type and payload', () => {
    const cmd: BridgeCommand = {
      type: 'create_collection',
      payload: { name: 'Primitives', modes: ['Default'] },
    };
    expect(cmd.type).toBe('create_collection');
    expect(cmd.payload).toHaveProperty('name');
  });

  it('BridgeResult success shape', () => {
    const result: BridgeResult = {
      commandId: 'cmd-123',
      success: true,
      data: { collectionId: 'coll-1' },
    };
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('collectionId');
  });

  it('BridgeResult failure shape', () => {
    const result: BridgeResult = {
      commandId: 'cmd-456',
      success: false,
      error: 'Collection not found',
    };
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('BridgeStatus shape', () => {
    const status: BridgeStatus = {
      queue: { pending: 0, processing: 0, completed: 5, failed: 1 },
      plugins: { pluginCount: 1, connectedPlugins: [{ pluginId: 'dsb-builder' }] },
    };
    expect(status.queue.completed).toBe(5);
    expect(status.plugins.connectedPlugins).toHaveLength(1);
  });
});

// ============================================================================
// SECTION 3: Error Handling (unreachable server)
// ============================================================================

describe('BridgeClient error handling', () => {
  // Use a port that nothing is listening on
  const client = new BridgeClient(1, 'test-token');

  it('sendCommand throws when server has bad port', async () => {
    // sendCommand does not internally catch network errors
    // (unlike getStatus, healthCheck, etc. which return null/false)
    await expect(
      client.sendCommand({ type: 'get_collections', payload: {} })
    ).rejects.toThrow();
  }, 10_000);

  it('sendCommand returns failure on HTTP error status', async () => {
    // Use a valid port that will refuse connection
    const refusedClient = new BridgeClient(19999, 'test-token');
    await expect(
      refusedClient.sendCommand({ type: 'test', payload: {} })
    ).rejects.toThrow();
  }, 10_000);

  it('healthCheck returns false when server unreachable', async () => {
    const healthy = await client.healthCheck();
    expect(healthy).toBe(false);
  }, 10_000);

  it('getStatus returns null when server unreachable', async () => {
    const status = await client.getStatus();
    expect(status).toBeNull();
  }, 10_000);

  it('getConfigResults returns null when server unreachable', async () => {
    const config = await client.getConfigResults();
    expect(config).toBeNull();
  }, 10_000);

  it('clearConfigResults returns false when server unreachable', async () => {
    const cleared = await client.clearConfigResults();
    expect(cleared).toBe(false);
  }, 10_000);

  it('getBuildStatus returns null when server unreachable', async () => {
    const status = await client.getBuildStatus();
    expect(status).toBeNull();
  }, 10_000);

  it('getLockdownStatus returns null when server unreachable', async () => {
    const status = await client.getLockdownStatus();
    expect(status).toBeNull();
  }, 10_000);

  it('liftLockdown returns false when server unreachable', async () => {
    const result = await client.liftLockdown();
    expect(result).toBe(false);
  }, 10_000);

  it('sendDaemonHeartbeat returns false when server unreachable', async () => {
    const result = await client.sendDaemonHeartbeat();
    expect(result).toBe(false);
  }, 10_000);

  it('enterDaemonUpdateMode returns false when server unreachable', async () => {
    const result = await client.enterDaemonUpdateMode('test-token');
    expect(result).toBe(false);
  }, 10_000);

  it('exitDaemonUpdateMode returns false when server unreachable', async () => {
    const result = await client.exitDaemonUpdateMode('test-token');
    expect(result).toBe(false);
  }, 10_000);

  it('reportTamperAlert returns false when server unreachable', async () => {
    const result = await client.reportTamperAlert([{ file: 'test.ts' }], 'test');
    expect(result).toBe(false);
  }, 10_000);
});

// ============================================================================
// SECTION 4: Batch operations
// ============================================================================

describe('BridgeClient batch', () => {
  const client = new BridgeClient(1, 'test-token');

  it('sendBatch throws when server has bad port', async () => {
    await expect(
      client.sendBatch([
        { type: 'get_collections', payload: {} },
        { type: 'get_variables', payload: {} },
      ])
    ).rejects.toThrow();
  }, 10_000);
});
