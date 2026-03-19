/**
 * Build State — Crash-recoverable state machine for the build pipeline.
 *
 * Persists build progress to `workspace/temp/build-state.json`.
 * Each completed step is checkpointed so crashes can resume.
 *
 * The config field is stored as an EncryptedConfig blob — not readable
 * JSON. Only the MCP server (with the session key in memory) can decrypt.
 *
 * Follows the same save/load pattern as `context-store.ts`.
 *
 * @module core/build/build-state
 */

import * as path from 'node:path';
import { Result, safeWriteJson, safeReadJson, safeExists, safeDelete, DSB_ROOT } from '@dsb/guardrails';
import type { EncryptedConfig } from '../crypto/config-cipher';
import type { GenerationRecommendation } from '../learning/learner';
import type { BuildExecutionPlan } from './build-orchestrator';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** All possible build pipeline steps. */
export type BuildStep =
  | 'tier1'         // Primitives collection + variables
  | 'tier2'         // Semantic collection + aliases
  | 'tier3'         // Mapped collection + theme modes
  | 'breakpoints'   // Breakpoints collection
  | 'styles'        // Color/text/effect/grid styles
  | 'pages'         // Foundation + component pages
  | 'validate';     // QA validation

/** All possible build states. */
export type BuildStatus =
  | 'pending'              // Config received, plan not yet approved
  | 'approved'             // User approved, build not started
  | `building:${BuildStep}` // Currently executing a step
  | 'validating'           // Running QA
  | 'completed'            // All done
  | 'failed'               // Step failed, state preserved
  | 'paused';              // Token limit or emergency stop

/** Result from a completed step. */
export interface StepResult {
  /** Which step completed. */
  readonly step: BuildStep;
  /** Data returned by the step (e.g., collectionId, variable count). */
  readonly data: Record<string, unknown>;
  /** When this step completed. */
  readonly completedAt: string;
}

/** Error from a failed step. */
export interface StepError {
  /** Which step failed. */
  readonly step: BuildStep;
  /** Error message. */
  readonly error: string;
  /** When the failure occurred. */
  readonly failedAt: string;
}

/** The full build state persisted to disk. */
export interface BuildState {
  /** Unique build identifier. */
  readonly buildId: string;
  /** Current build status. */
  readonly status: BuildStatus;
  /** Encrypted config from the UI (never plaintext on disk). */
  readonly encryptedConfig: EncryptedConfig;
  /** When the build was initiated. */
  readonly startedAt: string;
  /** When the last checkpoint was saved. */
  readonly lastCheckpointAt: string;
  /** Steps that have completed successfully. */
  readonly completedSteps: readonly StepResult[];
  /** Steps still pending. */
  readonly pendingSteps: readonly BuildStep[];
  /** Errors encountered during the build. */
  readonly errors: readonly StepError[];
  /**
   * Learned recommendation applied to this build (optional).
   * Persisted so pause/resume retains the adapted spec.
   */
  readonly recommendation?: GenerationRecommendation;
  /**
   * Pre-computed execution plan (optional).
   * Stored at build start so resume doesn't re-generate tokens.
   */
  readonly executionPlan?: BuildExecutionPlan;
}

// ============================================================================
// SECTION 2: PATH RESOLUTION
// ============================================================================

function buildStatePath(): string {
  return path.join(DSB_ROOT, 'workspace', 'temp', 'build-state.json');
}

// ============================================================================
// SECTION 3: SAVE / LOAD
// ============================================================================

/**
 * Save build state to disk.
 *
 * Called after every pipeline step to checkpoint progress.
 */
export function saveBuildState(state: BuildState): Result<string, string> {
  const stamped: BuildState = {
    ...state,
    lastCheckpointAt: new Date().toISOString(),
  };
  return safeWriteJson(buildStatePath(), stamped);
}

/**
 * Load build state from disk.
 *
 * Returns null (wrapped in Ok) if no active build exists.
 */
export function loadBuildState(): Result<BuildState | null, string> {
  const exists = safeExists(buildStatePath());
  if (!exists.ok) return exists;
  if (!exists.value) return Result.ok(null);

  return safeReadJson<BuildState>(buildStatePath());
}

/**
 * Clear build state after successful completion.
 *
 * Removes the state file so the next build starts fresh.
 */
export function clearBuildState(): Result<string, string> {
  const exists = safeExists(buildStatePath());
  if (!exists.ok) return exists;
  if (!exists.value) return Result.ok('No build state to clear');

  return safeDelete(buildStatePath());
}

// ============================================================================
// SECTION 4: STATE TRANSITIONS
// ============================================================================

/**
 * Advance the build state: move a step from pending to completed.
 *
 * Saves the checkpoint to disk after the transition.
 *
 * @param state - Current build state.
 * @param step - The step that just completed.
 * @param data - Data from the completed step.
 * @returns Updated state (also persisted to disk).
 */
export function advanceStep(
  state: BuildState,
  step: BuildStep,
  data: Record<string, unknown>
): Result<BuildState, string> {
  const nextPending = state.pendingSteps.filter(s => s !== step);
  const nextStatus: BuildStatus = nextPending.length === 0
    ? 'completed'
    : `building:${nextPending[0]!}`;

  const updated: BuildState = {
    ...state,
    status: nextStatus,
    completedSteps: [
      ...state.completedSteps,
      { step, data, completedAt: new Date().toISOString() },
    ],
    pendingSteps: nextPending,
    lastCheckpointAt: new Date().toISOString(),
  };

  const saveResult = saveBuildState(updated);
  if (!saveResult.ok) return saveResult;

  return Result.ok(updated);
}

/**
 * Mark the build as failed at a specific step.
 *
 * Saves the checkpoint so the build can be resumed after the issue is fixed.
 *
 * @param state - Current build state.
 * @param step - The step that failed.
 * @param error - Error message.
 */
export function failStep(
  state: BuildState,
  step: BuildStep,
  error: string
): Result<BuildState, string> {
  const updated: BuildState = {
    ...state,
    status: 'failed',
    errors: [
      ...state.errors,
      { step, error, failedAt: new Date().toISOString() },
    ],
    lastCheckpointAt: new Date().toISOString(),
  };

  const saveResult = saveBuildState(updated);
  if (!saveResult.ok) return saveResult;

  return Result.ok(updated);
}

/**
 * Pause the build (token limit or emergency stop).
 *
 * @param state - Current build state.
 */
export function pauseBuild(state: BuildState): Result<BuildState, string> {
  const updated: BuildState = {
    ...state,
    status: 'paused',
    lastCheckpointAt: new Date().toISOString(),
  };

  const saveResult = saveBuildState(updated);
  if (!saveResult.ok) return saveResult;

  return Result.ok(updated);
}
