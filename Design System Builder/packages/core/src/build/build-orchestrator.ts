/**
 * Build Orchestrator — Plans and sequences the automated build pipeline.
 *
 * Sits between the build state machine and actual Figma execution.
 * Takes a `DesignSystemSpec` (from the config UI) + optional
 * `GenerationRecommendation` (from the learning engine) and produces
 * a `BuildExecutionPlan` — a complete, step-by-step instruction set
 * for creating the design system in Figma.
 *
 * Architecture:
 * ```
 * Config UI → DesignSystemSpec ─┐
 *                                ├──→ BuildOrchestrator.planBuild()
 * Learning Engine → Recommendation ┘              │
 *                                          BuildExecutionPlan
 *                                                  │
 *                                    ┌─────────────┼──────────────┐
 *                                    ▼             ▼              ▼
 *                             StepPlan:tier1  StepPlan:tier2  StepPlan:...
 *                                    │             │              │
 *                               commands[]    commands[]     commands[]
 * ```
 *
 * This module is PURE — no I/O, no network calls, no side effects.
 * It produces the plan; the MCP server's `build-tools.ts` executes it.
 *
 * @module core/build/build-orchestrator
 */

import { Result } from '@dsb/guardrails';
import type { BuildStep } from './build-state';
import { PIPELINE_STEPS } from './build-pipeline';
import type { PipelineStepDef } from './build-pipeline';
import type {
  DesignSystemSpec,
  VariableDefinition,
  TierLevel,
} from '../tokens/schema';
import type {
  GenerationRecommendation,
} from '../learning/learner';
import { generateTokenSystem } from '../learning/token-generator';
import type { GeneratedTokenSystem, GeneratedTier } from '../learning/token-generator';
import { validateTokens } from '../validation/token-validator';
import type { ValidationReport } from '../validation/token-validator';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/**
 * A single command to send to the Figma plugin via the bridge.
 *
 * Maps 1-to-1 with `BridgeCommand` in the MCP server, but defined
 * here as a pure data type (no network dependency).
 */
export interface StepCommand {
  /** Command type (matches bridge handler, e.g., "create_collection"). */
  readonly type: string;
  /** Command payload. */
  readonly payload: Readonly<Record<string, unknown>>;
  /** Human-readable description for logging. */
  readonly description: string;
  /** Expected result shape (for validation after execution). */
  readonly expectation: CommandExpectation;
}

/** What we expect the bridge to return for a command. */
export interface CommandExpectation {
  /** Whether this command must succeed for the step to pass. */
  readonly critical: boolean;
  /** Key in result.data to extract (e.g., "collectionId"). */
  readonly extractKey?: string;
  /** Description of what success looks like. */
  readonly successDescription: string;
}

/** Execution plan for a single pipeline step. */
export interface StepPlan {
  /** Step identifier. */
  readonly step: BuildStep;
  /** Human-readable description. */
  readonly description: string;
  /** Ordered commands to execute for this step. */
  readonly commands: readonly StepCommand[];
  /** Expected output summary. */
  readonly expectedOutput: StepExpectedOutput;
}

/** What a step is expected to produce. */
export interface StepExpectedOutput {
  /** Collection name (if step creates one). */
  readonly collectionName?: string;
  /** Modes created (if step creates a collection). */
  readonly modes?: readonly string[];
  /** Number of variables created. */
  readonly variableCount: number;
  /** Tier this step builds. */
  readonly tier?: TierLevel;
}

/** The complete build execution plan — everything needed to build the system. */
export interface BuildExecutionPlan {
  /** The spec used (may be adapted by recommendations). */
  readonly spec: DesignSystemSpec;
  /** The recommendation used (if any). */
  readonly recommendation?: GenerationRecommendation;
  /** Pre-generated token system. */
  readonly tokenSystem: GeneratedTokenSystem;
  /** Validation report for the generated tokens. */
  readonly validationReport: ValidationReport;
  /** Per-step execution plans, in pipeline order. */
  readonly steps: readonly StepPlan[];
  /** Human-readable build plan text (for presenting to the user). */
  readonly planText: string;
  /** Summary statistics. */
  readonly summary: PlanSummary;
}

/** Summary statistics for the build plan. */
export interface PlanSummary {
  /** Total collections to create. */
  readonly totalCollections: number;
  /** Total variables across all tiers. */
  readonly totalVariables: number;
  /** Total bridge commands to execute. */
  readonly totalCommands: number;
  /** Estimated token cost (for pause-before-exhaustion). */
  readonly estimatedTokenCost: number;
  /** Whether a recommendation was applied. */
  readonly hasRecommendation: boolean;
  /** Adaptations made (empty if no recommendation). */
  readonly adaptations: readonly string[];
  /** Per-tier variable counts. */
  readonly variablesPerTier: Readonly<Record<string, number>>;
}

// ============================================================================
// SECTION 2: ORCHESTRATOR
// ============================================================================

/**
 * Plan the complete build from a spec and optional recommendation.
 *
 * This is the main entry point. It:
 * 1. Generates tokens (via the learning engine's token generator)
 * 2. Validates the generated token system
 * 3. Produces per-step command sequences for the bridge
 * 4. Formats a human-readable build plan
 *
 * @param spec - The user's design system specification
 * @param recommendation - Optional recommendation from the learning engine
 * @returns Result with BuildExecutionPlan or error string
 */
export function planBuild(
  spec: DesignSystemSpec,
  recommendation?: GenerationRecommendation,
): Result<BuildExecutionPlan, string> {

  // Step 1: Generate the token system
  const tokenResult = generateTokenSystem(spec, recommendation);
  if (!tokenResult.ok) {
    return Result.err(
      `Failed to generate tokens for build plan: ${tokenResult.error}. ` +
      'Check the design system spec and recommendation for compatibility.',
    );
  }

  const tokenSystem = tokenResult.value;

  // Step 2: Validate the generated tokens
  const validationReport = validateTokens(
    tokenSystem.allVariables as VariableDefinition[],
    tokenSystem.spec,
  );

  // Don't block on warnings, only on errors
  const errorCount = validationReport.issues.filter(i => i.severity === 'error').length;
  if (errorCount > 0) {
    const errorMessages = validationReport.issues
      .filter(i => i.severity === 'error')
      .map(i => `  - ${i.message}`)
      .join('\n');
    return Result.err(
      `Token validation found ${errorCount} error(s):\n${errorMessages}\n` +
      'Fix the design system spec before building.',
    );
  }

  // Step 3: Build per-step execution plans
  const stepPlans = buildStepPlans(tokenSystem, spec);

  // Step 4: Format the human-readable plan
  const planText = formatExecutionPlan(stepPlans, tokenSystem, recommendation);

  // Step 5: Compute summary
  const totalCommands = stepPlans.reduce(
    (sum, s) => sum + s.commands.length,
    0,
  );

  const variablesPerTier: Record<string, number> = {};
  for (const tier of tokenSystem.tiers) {
    variablesPerTier[tier.collectionName] = tier.variables.length;
  }

  const estimatedTokenCost = PIPELINE_STEPS.reduce(
    (sum, s) => sum + s.estimatedTokens,
    0,
  );

  const summary: PlanSummary = {
    totalCollections: tokenSystem.tiers.length,
    totalVariables: tokenSystem.allVariables.length,
    totalCommands,
    estimatedTokenCost,
    hasRecommendation: recommendation !== undefined,
    adaptations: tokenSystem.adaptations,
    variablesPerTier,
  };

  return Result.ok({
    spec: tokenSystem.spec,
    recommendation,
    tokenSystem,
    validationReport,
    steps: stepPlans,
    planText,
    summary,
  });
}

// ============================================================================
// SECTION 3: STEP PLAN BUILDERS
// ============================================================================

/**
 * Build the ordered execution plans for each pipeline step.
 *
 * Maps each `BuildStep` to a `StepPlan` containing concrete
 * bridge commands with the actual token data.
 */
function buildStepPlans(
  tokenSystem: GeneratedTokenSystem,
  spec: DesignSystemSpec,
): StepPlan[] {
  const plans: StepPlan[] = [];

  // Find each tier in the generated system
  const primitivesTier = tokenSystem.tiers.find(t => t.tier === 'primitives');
  const semanticTier = tokenSystem.tiers.find(t => t.tier === 'semantic');
  const componentTier = tokenSystem.tiers.find(t => t.tier === 'component');
  const breakpointsTier = tokenSystem.tiers.find(t => t.tier === 'breakpoints');

  // tier1: Primitives collection
  if (primitivesTier) {
    plans.push(buildCollectionStepPlan(
      'tier1',
      'Creating Primitives collection',
      primitivesTier,
    ));
  }

  // tier2: Semantic collection
  if (semanticTier) {
    plans.push(buildCollectionStepPlan(
      'tier2',
      'Creating Semantic collection',
      semanticTier,
    ));
  }

  // tier3: Mapped (Component) collection
  if (componentTier) {
    plans.push(buildCollectionStepPlan(
      'tier3',
      'Creating Mapped collection with theme modes',
      componentTier,
    ));
  }

  // breakpoints: Breakpoints collection (optional)
  if (breakpointsTier) {
    plans.push(buildCollectionStepPlan(
      'breakpoints',
      'Creating Breakpoints collection',
      breakpointsTier,
    ));
  } else {
    // Still need a step plan even if empty (pipeline expects it)
    plans.push({
      step: 'breakpoints',
      description: 'Breakpoints collection (skipped — not configured)',
      commands: [],
      expectedOutput: { variableCount: 0 },
    });
  }

  // styles: Style generation
  plans.push(buildStylesStepPlan(spec, tokenSystem));

  // pages: Foundation + component pages
  plans.push(buildPagesStepPlan(spec, tokenSystem));

  // validate: QA validation
  plans.push(buildValidateStepPlan(tokenSystem));

  return plans;
}

/**
 * Build the execution plan for a collection-creation step.
 *
 * Each collection step follows the same pattern:
 * 1. Create collection with modes
 * 2. Batch create variables (names + types)
 * 3. Batch set values (primitives) or aliases (semantic/component)
 */
function buildCollectionStepPlan(
  step: BuildStep,
  description: string,
  tier: GeneratedTier,
): StepPlan {
  const commands: StepCommand[] = [];

  // Command 1: Create the collection
  commands.push({
    type: 'create_collection',
    payload: {
      name: tier.collectionName,
      modes: [...tier.modes],
    },
    description: `Create "${tier.collectionName}" collection with modes [${tier.modes.join(', ')}]`,
    expectation: {
      critical: true,
      extractKey: 'collectionId',
      successDescription: `Collection "${tier.collectionName}" created with ${tier.modes.length} mode(s)`,
    },
  });

  // Command 2: Batch create variables (names + types only)
  if (tier.variables.length > 0) {
    const variableDefs = tier.variables.map(v => ({
      name: v.name,
      type: mapVariableType(v.type),
      scopes: v.scopes,
    }));

    commands.push({
      type: 'batch_create_variables',
      payload: {
        collectionName: tier.collectionName,
        variables: variableDefs,
      },
      description: `Create ${tier.variables.length} variables in "${tier.collectionName}"`,
      expectation: {
        critical: true,
        successDescription: `${tier.variables.length} variables created`,
      },
    });

    // Command 3: Set values or aliases per mode
    for (const mode of tier.modes) {
      const primitiveValues: Array<{ name: string; value: unknown }> = [];
      const aliasValues: Array<{ name: string; targetName: string; targetCollection: string }> = [];

      for (const variable of tier.variables) {
        const modeValue = variable.values[mode];
        if (!modeValue) continue;

        if (isAliasValue(modeValue)) {
          aliasValues.push({
            name: variable.name,
            targetName: modeValue.target,
            targetCollection: modeValue.collection,
          });
        } else {
          primitiveValues.push({
            name: variable.name,
            value: modeValue,
          });
        }
      }

      // Set primitive values
      if (primitiveValues.length > 0) {
        commands.push({
          type: 'batch_set_values',
          payload: {
            collectionName: tier.collectionName,
            mode,
            values: primitiveValues,
          },
          description: `Set ${primitiveValues.length} values in "${tier.collectionName}" mode "${mode}"`,
          expectation: {
            critical: true,
            successDescription: `${primitiveValues.length} values set for mode "${mode}"`,
          },
        });
      }

      // Set alias references
      if (aliasValues.length > 0) {
        commands.push({
          type: 'batch_set_aliases',
          payload: {
            collectionName: tier.collectionName,
            mode,
            aliases: aliasValues,
          },
          description: `Set ${aliasValues.length} aliases in "${tier.collectionName}" mode "${mode}"`,
          expectation: {
            critical: true,
            successDescription: `${aliasValues.length} aliases set for mode "${mode}"`,
          },
        });
      }
    }
  }

  return {
    step,
    description,
    commands,
    expectedOutput: {
      collectionName: tier.collectionName,
      modes: tier.modes,
      variableCount: tier.variables.length,
      tier: tier.tier,
    },
  };
}

/**
 * Build the execution plan for the styles step.
 *
 * Creates color styles, text styles, effect styles, and grid styles
 * based on the generated token system.
 */
function buildStylesStepPlan(
  spec: DesignSystemSpec,
  tokenSystem: GeneratedTokenSystem,
): StepPlan {
  const commands: StepCommand[] = [];

  // Color styles: from the component/mapped tier
  const componentTier = tokenSystem.tiers.find(t => t.tier === 'component');
  const colorVars = componentTier?.variables.filter(v => v.type === 'color') ?? [];
  for (const colorVar of colorVars) {
    commands.push({
      type: 'create_color_style',
      payload: {
        name: colorVar.name,
        variableName: colorVar.name,
        collectionName: componentTier?.collectionName ?? 'Mapped',
      },
      description: `Create color style "${colorVar.name}"`,
      expectation: {
        critical: false,
        successDescription: `Color style "${colorVar.name}" created`,
      },
    });
  }

  // Text styles: from typography spec
  const typographyVars = tokenSystem.allVariables.filter(
    v => v.scopes?.includes('FONT_SIZE') || v.scopes?.includes('FONT_FAMILY'),
  );
  for (const typoVar of typographyVars) {
    commands.push({
      type: 'create_text_style',
      payload: {
        name: typoVar.name,
        variableName: typoVar.name,
        typography: spec.typography,
      },
      description: `Create text style "${typoVar.name}"`,
      expectation: {
        critical: false,
        successDescription: `Text style "${typoVar.name}" created`,
      },
    });
  }

  return {
    step: 'styles',
    description: 'Generating Figma styles from token system',
    commands,
    expectedOutput: {
      variableCount: 0, // Styles, not variables
    },
  };
}

/**
 * Build the execution plan for the pages step.
 *
 * Creates foundation documentation pages and component placeholder pages.
 */
function buildPagesStepPlan(
  spec: DesignSystemSpec,
  tokenSystem: GeneratedTokenSystem,
): StepPlan {
  const commands: StepCommand[] = [];

  // Foundation page: colors, typography, spacing reference
  commands.push({
    type: 'create_page',
    payload: { name: '📐 Foundation' },
    description: 'Create Foundation documentation page',
    expectation: {
      critical: false,
      extractKey: 'pageId',
      successDescription: 'Foundation page created',
    },
  });

  // Color swatches frame
  const primitivesTier = tokenSystem.tiers.find(t => t.tier === 'primitives');
  const colorVarCount = primitivesTier?.variables.filter(v => v.type === 'color').length ?? 0;
  commands.push({
    type: 'create_frame',
    payload: {
      pageName: '📐 Foundation',
      frameName: 'Color Palette',
      frameType: 'color-swatches',
      variableCount: colorVarCount,
    },
    description: `Create color palette frame with ${colorVarCount} swatches`,
    expectation: {
      critical: false,
      successDescription: 'Color palette frame created',
    },
  });

  // Typography scale frame
  commands.push({
    type: 'create_frame',
    payload: {
      pageName: '📐 Foundation',
      frameName: 'Typography Scale',
      frameType: 'typography-scale',
      typography: spec.typography,
    },
    description: 'Create typography scale frame',
    expectation: {
      critical: false,
      successDescription: 'Typography scale frame created',
    },
  });

  // Spacing scale frame
  commands.push({
    type: 'create_frame',
    payload: {
      pageName: '📐 Foundation',
      frameName: 'Spacing Scale',
      frameType: 'spacing-scale',
    },
    description: 'Create spacing scale frame',
    expectation: {
      critical: false,
      successDescription: 'Spacing scale frame created',
    },
  });

  // Components page
  if (spec.components && spec.components.length > 0) {
    commands.push({
      type: 'create_page',
      payload: { name: '🧩 Components' },
      description: 'Create Components documentation page',
      expectation: {
        critical: false,
        extractKey: 'pageId',
        successDescription: 'Components page created',
      },
    });

    // Component placeholder frames
    for (const componentName of spec.components) {
      commands.push({
        type: 'create_frame',
        payload: {
          pageName: '🧩 Components',
          frameName: componentName,
          frameType: 'component-placeholder',
        },
        description: `Create "${componentName}" component placeholder frame`,
        expectation: {
          critical: false,
          successDescription: `${componentName} frame created`,
        },
      });
    }
  }

  return {
    step: 'pages',
    description: 'Creating foundation and component documentation pages',
    commands,
    expectedOutput: {
      variableCount: 0, // Pages, not variables
    },
  };
}

/**
 * Build the execution plan for the validation step.
 *
 * Queries Figma to verify everything was created correctly.
 */
function buildValidateStepPlan(
  tokenSystem: GeneratedTokenSystem,
): StepPlan {
  const commands: StepCommand[] = [];

  // Verify each collection exists
  for (const tier of tokenSystem.tiers) {
    commands.push({
      type: 'get_collection_details',
      payload: { collectionName: tier.collectionName },
      description: `Verify "${tier.collectionName}" collection exists`,
      expectation: {
        critical: true,
        successDescription: `Collection "${tier.collectionName}" verified`,
      },
    });
  }

  // Verify variable counts
  commands.push({
    type: 'get_variables',
    payload: { countOnly: true },
    description: `Verify total variable count matches expected ${tokenSystem.allVariables.length}`,
    expectation: {
      critical: false,
      successDescription: `Variable count verified (expected: ${tokenSystem.allVariables.length})`,
    },
  });

  // Query file info for completion verification
  commands.push({
    type: 'get_file_info',
    payload: {},
    description: 'Query file info for build completion verification',
    expectation: {
      critical: false,
      successDescription: 'Build completion data retrieved',
    },
  });

  return {
    step: 'validate',
    description: 'Running QA validation on the completed design system',
    commands,
    expectedOutput: {
      variableCount: tokenSystem.allVariables.length,
    },
  };
}

// ============================================================================
// SECTION 4: PLAN FORMATTING
// ============================================================================

/**
 * Format the execution plan as a human-readable build plan.
 *
 * This is what Claude presents to the user before they approve.
 */
function formatExecutionPlan(
  steps: readonly StepPlan[],
  tokenSystem: GeneratedTokenSystem,
  recommendation?: GenerationRecommendation,
): string {
  const lines: string[] = ['## Build Plan\n'];

  // If recommendation was applied, note it
  if (recommendation) {
    lines.push('> 💡 This plan incorporates patterns learned from your reference design system(s).\n');
    if (tokenSystem.adaptations.length > 0) {
      lines.push('**Adaptations from learned patterns:**');
      for (const adaptation of tokenSystem.adaptations) {
        lines.push(`- ${adaptation}`);
      }
      lines.push('');
    }
  }

  // List tiers
  lines.push('### Token Architecture\n');
  for (const tier of tokenSystem.tiers) {
    lines.push(
      `- **${tier.collectionName}** (${tier.tier}) — ` +
      `${tier.variables.length} variables, ` +
      `modes: [${tier.modes.join(', ')}]`,
    );
  }
  lines.push('');

  // List steps
  lines.push('### Build Steps\n');
  let stepNum = 1;
  for (const step of steps) {
    if (step.commands.length === 0) {
      lines.push(`${stepNum}. ~~${step.description}~~ (skipped)`);
    } else {
      lines.push(`${stepNum}. **${step.description}** — ${step.commands.length} command(s)`);
    }
    stepNum++;
  }
  lines.push('');

  // Summary
  const totalVars = tokenSystem.allVariables.length;
  const totalCmds = steps.reduce((s, p) => s + p.commands.length, 0);
  lines.push('---');
  lines.push(`Total variables: ${totalVars} | Commands: ${totalCmds} | Collections: ${tokenSystem.tiers.length}`);

  return lines.join('\n');
}

// ============================================================================
// SECTION 5: UTILITIES
// ============================================================================

/**
 * Map internal variable type names to Figma API types.
 *
 * The token engine uses lowercase types; Figma API expects uppercase.
 */
function mapVariableType(type: string): string {
  const mapping: Record<string, string> = {
    color: 'COLOR',
    float: 'FLOAT',
    string: 'STRING',
    boolean: 'BOOLEAN',
  };
  return mapping[type] ?? 'FLOAT';
}

/**
 * Type guard: check if a value is an alias reference.
 */
function isAliasValue(value: unknown): value is { type: 'alias'; target: string; collection: string } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === 'alias' &&
    typeof obj.target === 'string' &&
    typeof obj.collection === 'string';
}
