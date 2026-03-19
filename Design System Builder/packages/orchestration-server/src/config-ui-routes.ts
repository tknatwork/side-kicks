/**
 * Config UI Routes — Serves the visual configuration wizard and
 * handles encrypted config submission from the browser.
 *
 * Routes:
 *   GET    /config-ui       — Serve the HTML wizard (no auth, browser access)
 *   POST   /config-results  — Receive encrypted config from UI (no auth)
 *   GET    /config-results  — Claude polls for submitted config (auth required)
 *   DELETE /config-results  — Claude clears after reading (auth required)
 *   POST   /validate-license — UI submits license key for validation (no auth)
 *
 * Security:
 *   - Browser-facing routes (GET /config-ui, POST /config-results,
 *     POST /validate-license) skip auth because browsers can't send
 *     Bearer tokens. These are localhost-only.
 *   - MCP-facing routes (GET /config-results, DELETE /config-results)
 *     require Bearer token auth.
 *   - Config is encrypted (AES-256-GCM) before the browser POSTs it.
 *     The orchestration server stores the encrypted blob — never plaintext.
 *
 * @module orchestration-server/config-ui-routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DSB_ROOT } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** Encrypted config blob as submitted by the browser. */
interface EncryptedConfigPayload {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
  readonly algorithm: 'aes-256-gcm';
}

/** Stored session: encrypted config + metadata. */
interface ConfigSession {
  readonly config: EncryptedConfigPayload;
  readonly submittedAt: number;
  readonly expiresAt: number;
}

/** License validation result returned to the UI. */
interface LicenseValidationResult {
  readonly valid: boolean;
  readonly tier?: string;
  readonly message: string;
}

// ============================================================================
// SECTION 2: ROUTER FACTORY
// ============================================================================

/** Session expiry: 30 minutes. */
const SESSION_EXPIRY_MS = 30 * 60 * 1000;

/**
 * Create the config UI router.
 *
 * @param auth - Auth middleware for MCP-facing routes.
 * @returns Express Router with config UI routes mounted.
 */
export function createConfigUiRouter(
  auth: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();

  // In-memory storage: one active session at a time
  let activeSession: ConfigSession | null = null;

  // ─── GET /config-ui — Serve the HTML wizard ──────────────────────────

  router.get('/config-ui', (_req: Request, res: Response) => {
    const htmlPath = path.join(DSB_ROOT, 'workspace', 'temp', 'config-ui.html');

    if (!fs.existsSync(htmlPath)) {
      res.status(404).json({
        error: 'Config UI not generated yet. Run dsb_open_config_ui first.',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');

    const stream = fs.createReadStream(htmlPath);
    stream.pipe(res);

    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read config UI HTML.' });
      }
    });
  });

  // ─── POST /config-results — Receive encrypted config from UI ────────

  router.post('/config-results', (req: Request, res: Response) => {
    const { ciphertext, iv, authTag, algorithm } = req.body;

    // Validate required fields
    if (!ciphertext || !iv || !authTag) {
      res.status(400).json({
        error: 'Missing required encryption fields: ciphertext, iv, authTag.',
      });
      return;
    }

    if (algorithm && algorithm !== 'aes-256-gcm') {
      res.status(400).json({
        error: 'Unsupported algorithm. Expected aes-256-gcm.',
      });
      return;
    }

    // Store encrypted config (replaces any existing session)
    const now = Date.now();
    activeSession = {
      config: { ciphertext, iv, authTag, algorithm: 'aes-256-gcm' },
      submittedAt: now,
      expiresAt: now + SESSION_EXPIRY_MS,
    };

    res.json({
      ok: true,
      message: 'Config received. Claude will process it shortly.',
      expiresIn: SESSION_EXPIRY_MS,
    });
  });

  // ─── GET /config-results — Claude polls for submitted config ────────

  router.get('/config-results', auth, (_req: Request, res: Response) => {
    // Check if session exists and hasn't expired
    if (!activeSession) {
      res.json({ available: false, message: 'No config submitted yet.' });
      return;
    }

    if (Date.now() > activeSession.expiresAt) {
      activeSession = null;
      res.json({ available: false, message: 'Config session expired.' });
      return;
    }

    res.json({
      available: true,
      config: activeSession.config,
      submittedAt: activeSession.submittedAt,
    });
  });

  // ─── DELETE /config-results — Claude clears after reading ───────────

  router.delete('/config-results', auth, (_req: Request, res: Response) => {
    const had = activeSession !== null;
    activeSession = null;

    res.json({
      ok: true,
      cleared: had,
      message: had ? 'Config session cleared.' : 'No active session to clear.',
    });
  });

  // ─── POST /validate-license — UI submits license key ────────────────

  router.post('/validate-license', async (req: Request, res: Response) => {
    const { licenseKey } = req.body;

    if (!licenseKey || typeof licenseKey !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid "licenseKey" field.',
      });
      return;
    }

    try {
      // Dynamic import to avoid circular dependency at module level.
      const { verifyLicense } = await import('@dsb/licensing');
      const result = await verifyLicense(licenseKey);

      const response: LicenseValidationResult = result.ok
        ? {
            valid: result.value.valid,
            tier: result.value.tier,
            message: result.value.valid
              ? `License valid. Tier: ${result.value.tier}.`
              : 'Invalid license key.',
          }
        : {
            valid: false,
            tier: 'free',
            message: result.error,
          };

      res.json(response);
    } catch {
      // Licensing package not available or validation threw
      res.status(500).json({
        valid: false,
        message: 'License validation service unavailable. Please try again.',
      });
    }
  });

  return router;
}
