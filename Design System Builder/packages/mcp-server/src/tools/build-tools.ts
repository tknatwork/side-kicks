/**
 * Build Tools — MCP tools for the resilient build pipeline.
 *
 * Tools:
 *   dsb_start_build  — Receive config, present plan, execute automated pipeline
 *   dsb_resume_build — Resume a crashed/paused build from checkpoint
 *
 * The build runs as a state machine with disk checkpoints after every step.
 * If something crashes or runs out of token budget, all completed
 * work is preserved and can be resumed.
 *
 * Integration: Uses the BuildOrchestrator (core/build/) to produce
 * execution plans from spec + optional learned recommendations. The
 * orchestrator pre-generates all tokens and sequences bridge commands
 * per step. This module iterates the plan and executes each step.
 *
 * @module mcp-server/tools/build-tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  decryptConfig,
  sessionKeyFromHex,
  saveBuildState,
  loadBuildState,
  clearBuildState,
  advanceStep,
  failStep,
  pauseBuild,
  getDefaultPendingSteps,
  getNextStep,
  estimateRemainingTokens,
  planBuild,
  loadProjectContext,
} from '@dsb/core';
import type {
  BuildState,
  BuildStep,
  EncryptedConfig,
  DesignSystemSpec,
  BuildExecutionPlan,
  StepPlan,
  GenerationRecommendation,
} from '@dsb/core';

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

/** Approximate token budget per pipeline step. */
const TOKEN_BUDGET_PER_STEP = 3000;

/** Minimum remaining tokens before pausing. */
const MIN_REMAINING_TOKENS = 5000;

// ============================================================================
// SECTION 2: REGISTRATION
// ============================================================================

export function registerBuildTools(server: McpServer, bridge: BridgeClient): void {

  // ─── Start Build ─────────────────────────────────────────────────────

  server.tool(
    'dsb_start_build',
    'Start or continue the automated build pipeline. First call with config creates a pending build and returns the plan. Second call with approved=true starts execution.',
    {
      encryptedConfig: z.object({
        ciphertext: z.string(),
        iv: z.string(),
        authTag: z.string(),
        algorithm: z.literal('aes-256-gcm'),
      }).optional().describe('Encrypted config from dsb_open_config_ui (first call only).'),
      sessionKeyHex: z.string().optional().describe('Session key hex to decrypt config (first call only).'),
      approved: z.boolean().optional().describe('Set to true to approve the plan and start building.'),
    },
    async ({ encryptedConfig, sessionKeyHex, approved }) => {

      // Check for existing build state
      const existingResult = loadBuildState();
      if (!existingResult.ok) {
        return error('Failed to load build state: ' + existingResult.error);
      }

      // ─── Case 1: Approve existing pending build ──────────────────────

      if (approved && existingResult.value?.status === 'pending') {
        const state = existingResult.value;
        const updated: BuildState = { ...state, status: 'approved' };
        const saveResult = saveBuildState(updated);
        if (!saveResult.ok) return error('Failed to save approved state: ' + saveResult.error);

        return await executePipeline(updated, bridge);
      }

      // ─── Case 2: Resume approved build ────────────────────────────────

      if (approved && existingResult.value?.status === 'approved') {
        return await executePipeline(existingResult.value, bridge);
      }

      // ─── Case 3: Create new build from encrypted config ──────────────

      if (!encryptedConfig || !sessionKeyHex) {
        return error('Provide encryptedConfig and sessionKeyHex to create a new build, or approved=true to continue an existing build.');
      }

      // Validate we can decrypt
      const keyResult = sessionKeyFromHex(sessionKeyHex);
      if (!keyResult.ok) return error('Invalid session key: ' + keyResult.error);

      const decryptResult = decryptConfig(encryptedConfig as EncryptedConfig, keyResult.value);
      if (!decryptResult.ok) return error('Failed to decrypt config: ' + decryptResult.error);

      // Parse the decrypted config as a DesignSystemSpec
      const spec = decryptResult.value as unknown as DesignSystemSpec;

      // Load saved recommendation (if the user ran study→learn→recommend)
      let recommendation: GenerationRecommendation | undefined;
      const contextResult = loadProjectContext();
      if (contextResult.ok && contextResult.value) {
        const ctx = contextResult.value as Record<string, unknown>;
        if (ctx.recommendation) {
          recommendation = ctx.recommendation as GenerationRecommendation;
        }
      }

      // Generate the execution plan using the orchestrator
      const planResult = planBuild(spec, recommendation);
      if (!planResult.ok) {
        return error('Failed to plan build: ' + planResult.error);
      }

      const plan = planResult.value;

      // Create pending build state with plan + recommendation persisted
      const pendingSteps = getDefaultPendingSteps();
      const buildState: BuildState = {
        buildId: randomUUID(),
        status: 'pending',
        encryptedConfig: encryptedConfig as EncryptedConfig,
        startedAt: new Date().toISOString(),
        lastCheckpointAt: new Date().toISOString(),
        completedSteps: [],
        pendingSteps,
        errors: [],
        recommendation,
        executionPlan: plan,
      };

      const saveResult = saveBuildState(buildState);
      if (!saveResult.ok) return error('Failed to save build state: ' + saveResult.error);

      // Return the plan for Claude to present to user
      return ok({
        message: 'Build plan created. Present this to the user for approval.',
        buildId: buildState.buildId,
        status: 'pending',
        plan: plan.planText,
        summary: plan.summary,
        estimatedTokens: plan.summary.estimatedTokenCost,
        steps: pendingSteps.length,
        hasRecommendation: plan.summary.hasRecommendation,
        adaptations: plan.summary.adaptations,
        action: 'Call dsb_start_build with approved=true to begin building.',
      });
    }
  );

  // ─── Resume Build ───────────────────────────────────────────────────

  server.tool(
    'dsb_resume_build',
    'Resume a build that was paused (token limit) or failed. Loads the last checkpoint and continues from the next pending step.',
    {},
    async () => {
      const stateResult = loadBuildState();
      if (!stateResult.ok) {
        return error('Failed to load build state: ' + stateResult.error);
      }

      if (!stateResult.value) {
        return error('No active build found. Start one with dsb_start_build.');
      }

      const state = stateResult.value;

      if (state.status === 'completed') {
        return ok({
          message: 'Build already completed.',
          buildId: state.buildId,
          completedSteps: state.completedSteps.map(s => s.step),
        });
      }

      if (state.status === 'pending') {
        return ok({
          message: 'Build is pending approval. Call dsb_start_build with approved=true.',
          buildId: state.buildId,
        });
      }

      // Resume from current position
      return await executePipeline(state, bridge);
    }
  );
}

// ============================================================================
// SECTION 3: PIPELINE EXECUTION
// ============================================================================

/**
 * Execute the build pipeline from the current state.
 *
 * Uses the pre-computed execution plan (from the orchestrator) to
 * send concrete bridge commands per step, rather than generic
 * `build:${step}` messages. This enables learning-adapted token data
 * to flow directly to the Figma plugin.
 *
 * If no execution plan is stored (legacy builds), falls back to
 * generic bridge commands.
 */
async function executePipeline(initialState: BuildState, bridge: BridgeClient) {
  let state = initialState;
  const plan = state.executionPlan;

  while (state.pendingSteps.length > 0) {
    const nextStep = getNextStep(
      state.completedSteps.map(s => s.step),
      [...state.pendingSteps]
    );

    if (!nextStep) {
      return error('No valid next step found in pipeline.');
    }

    // Token budget check — pause if running low
    const remainingTokens = estimateRemainingTokens([...state.pendingSteps]);
    if (remainingTokens < MIN_REMAINING_TOKENS && state.pendingSteps.length > 1) {
      const pausedState = pauseBuild(state,
        `Token budget: ~${remainingTokens} estimated for ${state.pendingSteps.length} remaining steps`
      );
      saveBuildState(pausedState);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'paused',
            reason: 'Approaching token limit. Run dsb_resume_build in a new session to continue.',
            completedSteps: pausedState.completedSteps.map(s => s.step),
            remainingSteps: pausedState.pendingSteps,
          }, null, 2),
        }],
      };
    }

    // Update status to building:step
    const buildingState: BuildState = {
      ...state,
      status: `building:${nextStep}`,
      lastCheckpointAt: new Date().toISOString(),
    };
    saveBuildState(buildingState);

    // Execute the step
    try {
      let stepResult: Record<string, unknown>;

      // Look up the step plan from the execution plan
      const stepPlan = plan?.steps.find(s => s.step === nextStep);

      if (stepPlan && stepPlan.commands.length > 0) {
        // Execute using orchestrated commands (learning-aware)
        stepResult = await executeStepFromPlan(stepPlan, state, bridge);
      } else if (stepPlan && stepPlan.commands.length === 0) {
        // Step was intentionally skipped (e.g., no breakpoints configured)
        stepResult = { step: nextStep, skipped: true, reason: stepPlan.description };
      } else {
        // Fallback: generic bridge command (legacy path)
        stepResult = await executeStepLegacy(nextStep, state, bridge);
      }

      // Advance state
      const advanceResult = advanceStep(state, nextStep, stepResult);
      if (!advanceResult.ok) {
        return error('Failed to advance step: ' + advanceResult.error);
      }

      state = advanceResult.value;
    } catch (err) {
      // Step failed
      const failResult = failStep(state, nextStep, String(err));
      if (!failResult.ok) {
        return error('Failed to record step failure: ' + failResult.error);
      }

      return ok({
        message: `Build failed at step "${nextStep}".`,
        buildId: state.buildId,
        failedStep: nextStep,
        error: String(err),
        completedSteps: state.completedSteps.map(s => s.step),
        pendingSteps: [...state.pendingSteps],
        action: 'Fix the issue and call dsb_resume_build to continue.',
      });
    }
  }

  // All steps completed
  clearBuildState();

  return ok({
    message: 'Build completed successfully!',
    buildId: state.buildId,
    status: 'completed',
    completedSteps: state.completedSteps.map(s => ({
      step: s.step,
      completedAt: s.completedAt,
    })),
    totalSteps: state.completedSteps.length,
    summary: plan?.summary,
  });
}

/**
 * Execute a single pipeline step using the orchestrator's step plan.
 *
 * Iterates through the pre-computed commands, sends each via the bridge,
 * extracts results (e.g., collectionId) for use in subsequent commands,
 * and collects all results.
 */
async function executeStepFromPlan(
  stepPlan: StepPlan,
  state: BuildState,
  bridge: BridgeClient
): Promise<Record<string, unknown>> {
  const results: unknown[] = [];
  const extracted: Record<string, unknown> = {};

  for (const command of stepPlan.commands) {
    // Inject any previously extracted values (e.g., collectionId)
    const payload = { ...command.payload, ...extracted };

    const result = await bridge.sendCommand({
      type: command.type,
      payload,
    });

    results.push({
      command: command.type,
      description: command.description,
      success: result.success,
      error: result.error,
    });

    // Handle critical command failures
    if (!result.success && command.expectation.critical) {
      throw new Error(
        `Critical command "${command.type}" failed: ${result.error ?? 'unknown error'}. ` +
        command.expectation.successDescription,
      );
    }

    // Extract keys for subsequent commands (e.g., collectionId)
    if (result.success && command.expectation.extractKey && result.data) {
      const data = result.data as Record<string, unknown>;
      const key = command.expectation.extractKey;
      if (data[key] !== undefined) {
        extracted[key] = data[key];
      }
    }
  }

  return {
    step: stepPlan.step,
    completed: true,
    commandCount: stepPlan.commands.length,
    results,
    expectedOutput: stepPlan.expectedOutput,
  };
}

/**
 * Execute a single pipeline step using the legacy generic bridge command.
 *
 * Fallback for builds that don't have a pre-computed execution plan
 * (e.g., builds started before the orchestrator was integrated).
 */
async function executeStepLegacy(
  step: BuildStep,
  state: BuildState,
  bridge: BridgeClient
): Promise<Record<string, unknown>> {
  const result = await bridge.sendCommand({
    type: `build:${step}`,
    payload: {
      buildId: state.buildId,
      step,
      completedSteps: state.completedSteps.map(s => s.step),
    },
  });

  if (!result.success) {
    throw new Error(result.error || `Step "${step}" failed with no error message.`);
  }

  return (result.data as Record<string, unknown>) || { step, completed: true };
}

// ============================================================================
// SECTION 4: HELPERS
// ============================================================================

function ok(data: Record<string, unknown>) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

function error(message: string) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ error: message }, null, 2),
    }],
  };
}
