/**
 * Command Queue — Thread-safe command queue for orchestrating
 * MCP server → plugin communication.
 *
 * Commands are enqueued by the MCP server (via HTTP POST or WebSocket),
 * dequeued by the Figma plugin (via HTTP GET polling), and results
 * flow back through the same channel.
 *
 * @module orchestration-server/command-queue
 */

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface QueuedCommand {
  readonly id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly enqueuedAt: number;
}

export interface CommandResult {
  readonly commandId: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly completedAt: number;
}

export interface QueueStats {
  readonly pending: number;
  readonly processing: number;
  readonly completed: number;
  readonly failed: number;
  readonly totalEnqueued: number;
}

import { ResultCache } from './result-cache';

type ResultResolver = (result: CommandResult) => void;

// ============================================================================
// SECTION 2: COMMAND QUEUE IMPLEMENTATION
// ============================================================================

export class CommandQueue {
  private pending: QueuedCommand[] = [];
  private processing: Map<string, QueuedCommand> = new Map();
  private resultCache: ResultCache;
  private waiters: Map<string, ResultResolver> = new Map();
  private totalEnqueued: number = 0;
  private totalCompleted: number = 0;
  private totalFailed: number = 0;

  /**
   * Timeout for waiting on command results (ms).
   */
  private readonly commandTimeoutMs: number;

  constructor(options?: { maxResultHistory?: number; commandTimeoutMs?: number }) {
    this.commandTimeoutMs = options?.commandTimeoutMs ?? 120_000; // 2 minutes
    this.resultCache = new ResultCache();
  }

  /**
   * Enqueue a command for the plugin to execute.
   * Returns a promise that resolves when the plugin returns the result.
   */
  enqueue(command: QueuedCommand): Promise<CommandResult> {
    this.pending.push(command);
    this.totalEnqueued++;

    return new Promise<CommandResult>((resolve, reject) => {
      this.waiters.set(command.id, resolve);

      // Timeout protection
      setTimeout(() => {
        if (this.waiters.has(command.id)) {
          this.waiters.delete(command.id);
          this.processing.delete(command.id);

          const timeoutResult: CommandResult = {
            commandId: command.id,
            success: false,
            error: `Command "${command.type}" timed out after ${this.commandTimeoutMs}ms.`,
            completedAt: Date.now(),
          };
          this.totalFailed++;
          resolve(timeoutResult);
        }
      }, this.commandTimeoutMs);
    });
  }

  /**
   * Enqueue a command without waiting for the result (fire-and-forget).
   */
  enqueueAsync(command: QueuedCommand): void {
    this.pending.push(command);
    this.totalEnqueued++;
  }

  /**
   * Dequeue up to `maxCount` commands for the plugin to process.
   * Moves them from pending → processing.
   */
  dequeue(maxCount: number = 10): QueuedCommand[] {
    const batch = this.pending.splice(0, maxCount);

    for (const cmd of batch) {
      this.processing.set(cmd.id, cmd);
    }

    return batch;
  }

  /**
   * Record the result of a command execution.
   * Resolves the waiter if one exists.
   */
  resolve(result: CommandResult): void {
    this.processing.delete(result.commandId);

    // Store in TTL + size-aware cache
    this.resultCache.set(result.commandId, result);

    if (result.success) {
      this.totalCompleted++;
    } else {
      this.totalFailed++;
    }

    // Resolve the waiter
    const waiter = this.waiters.get(result.commandId);
    if (waiter) {
      this.waiters.delete(result.commandId);
      waiter(result);
    }
  }

  /**
   * Get result for a specific command (from history).
   */
  getResult(commandId: string): CommandResult | undefined {
    return this.resultCache.get(commandId);
  }

  /**
   * Get current queue statistics.
   */
  getStats(): QueueStats {
    return {
      pending: this.pending.length,
      processing: this.processing.size,
      completed: this.totalCompleted,
      failed: this.totalFailed,
      totalEnqueued: this.totalEnqueued,
    };
  }

  /**
   * Check if there are any pending or processing commands.
   */
  hasWork(): boolean {
    return this.pending.length > 0 || this.processing.size > 0;
  }

  /** Number of pending commands in the queue. */
  getQueueDepth(): number {
    return this.pending.length;
  }

  /** Number of commands currently being processed. */
  getProcessingCount(): number {
    return this.processing.size;
  }

  /** True if the queue has backpressure (>50 pending). */
  hasBackpressure(): boolean {
    return this.pending.length > 50;
  }

  /**
   * Clear all pending commands (emergency stop).
   * Processing commands are left to complete or timeout.
   */
  clearPending(): number {
    const count = this.pending.length;
    this.pending = [];
    return count;
  }

  /**
   * Reset entire queue state.
   */
  reset(): void {
    // Reject all waiters
    for (const [cmdId, resolver] of this.waiters) {
      resolver({
        commandId: cmdId,
        success: false,
        error: 'Queue was reset.',
        completedAt: Date.now(),
      });
    }

    this.pending = [];
    this.processing.clear();
    this.resultCache.clear();
    this.waiters.clear();
    this.totalEnqueued = 0;
    this.totalCompleted = 0;
    this.totalFailed = 0;
  }

  /** Get cache statistics for monitoring. */
  getCacheStats() {
    return this.resultCache.getStats();
  }

  /** Clear all cached results (keeps sweep timer running). */
  clearCache(): void {
    this.resultCache.clear();
  }

  /** Destroy the result cache (call on server shutdown). */
  destroyCache(): void {
    this.resultCache.destroy();
  }
}
