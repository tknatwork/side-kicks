/**
 * Token Validator — Validates token structures against 3-tier rules.
 *
 * Checks: circular aliases, missing references, scope conflicts,
 * naming conventions, and Figma plan limits.
 *
 * @module validation/token-validator
 */

import type {
  VariableDefinition,
  VariableValue,
  TierLevel,
  TierArchitecture,
  DesignSystemSpec,
} from '../tokens/schema';
import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';
import {
  isAlias,
  validateCrossTierAliases,
  detectCircularAliases,
  buildTierMapping,
} from '../tokens/three-tier-engine';

// ============================================================================
// SECTION 1: VALIDATION RESULT TYPES
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly variable?: string;
  readonly mode?: string;
}

export interface ValidationReport {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly stats: ValidationStats;
}

export interface ValidationStats {
  readonly totalVariables: number;
  readonly byTier: Readonly<Record<TierLevel, number>>;
  readonly byType: Readonly<Record<string, number>>;
  readonly aliasCount: number;
  readonly primitiveCount: number;
}

// ============================================================================
// SECTION 2: FIGMA PLAN LIMITS
// ============================================================================

export interface PlanLimits {
  readonly maxVariablesPerCollection: number;
  readonly maxModesPerCollection: number;
  readonly maxCollections: number;
}

const FIGMA_PLAN_LIMITS: Readonly<Record<string, PlanLimits>> = {
  starter: {
    maxVariablesPerCollection: 500,
    maxModesPerCollection: 1,
    maxCollections: 1,
  },
  professional: {
    maxVariablesPerCollection: 5000,
    maxModesPerCollection: 4,
    maxCollections: 50,
  },
  organization: {
    maxVariablesPerCollection: 5000,
    maxModesPerCollection: 4,
    maxCollections: 100,
  },
  enterprise: {
    maxVariablesPerCollection: 10000,
    maxModesPerCollection: 4,
    maxCollections: 200,
  },
};

export function getPlanLimits(planName: string): PlanLimits {
  return FIGMA_PLAN_LIMITS[planName.toLowerCase()] ?? FIGMA_PLAN_LIMITS['professional']!;
}

// ============================================================================
// SECTION 3: INDIVIDUAL VALIDATORS
// ============================================================================

/** Check that all alias targets exist in the variable set. */
function checkMissingReferences(
  variables: ReadonlyArray<VariableDefinition>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allNames = new Set(variables.map(v => v.name));

  for (const variable of variables) {
    for (const [modeName, value] of Object.entries(variable.values)) {
      if (!isAlias(value)) continue;

      if (!allNames.has(value.target)) {
        issues.push({
          severity: 'error',
          code: 'MISSING_REFERENCE',
          message:
            `Variable "${variable.name}" mode "${modeName}" references "${value.target}" ` +
            `which does not exist. Create "${value.target}" first, or change the alias target.`,
          variable: variable.name,
          mode: modeName,
        });
      }
    }
  }
  return issues;
}

/** Check for duplicate variable names within the same tier. */
function checkDuplicateNames(
  variables: ReadonlyArray<VariableDefinition>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>(); // name → tier

  for (const variable of variables) {
    const key = `${variable.tier}:${variable.name}`;
    if (seen.has(key)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_NAME',
        message:
          `Duplicate variable name "${variable.name}" in tier "${variable.tier}". ` +
          `Variable names must be unique within a tier.`,
        variable: variable.name,
      });
    }
    seen.set(key, variable.tier);
  }
  return issues;
}

/** Check naming convention: expects category/name format with kebab-case. */
function checkNamingConventions(
  variables: ReadonlyArray<VariableDefinition>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const VALID_NAME_PATTERN = /^[a-z][a-z0-9]*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

  for (const variable of variables) {
    if (!VALID_NAME_PATTERN.test(variable.name)) {
      issues.push({
        severity: 'warning',
        code: 'NAMING_CONVENTION',
        message:
          `Variable "${variable.name}" doesn't follow the kebab-case/slash convention ` +
          `(expected: "category/name-variant", e.g., "color/primary-500").`,
        variable: variable.name,
      });
    }
  }
  return issues;
}

/** Check that all variables have at least one mode value. */
function checkEmptyValues(
  variables: ReadonlyArray<VariableDefinition>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const variable of variables) {
    const modeCount = Object.keys(variable.values).length;
    if (modeCount === 0) {
      issues.push({
        severity: 'error',
        code: 'EMPTY_VALUES',
        message:
          `Variable "${variable.name}" has no mode values. ` +
          `Every variable needs at least one mode value.`,
        variable: variable.name,
      });
    }
  }
  return issues;
}

/** Check scope assignments are reasonable for the variable type. */
function checkScopeConsistency(
  variables: ReadonlyArray<VariableDefinition>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const COLOR_SCOPES = new Set([
    'ALL_FILLS', 'FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR',
  ]);
  const FLOAT_SCOPES = new Set([
    'GAP', 'WIDTH_HEIGHT', 'CORNER_RADIUS', 'FONT_SIZE', 'FONT_WEIGHT',
    'LINE_HEIGHT', 'LETTER_SPACING', 'PARAGRAPH_SPACING', 'OPACITY',
  ]);
  const STRING_SCOPES = new Set([
    'FONT_FAMILY', 'FONT_STYLE',
  ]);

  for (const variable of variables) {
    for (const scope of variable.scopes) {
      if (variable.type === 'color' && !COLOR_SCOPES.has(scope)) {
        issues.push({
          severity: 'warning',
          code: 'SCOPE_MISMATCH',
          message:
            `Color variable "${variable.name}" has non-color scope "${scope}".`,
          variable: variable.name,
        });
      }
      if (variable.type === 'float' && !FLOAT_SCOPES.has(scope)) {
        issues.push({
          severity: 'warning',
          code: 'SCOPE_MISMATCH',
          message:
            `Float variable "${variable.name}" has non-float scope "${scope}".`,
          variable: variable.name,
        });
      }
      if (variable.type === 'string' && !STRING_SCOPES.has(scope)) {
        issues.push({
          severity: 'warning',
          code: 'SCOPE_MISMATCH',
          message:
            `String variable "${variable.name}" has non-string scope "${scope}".`,
          variable: variable.name,
        });
      }
    }
  }
  return issues;
}

/** Check against Figma plan limits. */
function checkPlanLimits(
  variables: ReadonlyArray<VariableDefinition>,
  tiers: TierArchitecture,
  planName: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const limits = getPlanLimits(planName);

  // Count collections
  let collectionCount = 3; // primitives, semantic, component
  if (tiers.breakpoints) collectionCount += 1;

  if (collectionCount > limits.maxCollections) {
    issues.push({
      severity: 'error',
      code: 'PLAN_LIMIT_COLLECTIONS',
      message:
        `${collectionCount} collections needed, but the ${planName} plan allows only ${limits.maxCollections}. ` +
        `Upgrade your Figma plan or reduce the number of collections.`,
    });
  }

  // Count variables per collection
  const perTier: Record<string, number> = {};
  for (const v of variables) {
    const key = v.tier;
    perTier[key] = (perTier[key] || 0) + 1;
  }

  for (const [tier, count] of Object.entries(perTier)) {
    if (count > limits.maxVariablesPerCollection) {
      issues.push({
        severity: 'error',
        code: 'PLAN_LIMIT_VARIABLES',
        message:
          `Tier "${tier}" has ${count} variables, but the ${planName} plan allows only ${limits.maxVariablesPerCollection} per collection. ` +
          `Reduce variable count or upgrade your Figma plan.`,
        variable: `tier:${tier}`,
      });
    }
  }

  // Check mode counts
  const tierConfigs = [tiers.primitives, tiers.semantic, tiers.component];
  if (tiers.breakpoints) tierConfigs.push(tiers.breakpoints);

  for (const config of tierConfigs) {
    if (config.modes.length > limits.maxModesPerCollection) {
      issues.push({
        severity: 'error',
        code: 'PLAN_LIMIT_MODES',
        message:
          `Collection "${config.collectionName}" has ${config.modes.length} modes, but the ${planName} plan allows only ${limits.maxModesPerCollection}. ` +
          `Reduce mode count or upgrade your Figma plan.`,
      });
    }
  }

  return issues;
}

// ============================================================================
// SECTION 4: FULL VALIDATION
// ============================================================================

/**
 * Run full validation on a set of variables against the design system spec.
 *
 * @param variables - All variables across all tiers.
 * @param spec - The design system specification.
 * @param figmaPlan - The user's Figma plan name (default: "professional").
 */
export function validateTokens(
  variables: ReadonlyArray<VariableDefinition>,
  spec: DesignSystemSpec,
  figmaPlan: string = 'professional'
): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Structural checks
  issues.push(...checkDuplicateNames(variables));
  issues.push(...checkEmptyValues(variables));
  issues.push(...checkMissingReferences(variables));
  issues.push(...checkNamingConventions(variables));
  issues.push(...checkScopeConsistency(variables));
  issues.push(...checkPlanLimits(variables, spec.tiers, figmaPlan));

  // Alias chain validation
  const tierMapping = buildTierMapping(spec.tiers);
  const crossTierResult = validateCrossTierAliases(variables, tierMapping);
  if (!crossTierResult.ok) {
    for (const line of crossTierResult.error.split('\n')) {
      issues.push({
        severity: 'error',
        code: 'CROSS_TIER_VIOLATION',
        message: line,
      });
    }
  }

  // Circular reference detection
  const circularResult = detectCircularAliases(variables);
  if (!circularResult.ok) {
    issues.push({
      severity: 'error',
      code: 'CIRCULAR_ALIAS',
      message: circularResult.error,
    });
  }

  // Compute stats
  const stats = computeStats(variables);

  // Valid only if no errors (warnings and info are acceptable)
  const hasErrors = issues.some(i => i.severity === 'error');

  return {
    valid: !hasErrors,
    issues,
    stats,
  };
}

function computeStats(variables: ReadonlyArray<VariableDefinition>): ValidationStats {
  const byTier: Record<string, number> = {
    primitives: 0,
    semantic: 0,
    component: 0,
    breakpoints: 0,
  };
  const byType: Record<string, number> = {};
  let aliasCount = 0;
  let primitiveCount = 0;

  for (const v of variables) {
    byTier[v.tier] = (byTier[v.tier] || 0) + 1;
    byType[v.type] = (byType[v.type] || 0) + 1;

    for (const value of Object.values(v.values)) {
      if (isAlias(value)) {
        aliasCount++;
      } else {
        primitiveCount++;
      }
    }
  }

  return {
    totalVariables: variables.length,
    byTier: byTier as Record<TierLevel, number>,
    byType,
    aliasCount,
    primitiveCount,
  };
}
