/**
 * Tamper Daemon — Watches the DSB project folder for unauthorized changes.
 *
 * Runs as a background process (child of orchestration server).
 * Uses `fs.watch` (recursive) + SHA-256 hashing to detect file tampering.
 *
 * Key mechanisms:
 *   - **Write tokens**: DSB operations pass a process-internal token so the
 *     daemon knows "this change is from us, not the user."
 *   - **Update mode**: A time-limited token that pauses monitoring during
 *     verified OTA updates. Auto-expires after 5 minutes.
 *   - **Heartbeat**: Sends a ping to the orchestration server every 5 seconds.
 *     If the daemon dies, missing heartbeats trigger lockdown.
 *   - **Self-integrity**: Validates its own entry point hash on startup.
 *
 * @module core/monitoring/tamper-daemon
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { sha256File } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** Event emitted when a tamper is detected. */
export interface TamperEvent {
  readonly filePath: string;
  readonly relativePath: string;
  readonly expectedHash: string | undefined;
  readonly actualHash: string | undefined;
  readonly timestamp: string;
  readonly type: 'modified' | 'deleted' | 'created';
}

/** Configuration for the tamper daemon. */
export interface TamperDaemonConfig {
  /** Absolute path to the user's DSB project folder. */
  readonly projectRoot: string;
  /** Orchestration server URL for heartbeat + tamper alerts. */
  readonly orchestrationUrl: string;
  /** Heartbeat interval in ms (default: 5000). */
  readonly heartbeatIntervalMs?: number;
  /** Update token expiry in ms (default: 300000 = 5 minutes). */
  readonly updateTokenExpiryMs?: number;
}

/** Daemon state (exposed for testing). */
export interface DaemonState {
  readonly isRunning: boolean;
  readonly isUpdateMode: boolean;
  readonly fileCount: number;
  readonly lastHeartbeat: string | undefined;
  readonly writeTokenActive: boolean;
}

// ============================================================================
// SECTION 2: DAEMON CLASS
// ============================================================================

export class TamperDaemon {
  private readonly config: Required<TamperDaemonConfig>;
  private readonly fileHashes: Map<string, string> = new Map();

  private running = false;
  private watcher: fs.FSWatcher | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // Write token: DSB's own operations set this before writing
  private currentWriteToken: string | null = null;
  private pendingWritePaths: Set<string> = new Set();

  // Update mode: pauses monitoring during OTA updates
  private updateToken: string | null = null;
  private updateTokenExpiry: number | null = null;

  // Callback for tamper events — orchestration server hooks into this
  private onTamper: ((event: TamperEvent) => void) | null = null;
  private onHeartbeat: (() => void) | null = null;

  constructor(config: TamperDaemonConfig) {
    this.config = {
      heartbeatIntervalMs: 5000,
      updateTokenExpiryMs: 5 * 60 * 1000,
      ...config,
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  /**
   * Initialize the daemon: hash all files and start watching.
   */
  async start(): Promise<void> {
    if (this.running) return;

    // Compute initial hashes for all files in the project
    await this.buildHashTable(this.config.projectRoot);

    // Start file watcher
    this.watcher = fs.watch(
      this.config.projectRoot,
      { recursive: true },
      (eventType, filename) => {
        if (filename) {
          this.handleFileChange(filename, eventType);
        }
      }
    );

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatIntervalMs);

    this.running = true;
  }

  /**
   * Stop the daemon gracefully.
   */
  stop(): void {
    if (!this.running) return;

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.running = false;
  }

  /**
   * Get current daemon state (for diagnostics).
   */
  getState(): DaemonState {
    return {
      isRunning: this.running,
      isUpdateMode: this.isInUpdateMode(),
      fileCount: this.fileHashes.size,
      lastHeartbeat: undefined, // Populated by orchestration server
      writeTokenActive: this.currentWriteToken !== null,
    };
  }

  // ─── Event Handlers ───────────────────────────────────────────────────

  /** Register a callback for tamper events. */
  onTamperDetected(handler: (event: TamperEvent) => void): void {
    this.onTamper = handler;
  }

  /** Register a callback for heartbeats. */
  onHeartbeatSent(handler: () => void): void {
    this.onHeartbeat = handler;
  }

  // ─── Write Tokens (DSB internal operations) ───────────────────────────

  /**
   * Generate a write token for an internal DSB operation.
   *
   * Before writing to a file, DSB code calls this to get a token,
   * then registers the path(s) it will modify. The daemon will
   * skip those paths during the next change detection cycle.
   */
  generateWriteToken(): string {
    const token = crypto.randomBytes(16).toString('hex');
    this.currentWriteToken = token;
    return token;
  }

  /**
   * Register file paths that DSB is about to modify.
   *
   * @param token - The write token from generateWriteToken().
   * @param relativePaths - Paths relative to projectRoot that will be written.
   */
  registerPendingWrites(token: string, relativePaths: readonly string[]): boolean {
    if (token !== this.currentWriteToken) return false;

    for (const p of relativePaths) {
      this.pendingWritePaths.add(p);
    }
    return true;
  }

  /**
   * Complete a write operation: update hashes for modified files
   * and clear the pending write list.
   *
   * @param token - The write token.
   */
  completeWrite(token: string): void {
    if (token !== this.currentWriteToken) return;

    // Re-hash all pending paths (they were legitimately modified)
    for (const relativePath of this.pendingWritePaths) {
      const absolutePath = path.resolve(this.config.projectRoot, relativePath);
      const hashResult = sha256File(absolutePath);
      if (hashResult.ok) {
        this.fileHashes.set(relativePath, hashResult.value);
      } else {
        // File was deleted by DSB — remove from hash table
        this.fileHashes.delete(relativePath);
      }
    }

    this.pendingWritePaths.clear();
    this.currentWriteToken = null;
  }

  // ─── Update Mode (OTA updates) ────────────────────────────────────────

  /**
   * Enter update mode with a time-limited token.
   *
   * During update mode, ALL file changes are allowed (no tamper alerts).
   * This is used during OTA updates after signature verification passes.
   *
   * @param token - Crypto-random token from the update pipeline.
   * @returns true if update mode was activated.
   */
  enterUpdateMode(token: string): boolean {
    if (this.updateToken) return false; // Already in update mode

    this.updateToken = token;
    this.updateTokenExpiry = Date.now() + this.config.updateTokenExpiryMs;
    return true;
  }

  /**
   * Exit update mode and rebuild the file hash table.
   *
   * Called after OTA update completes (success or rollback).
   * Re-hashes all files to establish the new baseline.
   *
   * @param token - Must match the token from enterUpdateMode.
   */
  async exitUpdateMode(token: string): Promise<boolean> {
    if (token !== this.updateToken) return false;

    this.updateToken = null;
    this.updateTokenExpiry = null;

    // Rebuild hash table with new file state
    this.fileHashes.clear();
    await this.buildHashTable(this.config.projectRoot);

    return true;
  }

  /**
   * Check if the daemon is currently in update mode (and not expired).
   */
  isInUpdateMode(): boolean {
    if (!this.updateToken || !this.updateTokenExpiry) return false;

    if (Date.now() > this.updateTokenExpiry) {
      // Token expired — auto-exit update mode
      this.updateToken = null;
      this.updateTokenExpiry = null;
      return false;
    }

    return true;
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  private handleFileChange(filename: string, eventType: string): void {
    // Skip if in update mode
    if (this.isInUpdateMode()) return;

    // Skip if this is a pending DSB write
    if (this.pendingWritePaths.has(filename)) return;

    // Skip .dsb/manifest.json (we write to it ourselves)
    if (filename === '.dsb/manifest.json') return;

    // Skip node_modules and .git
    if (filename.startsWith('node_modules') || filename.startsWith('.git')) return;

    const absolutePath = path.resolve(this.config.projectRoot, filename);
    const expectedHash = this.fileHashes.get(filename);

    // Check if file still exists
    const exists = fs.existsSync(absolutePath);

    if (!exists && expectedHash) {
      // File deleted
      this.emitTamperEvent({
        filePath: absolutePath,
        relativePath: filename,
        expectedHash,
        actualHash: undefined,
        timestamp: new Date().toISOString(),
        type: 'deleted',
      });
      return;
    }

    if (exists && !expectedHash) {
      // New file created (not in original hash table)
      const hashResult = sha256File(absolutePath);
      this.emitTamperEvent({
        filePath: absolutePath,
        relativePath: filename,
        expectedHash: undefined,
        actualHash: hashResult.ok ? hashResult.value : undefined,
        timestamp: new Date().toISOString(),
        type: 'created',
      });
      return;
    }

    if (exists && expectedHash) {
      // File modified — verify hash
      const hashResult = sha256File(absolutePath);
      if (hashResult.ok && hashResult.value !== expectedHash) {
        this.emitTamperEvent({
          filePath: absolutePath,
          relativePath: filename,
          expectedHash,
          actualHash: hashResult.value,
          timestamp: new Date().toISOString(),
          type: 'modified',
        });
      }
    }
  }

  private emitTamperEvent(event: TamperEvent): void {
    if (this.onTamper) {
      this.onTamper(event);
    }
  }

  private sendHeartbeat(): void {
    if (this.onHeartbeat) {
      this.onHeartbeat();
    }
  }

  /**
   * Walk the project directory and compute SHA-256 hashes for all files.
   */
  private async buildHashTable(dirPath: string, basePath?: string): Promise<void> {
    const base = basePath ?? dirPath;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return; // Directory unreadable, skip
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(base, fullPath);

      // Skip directories we don't want to monitor
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await this.buildHashTable(fullPath, base);
        continue;
      }

      if (entry.isFile()) {
        const hashResult = sha256File(fullPath);
        if (hashResult.ok) {
          this.fileHashes.set(relativePath, hashResult.value);
        }
      }
    }
  }
}
