/**
 * Bridge Client — HTTP client for communicating with the orchestration server.
 *
 * Sends commands to the orchestration server and receives results.
 * This is the MCP server's outbound connection to the Figma plugin.
 *
 * Also provides methods for:
 *   - Config UI: polling for config results, clearing config
 *   - Build status: querying build progress
 *   - Telemetry: toggling opt-in
 *   - Tamper/lockdown: querying lockdown state, heartbeats, update mode
 *
 * @module mcp-server/bridge-client
 */

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface BridgeCommand {
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

export interface BridgeResult {
  readonly commandId: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

export interface BridgeStatus {
  readonly queue: {
    readonly pending: number;
    readonly processing: number;
    readonly completed: number;
    readonly failed: number;
  };
  readonly plugins: {
    readonly pluginCount: number;
    readonly connectedPlugins: ReadonlyArray<{ pluginId: string }>;
  };
}

// ============================================================================
// SECTION 2: BRIDGE CLIENT
// ============================================================================

// Allowed port range for the orchestration server. Reject anything
// outside this window so a tampered config file cannot redirect the
// bridge at an arbitrary host:port. The hostname is hard-coded to
// localhost in baseUrl below so only the port is dynamic.
// Defends against CodeQL js/file-access-to-http.
const MIN_BRIDGE_PORT = 1024;
const MAX_BRIDGE_PORT = 65535;

export class BridgeClient {
  private readonly baseUrl: string;
  private readonly sessionToken: string;

  constructor(port: number, sessionToken: string) {
    if (!Number.isInteger(port) || port < MIN_BRIDGE_PORT || port > MAX_BRIDGE_PORT) {
      throw new Error(
        `BridgeClient: port ${port} is outside the allowed range [${MIN_BRIDGE_PORT}, ${MAX_BRIDGE_PORT}]`
      );
    }
    // Hostname is fixed at localhost — the only attacker surface is the
    // port, which we've just validated.
    this.baseUrl = `http://localhost:${port}`;
    this.sessionToken = sessionToken;
  }

  /**
   * Send a single command to the orchestration server.
   * Blocks until the Figma plugin processes and returns the result.
   */
  async sendCommand(command: BridgeCommand): Promise<BridgeResult> {
    const response = await fetch(`${this.baseUrl}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sessionToken}`,
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      return {
        commandId: '',
        success: false,
        error: body.error || `Orchestration server returned ${response.status}`,
      };
    }

    return response.json() as Promise<BridgeResult>;
  }

  /**
   * Send multiple commands as a batch.
   * All commands are enqueued and results returned when all complete.
   */
  async sendBatch(commands: BridgeCommand[]): Promise<BridgeResult[]> {
    const response = await fetch(`${this.baseUrl}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sessionToken}`,
      },
      body: JSON.stringify({ commands }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      return [{
        commandId: '',
        success: false,
        error: body.error || `Batch failed with status ${response.status}`,
      }];
    }

    const data = await response.json();
    return data.results as BridgeResult[];
  }

  /**
   * Check orchestration server health and connection status.
   */
  async getStatus(): Promise<BridgeStatus | null> {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        headers: { 'Authorization': `Bearer ${this.sessionToken}` },
      });

      if (!response.ok) return null;
      return response.json() as Promise<BridgeStatus>;
    } catch {
      return null;
    }
  }

  /**
   * Check basic health (no auth required).
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Clear all pending commands (emergency stop).
   */
  async clearQueue(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/queue`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.sessionToken}` },
    });

    if (!response.ok) return 0;
    const data = await response.json();
    return data.cleared ?? 0;
  }

  // ─── Config UI ──────────────────────────────────────────────────────

  /**
   * Poll for config results submitted by the browser UI.
   * Returns the encrypted config blob or null if nothing submitted yet.
   */
  async getConfigResults(): Promise<{ available: boolean; config?: unknown; submittedAt?: number } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/config-results`, {
        headers: { 'Authorization': `Bearer ${this.sessionToken}` },
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * Clear config results after reading.
   */
  async clearConfigResults(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/config-results`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.sessionToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Build Status ───────────────────────────────────────────────────

  /**
   * Get current build progress (no auth, public endpoint).
   */
  async getBuildStatus(): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(`${this.baseUrl}/build-status`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  // ─── Tamper / Lockdown ──────────────────────────────────────────────

  /**
   * Get current lockdown status (no auth, public endpoint).
   */
  async getLockdownStatus(): Promise<{ locked: boolean; reason?: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/lockdown-status`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * Lift lockdown after integrity re-verification.
   */
  async liftLockdown(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/lockdown/lift`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Send a heartbeat on behalf of the daemon (for testing).
   */
  async sendDaemonHeartbeat(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/daemon/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Enter update mode on the daemon (for OTA updates).
   * @param token - Time-limited crypto-random token.
   */
  async enterDaemonUpdateMode(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/daemon/update-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({ token }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Exit update mode on the daemon (after OTA update completes).
   * @param token - Must match the token from enterDaemonUpdateMode.
   */
  async exitDaemonUpdateMode(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/daemon/resume-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({ token }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Report a tamper event to trigger lockdown.
   */
  async reportTamperAlert(events: unknown[], reason?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/tamper-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({ events, reason: reason || 'file_tampered' }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
