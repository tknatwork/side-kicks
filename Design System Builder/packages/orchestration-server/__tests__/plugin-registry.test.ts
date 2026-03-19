import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginRegistry } from '../src/plugin-registry';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new PluginRegistry();
  });

  afterEach(() => {
    registry.destroy();
    vi.useRealTimers();
  });

  describe('register', () => {
    it('registers a new plugin', () => {
      const reg = registry.register('test-plugin');
      expect(reg.pluginId).toBe('test-plugin');
      expect(reg.connected).toBe(true);
    });

    it('refreshes an existing registration', () => {
      const first = registry.register('test-plugin');
      const firstTime = first.lastHeartbeat;

      vi.advanceTimersByTime(1000);

      const second = registry.register('test-plugin');
      expect(second.lastHeartbeat).toBeGreaterThan(firstTime);
      expect(second.connected).toBe(true);
    });
  });

  describe('heartbeat', () => {
    it('updates heartbeat timestamp', () => {
      registry.register('test-plugin');
      vi.advanceTimersByTime(1000);

      const updated = registry.heartbeat('test-plugin');
      expect(updated).toBe(true);
    });

    it('returns false for unregistered plugin', () => {
      expect(registry.heartbeat('unknown')).toBe(false);
    });
  });

  describe('hasConnectedPlugin', () => {
    it('returns false with no plugins', () => {
      expect(registry.hasConnectedPlugin()).toBe(false);
    });

    it('returns true with a connected plugin', () => {
      registry.register('test-plugin');
      expect(registry.hasConnectedPlugin()).toBe(true);
    });

    it('returns false after heartbeat timeout', () => {
      registry.register('test-plugin');
      expect(registry.hasConnectedPlugin()).toBe(true);

      // Advance past heartbeat timeout (15s) + cleanup interval (10s)
      vi.advanceTimersByTime(25_000);

      expect(registry.hasConnectedPlugin()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('reports connected plugins', () => {
      registry.register('plugin-a');
      registry.register('plugin-b');

      const status = registry.getStatus();
      expect(status.pluginCount).toBe(2);
      expect(status.connectedPlugins).toHaveLength(2);
    });

    it('excludes disconnected plugins from connected list', () => {
      registry.register('plugin-a');
      registry.register('plugin-b');

      // Advance past timeout for all
      vi.advanceTimersByTime(25_000);

      // Only refresh plugin-a
      registry.register('plugin-a');

      const status = registry.getStatus();
      expect(status.pluginCount).toBe(2);
      expect(status.connectedPlugins).toHaveLength(1);
      expect(status.connectedPlugins[0].pluginId).toBe('plugin-a');
    });
  });

  describe('destroy', () => {
    it('clears all plugins', () => {
      registry.register('plugin-a');
      registry.destroy();

      expect(registry.hasConnectedPlugin()).toBe(false);
    });
  });
});
