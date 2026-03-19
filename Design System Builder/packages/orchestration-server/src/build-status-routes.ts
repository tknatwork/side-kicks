/**
 * Build Status Routes — Real-time build progress for the config UI.
 *
 * Routes:
 *   GET /build-status — Returns current build state (no auth, localhost).
 *
 * The config UI polls this endpoint after submitting config to show
 * build progress. No auth because the browser can't send Bearer tokens
 * and the endpoint only exposes non-sensitive build progress metadata.
 *
 * Build state is loaded from disk (workspace/temp/build-state.json)
 * on every request — no in-memory caching, always fresh.
 *
 * @module orchestration-server/build-status-routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { loadBuildState } from '@dsb/core';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/**
 * Public build status — sanitized view for the browser.
 *
 * Excludes: encrypted config, error details, internal step data.
 * Includes: progress percentage, current step, completed steps.
 */
interface PublicBuildStatus {
  readonly active: boolean;
  readonly buildId?: string;
  readonly status?: string;
  readonly currentStep?: string;
  readonly completedSteps: readonly string[];
  readonly pendingSteps: readonly string[];
  readonly totalSteps: number;
  readonly completedCount: number;
  readonly progressPercent: number;
  readonly startedAt?: string;
  readonly lastCheckpointAt?: string;
  readonly hasErrors: boolean;
}

// ============================================================================
// SECTION 2: ROUTER FACTORY
// ============================================================================

/**
 * Create the build status router.
 *
 * No auth parameter needed — all routes are public (localhost-only).
 */
export function createBuildStatusRouter(): Router {
  const router = Router();

  // ─── GET /build-status — Current build progress ─────────────────────

  router.get('/build-status', (_req: Request, res: Response) => {
    const loadResult = loadBuildState();

    if (!loadResult.ok) {
      res.status(500).json({
        error: 'Failed to read build state.',
        details: loadResult.error,
      });
      return;
    }

    const state = loadResult.value;

    if (!state) {
      const empty: PublicBuildStatus = {
        active: false,
        completedSteps: [],
        pendingSteps: [],
        totalSteps: 0,
        completedCount: 0,
        progressPercent: 0,
        hasErrors: false,
      };
      res.json(empty);
      return;
    }

    // Compute progress
    const totalSteps = state.completedSteps.length + state.pendingSteps.length;
    const completedCount = state.completedSteps.length;
    const progressPercent = totalSteps > 0
      ? Math.round((completedCount / totalSteps) * 100)
      : 0;

    // Determine current step from status
    let currentStep: string | undefined;
    if (state.status.startsWith('building:')) {
      currentStep = state.status.replace('building:', '');
    } else if (state.status === 'validating') {
      currentStep = 'validate';
    }

    const publicStatus: PublicBuildStatus = {
      active: state.status !== 'completed' && state.status !== 'failed' && state.status !== 'paused',
      buildId: state.buildId,
      status: state.status,
      currentStep,
      completedSteps: state.completedSteps.map(s => s.step),
      pendingSteps: [...state.pendingSteps],
      totalSteps,
      completedCount,
      progressPercent,
      startedAt: state.startedAt,
      lastCheckpointAt: state.lastCheckpointAt,
      hasErrors: state.errors.length > 0,
    };

    res.json(publicStatus);
  });

  return router;
}
