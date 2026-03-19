/**
 * Telemetry Routes — Receives anonymized usage events from the
 * config UI and build pipeline, buffers them, and forwards to
 * the DSB analytics endpoint.
 *
 * Routes:
 *   POST /telemetry — Receive telemetry events (no auth, localhost).
 *
 * Architecture:
 *   Browser UI events ──→ POST /telemetry
 *   Build pipeline events ──→ POST /telemetry
 *                                 |
 *                              Buffer (in-memory, flush every 60s)
 *                                 |
 *                              HTTPS POST to DSB analytics endpoint
 *
 * Opt-out behavior: Events are accepted but silently discarded
 * when telemetry is disabled. The route always returns 200 so
 * the UI doesn't need to handle opt-out logic.
 *
 * @module orchestration-server/telemetry-routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { TelemetryCollector } from '@dsb/core';
import type { TelemetryEvent } from '@dsb/core';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface TelemetryRouterConfig {
  /** URL to forward events to (DSB analytics endpoint). */
  readonly analyticsEndpoint: string;
  /** Flush interval in ms (default: 60000). */
  readonly flushIntervalMs?: number;
  /** Maximum events to buffer (default: 100). */
  readonly maxBufferSize?: number;
  /** Whether telemetry is opted in (default: false). */
  readonly optedIn?: boolean;
}

// ============================================================================
// SECTION 2: ROUTER FACTORY
// ============================================================================

/**
 * Create the telemetry router.
 *
 * Returns both the router and a control handle so the orchestration
 * server can start/stop the collector and toggle opt-in.
 */
export function createTelemetryRouter(config: TelemetryRouterConfig) {
  const router = Router();

  const collector = new TelemetryCollector({
    endpoint: config.analyticsEndpoint,
    flushIntervalMs: config.flushIntervalMs,
    maxBufferSize: config.maxBufferSize,
  });

  // Start the collector (opt-in controlled separately)
  collector.start(config.optedIn ?? false);

  // ─── POST /telemetry — Receive events ───────────────────────────────

  router.post('/telemetry', (req: Request, res: Response) => {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      res.status(400).json({ error: 'Missing or invalid "events" array.' });
      return;
    }

    // Validate each event has required fields
    let accepted = 0;
    for (const event of events) {
      if (isValidEvent(event)) {
        collector.collect(event as TelemetryEvent);
        accepted++;
      }
    }

    res.json({
      ok: true,
      accepted,
      total: events.length,
      stats: collector.getStats(),
    });
  });

  // ─── Control Handle ─────────────────────────────────────────────────

  return {
    router,

    /** Update opt-in status at runtime (user toggle). */
    setOptedIn(optedIn: boolean): void {
      collector.setOptedIn(optedIn);
    },

    /** Stop the collector (server shutdown). */
    async stop(): Promise<void> {
      await collector.stop();
    },

    /** Get collector stats. */
    getStats() {
      return collector.getStats();
    },
  };
}

// ============================================================================
// SECTION 3: VALIDATION
// ============================================================================

/**
 * Basic event shape validation.
 *
 * We don't validate deeply — just ensure required fields exist.
 * The analytics endpoint does full validation.
 */
function isValidEvent(event: unknown): boolean {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    typeof e.sessionId === 'string' &&
    typeof e.category === 'string' &&
    typeof e.event === 'string' &&
    typeof e.timestamp === 'string'
  );
}
