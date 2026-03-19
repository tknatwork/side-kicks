import { describe, it, expect, afterAll } from 'vitest';
import { createServer } from '../src/server';
import type { ServerConfig } from '../src/server';

/**
 * Tests for orchestration-server createServer factory.
 *
 * NOTE: The sandbox environment does not allow binding to network ports,
 * so we test the server factory output (shape, components, configuration)
 * without calling server.start(). HTTP route tests require a real
 * environment (run separately with `pnpm test:integration`).
 */

const TEST_TOKEN = 'test-session-token-12345';

const defaultConfig: ServerConfig = {
  port: 19877,
  sessionToken: TEST_TOKEN,
  enableWebSocket: false,
  telemetryEndpoint: 'https://analytics.dsb.example/events',
  telemetryOptedIn: false,
};

describe('orchestration-server createServer', () => {
  const servers: ReturnType<typeof createServer>[] = [];

  afterAll(async () => {
    for (const s of servers) {
      try { await s.stop(); } catch { /* ok */ }
    }
  });

  function makeServer(overrides?: Partial<ServerConfig>) {
    const s = createServer({ ...defaultConfig, ...overrides });
    servers.push(s);
    return s;
  }

  // ─── Factory output shape ──────────────────────────────────────────

  describe('factory output', () => {
    it('returns an object with expected properties', () => {
      const s = makeServer();
      expect(s.app).toBeDefined();
      expect(s.httpServer).toBeDefined();
      expect(s.queue).toBeDefined();
      expect(s.registry).toBeDefined();
      expect(s.lockdown).toBeDefined();
      expect(typeof s.start).toBe('function');
      expect(typeof s.stop).toBe('function');
    });

    it('returns telemetry control handle', () => {
      const s = makeServer();
      expect(s.telemetry).toBeDefined();
      expect(typeof s.telemetry.setOptedIn).toBe('function');
      expect(typeof s.telemetry.getStats).toBe('function');
    });

    it('returns getUpdateToken function', () => {
      const s = makeServer();
      expect(typeof s.getUpdateToken).toBe('function');
      expect(s.getUpdateToken()).toBeNull();
    });

    it('queue starts empty', () => {
      const s = makeServer();
      const stats = s.queue.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.totalEnqueued).toBe(0);
    });

    it('registry starts with no plugins', () => {
      const s = makeServer();
      expect(s.registry.hasConnectedPlugin()).toBe(false);
    });

    it('lockdown starts unlocked', () => {
      const s = makeServer();
      expect(s.lockdown.isLocked()).toBe(false);
    });
  });

  // ─── WebSocket configuration ────────────────────────────────────────

  describe('WebSocket configuration', () => {
    it('creates WSS when enableWebSocket is true', () => {
      const s = makeServer({ enableWebSocket: true });
      expect(s.wss).toBeDefined();
    });

    it('creates WSS when enableWebSocket is undefined (default)', () => {
      const config = { ...defaultConfig };
      delete (config as Record<string, unknown>)['enableWebSocket'];
      const s = createServer(config);
      servers.push(s);
      // Default is true (enableWebSocket !== false)
      expect(s.wss).toBeDefined();
    });

    it('does not create WSS when enableWebSocket is false', () => {
      const s = makeServer({ enableWebSocket: false });
      expect(s.wss).toBeNull();
    });
  });

  // ─── Queue integration ─────────────────────────────────────────────

  describe('queue operations via server handle', () => {
    it('enqueues and dequeues commands through the queue', () => {
      const s = makeServer();
      s.queue.enqueueAsync({
        id: 'test-1',
        type: 'get_file_info',
        payload: {},
        enqueuedAt: Date.now(),
      });

      const stats = s.queue.getStats();
      expect(stats.pending).toBe(1);

      const batch = s.queue.dequeue(5);
      expect(batch).toHaveLength(1);
      expect(batch[0].id).toBe('test-1');
    });

    it('resolves commands through the queue', () => {
      const s = makeServer();
      s.queue.enqueueAsync({
        id: 'resolve-test',
        type: 'test',
        payload: {},
        enqueuedAt: Date.now(),
      });
      s.queue.dequeue(1);

      s.queue.resolve({
        commandId: 'resolve-test',
        success: true,
        data: { ok: true },
        completedAt: Date.now(),
      });

      const result = s.queue.getResult('resolve-test');
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
    });
  });

  // ─── Registry integration ──────────────────────────────────────────

  describe('registry operations via server handle', () => {
    it('registers plugins', () => {
      const s = makeServer();
      s.registry.register('test-plugin');
      expect(s.registry.hasConnectedPlugin()).toBe(true);
    });

    it('reports plugin status', () => {
      const s = makeServer();
      s.registry.register('plugin-a');
      s.registry.register('plugin-b');

      const status = s.registry.getStatus();
      expect(status.pluginCount).toBe(2);
    });
  });

  // ─── Lockdown integration ──────────────────────────────────────────

  describe('lockdown via server handle', () => {
    it('engages and lifts lockdown', () => {
      const s = makeServer();
      expect(s.lockdown.isLocked()).toBe(false);

      s.lockdown.engage('file_tampered');
      expect(s.lockdown.isLocked()).toBe(true);

      s.lockdown.lift();
      expect(s.lockdown.isLocked()).toBe(false);
    });
  });

  // ─── Stop/cleanup ──────────────────────────────────────────────────

  describe('server stop', () => {
    it('clears queue and registry on stop', async () => {
      const s = makeServer();
      s.queue.enqueueAsync({ id: 'x', type: 't', payload: {}, enqueuedAt: Date.now() });
      s.registry.register('p1');

      await s.stop();

      expect(s.queue.getStats().pending).toBe(0);
      expect(s.registry.hasConnectedPlugin()).toBe(false);
    });
  });
});
