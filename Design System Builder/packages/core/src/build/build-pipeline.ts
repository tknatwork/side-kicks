/**
 * Build Pipeline — Ordered step definitions for the automated build.
 *
 * Pure data module. No side effects, no I/O. Defines:
 *   - Pipeline step order
 *   - Step metadata (description, estimated tokens, dependencies)
 *   - Token budget estimation for pause-before-exhaustion logic
 *
 * The actual execution logic (bridge commands per step) lives in
 * `mcp-server/src/tools/build-tools.ts`. This module provides
 * the pipeline structure that the build orchestrator iterates over.
 *
 * @module core/build/build-pipeline
 */

import type { BuildStep } from './build-state';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** Metadata for a single pipeline step. */
export interface PipelineStepDef {
  /** Step identifier (matches BuildStep type). */
  readonly step: BuildStep;
  /** Human-readable description shown during build progress. */
  readonly description: string;
  /** Detailed description for the build plan presented to the user. */
  readonly planDescription: string;
  /** Estimated token cost for this step (~tokens consumed in Claude context). */
  readonly estimatedTokens: number;
  /** Steps that must complete before this one can start. */
  readonly requires: readonly BuildStep[];
  /** Figma operations this step performs (for documentation). */
  readonly operations: readonly string[];
}

// ============================================================================
// SECTION 2: PIPELINE DEFINITION
// ============================================================================

/**
 * The ordered build pipeline.
 *
 * Steps execute in this exact order. Each step creates Figma
 * resources via the bridge client (orchestration server → plugin).
 */
export const PIPELINE_STEPS: readonly PipelineStepDef[] = Object.freeze([
  {
    step: 'tier1',
    description: 'Creating Primitives collection',
    planDescription: 'Create the Primitives variable collection with color, spacing, typography, and radius tokens. These are the raw values that all other tiers reference.',
    estimatedTokens: 3000,
    requires: [],
    operations: [
      'create_collection (Primitives, modes: [Value])',
      'batch_create_variables (color primitives)',
      'batch_create_variables (spacing primitives)',
      'batch_create_variables (typography primitives)',
      'batch_set_variable_values (all primitive values)',
    ],
  },
  {
    step: 'tier2',
    description: 'Creating Semantic collection',
    planDescription: 'Create the Semantic variable collection with context-aware tokens (background, foreground, border, etc.). These alias the Primitives collection.',
    estimatedTokens: 3000,
    requires: ['tier1'],
    operations: [
      'create_collection (Semantic, modes: [Value])',
      'batch_create_variables (semantic tokens)',
      'batch_set_variable_aliases (semantic → primitive references)',
    ],
  },
  {
    step: 'tier3',
    description: 'Creating Mapped collection',
    planDescription: 'Create the Mapped (Component) variable collection with theme modes (Light, Dark). These alias the Semantic collection and provide theme switching.',
    estimatedTokens: 4000,
    requires: ['tier2'],
    operations: [
      'create_collection (Mapped, modes: [Light, Dark, ...])',
      'batch_create_variables (component tokens)',
      'batch_set_variable_aliases (mapped → semantic, per mode)',
    ],
  },
  {
    step: 'breakpoints',
    description: 'Creating Breakpoints collection',
    planDescription: 'Create the Breakpoints variable collection for responsive design (mobile, tablet, desktop widths).',
    estimatedTokens: 1500,
    requires: [],
    operations: [
      'create_collection (Breakpoints, modes: [Value])',
      'batch_create_variables (breakpoint tokens)',
      'batch_set_variable_values (breakpoint values)',
    ],
  },
  {
    step: 'styles',
    description: 'Generating Figma styles',
    planDescription: 'Generate color styles, text styles, effect styles, and grid styles in Figma based on the variable collections.',
    estimatedTokens: 5000,
    requires: ['tier1', 'tier2', 'tier3'],
    operations: [
      'batch_create_styles (color styles)',
      'batch_create_styles (text styles)',
      'batch_create_styles (effect styles)',
      'batch_create_styles (grid styles)',
    ],
  },
  {
    step: 'pages',
    description: 'Creating foundation pages',
    planDescription: 'Create documentation pages in Figma: Foundation page (color swatches, typography scale, spacing scale) and Component page (example components using the token system).',
    estimatedTokens: 4000,
    requires: ['tier1', 'tier2', 'tier3', 'styles'],
    operations: [
      'create_page (Foundation)',
      'create_page (Components)',
      'create_frames (documentation layout)',
    ],
  },
  {
    step: 'validate',
    description: 'Running QA validation',
    planDescription: 'Validate the complete design system: check all alias chains resolve, verify token counts match the spec, and generate a completion report.',
    estimatedTokens: 2000,
    requires: ['tier1', 'tier2', 'tier3', 'breakpoints', 'styles', 'pages'],
    operations: [
      'get_collections (verify all exist)',
      'get_variables (verify counts)',
      'validate_alias_chains (no broken references)',
      'generate_report',
    ],
  },
]);

// ============================================================================
// SECTION 3: PIPELINE UTILITIES
// ============================================================================

/** All step names in pipeline order. */
export const PIPELINE_ORDER: readonly BuildStep[] = PIPELINE_STEPS.map(s => s.step);

/**
 * Get the default list of pending steps for a new build.
 */
export function getDefaultPendingSteps(): BuildStep[] {
  return [...PIPELINE_ORDER];
}

/**
 * Get the next step to execute after the given completed steps.
 *
 * Respects dependency ordering: a step only runs if all its
 * required predecessors have completed.
 *
 * @param completedSteps - Steps already completed.
 * @param pendingSteps - Steps still pending.
 * @returns The next step to execute, or null if all done.
 */
export function getNextStep(
  completedSteps: readonly string[],
  pendingSteps: readonly BuildStep[]
): BuildStep | null {
  const completedSet = new Set(completedSteps);

  for (const stepDef of PIPELINE_STEPS) {
    if (!pendingSteps.includes(stepDef.step)) continue;

    // Check if all dependencies are satisfied
    const depsReady = stepDef.requires.every(dep => completedSet.has(dep));
    if (depsReady) return stepDef.step;
  }

  return null;
}

/**
 * Estimate total remaining token cost for pending steps.
 *
 * Used for the token budget heuristic: if remaining tokens
 * are less than this estimate, pause the build.
 */
export function estimateRemainingTokens(pendingSteps: readonly BuildStep[]): number {
  const pendingSet = new Set(pendingSteps);
  return PIPELINE_STEPS
    .filter(s => pendingSet.has(s.step))
    .reduce((sum, s) => sum + s.estimatedTokens, 0);
}

/**
 * Format the pipeline as a human-readable build plan.
 *
 * Used by `dsb_start_build` to present the plan to the user
 * before they approve it.
 */
export function formatBuildPlan(pendingSteps: readonly BuildStep[]): string {
  const pendingSet = new Set(pendingSteps);
  const lines: string[] = ['## Build Plan\n'];

  let stepNum = 1;
  for (const stepDef of PIPELINE_STEPS) {
    if (!pendingSet.has(stepDef.step)) continue;

    lines.push(`${stepNum}. **${stepDef.description}**`);
    lines.push(`   ${stepDef.planDescription}\n`);
    stepNum++;
  }

  const totalTokens = estimateRemainingTokens(pendingSteps);
  lines.push(`---`);
  lines.push(`Total steps: ${stepNum - 1} | Estimated complexity: ${totalTokens} tokens`);

  return lines.join('\n');
}
