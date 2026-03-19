/**
 * Lockdown — State management for tamper-triggered system lockdown.
 *
 * When the tamper daemon detects unauthorized file changes:
 *   1. Lockdown activates — all MCP tools refuse to operate
 *   2. Build pipeline halts (checkpoint saved first)
 *   3. User must run `dsb_system_check` to diagnose and lift lockdown
 *
 * Lockdown state is in-memory (held by orchestration server).
 * If the orchestration server restarts, lockdown resets — the daemon
 * will re-detect any persistent tampering and re-trigger if needed.
 *
 * @module core/monitoring/lockdown
 */

import type { TamperEvent } from './tamper-daemon';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type LockdownReason =
  | 'file_tampered'
  | 'daemon_killed'
  | 'daemon_integrity'
  | 'manifest_tampered'
  | 'manual';

export interface LockdownState {
  /** Whether the system is currently locked down. */
  readonly locked: boolean;
  /** Why lockdown was triggered. */
  readonly reason?: LockdownReason;
  /** When lockdown was triggered. */
  readonly lockedAt?: string;
  /** Tamper events that caused the lockdown. */
  readonly events: readonly TamperEvent[];
  /** Number of times lockdown has been triggered this session. */
  readonly lockdownCount: number;
}

// ============================================================================
// SECTION 2: LOCKDOWN MANAGER
// ============================================================================

export class LockdownManager {
  private locked = false;
  private reason: LockdownReason | undefined;
  private lockedAt: string | undefined;
  private events: TamperEvent[] = [];
  private lockdownCount = 0;

  /**
   * Trigger lockdown.
   *
   * @param reason - Why lockdown was triggered.
   * @param tamperEvents - Optional tamper events that caused it.
   */
  engage(reason: LockdownReason, tamperEvents?: readonly TamperEvent[]): void {
    if (this.locked) return; // Already locked

    this.locked = true;
    this.reason = reason;
    this.lockedAt = new Date().toISOString();
    this.lockdownCount++;

    if (tamperEvents) {
      this.events.push(...tamperEvents);
    }
  }

  /**
   * Lift lockdown after successful integrity re-verification.
   *
   * Only called by `dsb_system_check` after confirming all
   * file hashes match the manifest.
   */
  lift(): void {
    this.locked = false;
    this.reason = undefined;
    this.lockedAt = undefined;
    this.events = [];
  }

  /**
   * Check if the system is currently locked down.
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get the full lockdown state (for status reporting).
   */
  getState(): LockdownState {
    return {
      locked: this.locked,
      reason: this.reason,
      lockedAt: this.lockedAt,
      events: [...this.events],
      lockdownCount: this.lockdownCount,
    };
  }

  /**
   * Format lockdown as an MCP tool error response.
   *
   * All MCP tools call this when lockdown is active to return
   * a standardized error message.
   */
  formatError(): { content: Array<{ type: 'text'; text: string }> } {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: 'System locked — unauthorized file modification detected.',
          reason: this.reason,
          lockedAt: this.lockedAt,
          affectedFiles: this.events.map(e => e.relativePath),
          action: 'Run dsb_system_check to diagnose and attempt recovery.',
        }, null, 2),
      }],
    };
  }
}
