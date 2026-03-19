/**
 * Plugin Registry — Tracks connected Figma plugin instances.
 *
 * Handles registration, heartbeat tracking, and connection state.
 *
 * @module orchestration-server/plugin-registry
 */

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface PluginRegistration {
  readonly pluginId: string;
  readonly registeredAt: number;
  lastHeartbeat: number;
  connected: boolean;
}

export interface RegistryStatus {
  readonly pluginCount: number;
  readonly connectedPlugins: readonly PluginRegistration[];
}

// ============================================================================
// SECTION 2: REGISTRY IMPLEMENTATION
// ============================================================================

/**
 * Heartbeat timeout — if no heartbeat received within this window,
 * the plugin is considered disconnected.
 */
const HEARTBEAT_TIMEOUT_MS = 15_000; // 3x the plugin's 5s heartbeat interval

export class PluginRegistry {
  private plugins: Map<string, PluginRegistration> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodically check for stale connections
    this.cleanupTimer = setInterval(() => this.cleanup(), 10_000);
  }

  /**
   * Register or refresh a plugin connection.
   */
  register(pluginId: string): PluginRegistration {
    const now = Date.now();
    const existing = this.plugins.get(pluginId);

    if (existing) {
      existing.lastHeartbeat = now;
      existing.connected = true;
      return existing;
    }

    const registration: PluginRegistration = {
      pluginId,
      registeredAt: now,
      lastHeartbeat: now,
      connected: true,
    };

    this.plugins.set(pluginId, registration);
    return registration;
  }

  /**
   * Update heartbeat for a plugin.
   */
  heartbeat(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    plugin.lastHeartbeat = Date.now();
    plugin.connected = true;
    return true;
  }

  /**
   * Check if any plugin is connected.
   */
  hasConnectedPlugin(): boolean {
    for (const plugin of this.plugins.values()) {
      if (plugin.connected) return true;
    }
    return false;
  }

  /**
   * Get a specific plugin's registration.
   */
  getPlugin(pluginId: string): PluginRegistration | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get current registry status.
   */
  getStatus(): RegistryStatus {
    const connected: PluginRegistration[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.connected) {
        connected.push(plugin);
      }
    }
    return {
      pluginCount: this.plugins.size,
      connectedPlugins: connected,
    };
  }

  /**
   * Remove stale connections.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, plugin] of this.plugins) {
      if (plugin.connected && (now - plugin.lastHeartbeat) > HEARTBEAT_TIMEOUT_MS) {
        plugin.connected = false;
      }
    }
  }

  /**
   * Shut down the registry.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.plugins.clear();
  }
}
