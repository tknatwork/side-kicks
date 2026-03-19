/**
 * Telemetry Collector — In-memory event buffer with periodic flush.
 *
 * Events are collected in memory and flushed to the orchestration
 * server's `/telemetry` endpoint every 60 seconds. The orchestration
 * server then forwards them to the DSB analytics endpoint.
 *
 * If telemetry is opted out, the collector accepts events but
 * discards them immediately — nothing is sent or stored.
 *
 * @module core/telemetry/collector
 */

import type { TelemetryEvent } from './events';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface CollectorConfig {
  /** URL to POST events to (orchestration server /telemetry route). */
  readonly endpoint: string;
  /** Flush interval in ms (default: 60000 = 60s). */
  readonly flushIntervalMs?: number;
  /** Maximum events to buffer before forcing a flush (default: 100). */
  readonly maxBufferSize?: number;
}

export interface CollectorStats {
  /** Total events collected this session. */
  readonly totalCollected: number;
  /** Total events successfully flushed. */
  readonly totalFlushed: number;
  /** Events currently in buffer. */
  readonly buffered: number;
  /** Whether telemetry is opted in. */
  readonly optedIn: boolean;
}

// ============================================================================
// SECTION 2: COLLECTOR
// ============================================================================

export class TelemetryCollector {
  private readonly config: Required<CollectorConfig>;
  private buffer: TelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private optedIn = false;

  private totalCollected = 0;
  private totalFlushed = 0;

  constructor(config: CollectorConfig) {
    this.config = {
      flushIntervalMs: 60_000,
      maxBufferSize: 100,
      ...config,
    };
  }

  /**
   * Start the collector with periodic flushing.
   *
   * @param optedIn - Whether the user has opted into telemetry.
   */
  start(optedIn: boolean): void {
    this.optedIn = optedIn;

    if (this.flushTimer) return; // Already started

    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {
        // Silently ignore flush failures — telemetry should never
        // interfere with the user's workflow
      });
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop the collector. Flushes remaining events.
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  /**
   * Update opt-in status (user can toggle anytime).
   */
  setOptedIn(optedIn: boolean): void {
    this.optedIn = optedIn;

    if (!optedIn) {
      // Clear buffer — respect the user's choice immediately
      this.buffer = [];
    }
  }

  /**
   * Collect a telemetry event.
   *
   * If opted out, the event is silently discarded.
   * If the buffer is full, forces an immediate flush.
   */
  collect(event: TelemetryEvent): void {
    this.totalCollected++;

    if (!this.optedIn) return; // Silently discard

    this.buffer.push(event);

    // Force flush if buffer is full
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.flush().catch(() => {});
    }
  }

  /**
   * Flush buffered events to the orchestration server.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    if (!this.optedIn) {
      this.buffer = [];
      return;
    }

    const events = [...this.buffer];
    this.buffer = [];

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        this.totalFlushed += events.length;
      } else {
        // Put events back in buffer for retry (up to max size)
        const remaining = this.config.maxBufferSize - this.buffer.length;
        this.buffer.push(...events.slice(0, remaining));
      }
    } catch {
      // Network error — put events back for retry
      const remaining = this.config.maxBufferSize - this.buffer.length;
      this.buffer.push(...events.slice(0, remaining));
    }
  }

  /**
   * Get collector stats.
   */
  getStats(): CollectorStats {
    return {
      totalCollected: this.totalCollected,
      totalFlushed: this.totalFlushed,
      buffered: this.buffer.length,
      optedIn: this.optedIn,
    };
  }
}
