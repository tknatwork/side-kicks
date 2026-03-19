/**
 * Tamper Routes — Receives tamper alerts from the daemon and
 * manages lockdown state for the orchestration server.
 *
 * Routes:
 *   POST /tamper-alert       — Daemon reports file tampering (auth required)
 *   GET  /lockdown-status    — Query lockdown state (no auth, for UI)
 *   POST /lockdown/lift      — Lift lockdown after integrity re-check (auth required)
 *   POST /daemon/heartbeat   — Daemon heartbeat (auth required)
 *   POST /daemon/update-mode — Enter update mode with token (auth required)
 *   POST /daemon/resume-mode — Exit update mode, resume monitoring (auth required)
 *
 * Architecture:
 *   Tamper daemon → POST /tamper-alert → LockdownManager.engage()
 *                                       → All MCP tools check isLocked()
 *
 *   Heartbeat daemon → POST /daemon/heartbeat → reset heartbeat timer
 *                                              → if missed → lockdown
 *
 *   OTA update → POST /daemon/update-mode → daemon allows file writes
 *   OTA done   → POST /daemon/resume-mode → daemon resumes monitoring
 *
 * @module orchestration-server/tamper-routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { LockdownManager } from '@dsb/core';
import type { TamperEvent, LockdownReason } from '@dsb/core';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface TamperRouterConfig {
  /** Heartbeat timeout in ms. If no heartbeat in this window, lockdown triggers. Default: 15000 (3x daemon interval). */
  readonly heartbeatTimeoutMs?: number;
}

// ============================================================================
// SECTION 2: ROUTER FACTORY
// ============================================================================

/**
 * Create the tamper alert and lockdown router.
 *
 * Returns the router + lockdown manager so the orchestration server
 * and MCP tools can check lockdown status.
 *
 * @param auth - Auth middleware for daemon-facing routes.
 * @param config - Optional configuration overrides.
 */
export function createTamperRouter(
  auth: (req: Request, res: Response, next: NextFunction) => void,
  config?: TamperRouterConfig
) {
  const router = Router();
  const lockdown = new LockdownManager();

  const heartbeatTimeoutMs = config?.heartbeatTimeoutMs ?? 15_000;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let lastHeartbeat: number | null = null;

  // Update token management for OTA updates
  let activeUpdateToken: string | null = null;

  // ─── Heartbeat monitoring ───────────────────────────────────────────

  function resetHeartbeatTimer(): void {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
    }

    heartbeatTimer = setTimeout(() => {
      // Daemon heartbeat missed — trigger lockdown
      if (!lockdown.isLocked()) {
        lockdown.engage('daemon_killed');
      }
    }, heartbeatTimeoutMs);
  }

  // ─── POST /tamper-alert — Daemon reports tampering ──────────────────

  router.post('/tamper-alert', auth, (req: Request, res: Response) => {
    const { events, reason } = req.body;

    const tamperEvents: TamperEvent[] = Array.isArray(events) ? events : [];
    const lockdownReason: LockdownReason = reason || 'file_tampered';

    lockdown.engage(lockdownReason, tamperEvents);

    res.json({
      ok: true,
      locked: true,
      message: 'Lockdown engaged.',
      reason: lockdownReason,
      affectedFiles: tamperEvents.map((e: TamperEvent) => e.relativePath),
    });
  });

  // ─── GET /lockdown-status — Query current lockdown state ────────────

  router.get('/lockdown-status', (_req: Request, res: Response) => {
    const state = lockdown.getState();
    res.json({
      ...state,
      lastHeartbeat: lastHeartbeat ? new Date(lastHeartbeat).toISOString() : null,
      updateModeActive: activeUpdateToken !== null,
    });
  });

  // ─── POST /lockdown/lift — Lift lockdown after re-verification ──────

  router.post('/lockdown/lift', auth, (_req: Request, res: Response) => {
    if (!lockdown.isLocked()) {
      res.json({ ok: true, message: 'System is not locked.' });
      return;
    }

    lockdown.lift();

    res.json({
      ok: true,
      locked: false,
      message: 'Lockdown lifted. System operational.',
    });
  });

  // ─── POST /daemon/heartbeat — Daemon sends periodic heartbeat ───────

  router.post('/daemon/heartbeat', auth, (_req: Request, res: Response) => {
    lastHeartbeat = Date.now();
    resetHeartbeatTimer();

    res.json({
      ok: true,
      timestamp: new Date(lastHeartbeat).toISOString(),
    });
  });

  // ─── POST /daemon/update-mode — Enter update mode with token ────────

  router.post('/daemon/update-mode', auth, (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "token" field.' });
      return;
    }

    if (activeUpdateToken) {
      res.status(409).json({
        error: 'Update mode already active. Complete or cancel current update first.',
      });
      return;
    }

    activeUpdateToken = token;

    res.json({
      ok: true,
      message: 'Update mode activated. Tamper monitoring paused for verified update.',
      token,
    });
  });

  // ─── POST /daemon/resume-mode — Exit update mode ────────────────────

  router.post('/daemon/resume-mode', auth, (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "token" field.' });
      return;
    }

    if (token !== activeUpdateToken) {
      res.status(403).json({
        error: 'Token mismatch. Cannot exit update mode with wrong token.',
      });
      return;
    }

    activeUpdateToken = null;

    res.json({
      ok: true,
      message: 'Update mode deactivated. Tamper monitoring resumed.',
    });
  });

  // ─── Return router + control handle ─────────────────────────────────

  return {
    router,

    /** The lockdown manager — check isLocked() before MCP tool execution. */
    lockdown,

    /** Get the active update token (for daemon communication). */
    getUpdateToken(): string | null {
      return activeUpdateToken;
    },

    /** Stop heartbeat monitoring (server shutdown). */
    destroy(): void {
      if (heartbeatTimer) {
        clearTimeout(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  };
}
