/**
 * Three-Tier Engine — Enforces Primitives → Semantic → Component architecture.
 *
 * The core invariant: Semantic variables MUST alias Primitives.
 * Component variables MUST alias Semantic. Primitives hold raw values only.
 * Breakpoints is a parallel Tier 3 for responsive modes.
 *
 * @module tokens/three-tier-engine
 */

import type {
  TierLevel,
  TierConfig,
  TierArchitecture,
  VariableDefinition,
  VariableValue,
  AliasReference,
  DesignSystemSpec,
  PaletteSpec,
  TypographySpec,
  SpacingSpec,
  BreakpointSpec,
} from './schema';
import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';
import { generateColorScale, generateNeutralPalette } from '../color/palette-generator';
import { hexToAllFormats } from '../color/converter';

// ============================================================================
// SECTION 1: TIER RULES
// ============================================================================

/**
 * Defines which tiers a given tier is allowed to alias INTO.
 * Primitives: no aliases allowed (holds raw values only).
 * Semantic: can alias Primitives only.
 * Component: can alias Semantic only.
 * Breakpoints: can alias Semantic only (parallel Tier 3).
 */
const ALLOWED_ALIAS_TARGETS: Readonly<Record<TierLevel, readonly TierLevel[]>> = {
  primitives: [],
  semantic: ['primitives'],
  component: ['semantic'],
  breakpoints: ['semantic'],
};

/**
 * Human-readable tier names for error messages.
 */
const TIER_DISPLAY_NAMES: Readonly<Record<TierLevel, string>> = {
  primitives: 'Tier 1 (Primitives)',
  semantic: 'Tier 2 (Semantic)',
  component: 'Tier 3 (Component)',
  breakpoints: 'Tier 3 (Breakpoints)',
};

// ============================================================================
// SECTION 2: ALIAS VALIDATION
// ============================================================================

/** Checks whether a variable value is an alias reference. */
export function isAlias(value: VariableValue): value is AliasReference {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && (value as AliasReference).type === 'alias';
}

/**
 * Validate that a variable's alias targets are in the correct tier.
 *
 * @param variable - The variable definition to check.
 * @returns Ok if all aliases point to allowed tiers, Err with description otherwise.
 */
export function validateAliasChain(
  variable: VariableDefinition
): Result<void, string> {
  const allowed = ALLOWED_ALIAS_TARGETS[variable.tier];
  const tierName = TIER_DISPLAY_NAMES[variable.tier];

  for (const [modeName, value] of Object.entries(variable.values)) {
    if (!isAlias(value)) {
      // Primitives MUST hold raw values. Other tiers CAN hold raw values
      // (e.g., for fallbacks), but typically should alias.
      if (variable.tier !== 'primitives') {
        // Non-alias in a higher tier is allowed but worth noting.
        continue;
      }
      continue;
    }

    // This is an alias — validate the target tier
    if (variable.tier === 'primitives') {
      return R.err(
        `Variable "${variable.name}" is in ${tierName} but mode "${modeName}" contains an alias. ` +
        `Primitives must hold raw values only, not aliases.`
      );
    }

    // Check if we have enough info to validate the target tier.
    // The alias contains a collection name — we need to map it to a tier.
    // For now we validate the structural rule: the alias exists and is well-formed.
    if (!value.target || value.target.trim() === '') {
      return R.err(
        `Variable "${variable.name}" mode "${modeName}" has an alias with empty target.`
      );
    }
    if (!value.collection || value.collection.trim() === '') {
      return R.err(
        `Variable "${variable.name}" mode "${modeName}" has an alias with empty collection name.`
      );
    }
  }

  return R.ok(undefined);
}

/**
 * Validate alias chains across an entire set of variables, checking cross-tier references.
 *
 * @param variables - All variables in the design system.
 * @param tierMapping - Maps collection names to their tier level.
 */
export function validateCrossTierAliases(
  variables: ReadonlyArray<VariableDefinition>,
  tierMapping: Readonly<Record<string, TierLevel>>
): Result<void, string> {
  const errors: string[] = [];

  for (const variable of variables) {
    const allowed = ALLOWED_ALIAS_TARGETS[variable.tier];
    const tierName = TIER_DISPLAY_NAMES[variable.tier];

    for (const [modeName, value] of Object.entries(variable.values)) {
      if (!isAlias(value)) continue;

      const targetTier = tierMapping[value.collection];
      if (targetTier === undefined) {
        errors.push(
          `Variable "${variable.name}" mode "${modeName}" aliases collection "${value.collection}" ` +
          `which is not in the tier mapping. Register it first.`
        );
        continue;
      }

      if (!allowed.includes(targetTier)) {
        const targetTierName = TIER_DISPLAY_NAMES[targetTier];
        errors.push(
          `Variable "${variable.name}" in ${tierName} aliases "${value.target}" ` +
          `in ${targetTierName} (collection "${value.collection}"). ` +
          `${tierName} can only alias: ${allowed.map(t => TIER_DISPLAY_NAMES[t]).join(', ') || 'nothing (raw values only)'}.`
        );
      }
    }
  }

  if (errors.length > 0) {
    return R.err(errors.join('\n'));
  }
  return R.ok(undefined);
}

// ============================================================================
// SECTION 3: CIRCULAR REFERENCE DETECTION
// ============================================================================

/**
 * Detect circular alias references in a set of variables.
 *
 * Builds a dependency graph (variable → alias target) and uses DFS
 * cycle detection. Returns the first cycle found, if any.
 */
export function detectCircularAliases(
  variables: ReadonlyArray<VariableDefinition>
): Result<void, string> {
  // Build adjacency map: "collectionName/variableName" → set of targets
  const graph = new Map<string, Set<string>>();
  const nodeSet = new Set<string>();

  for (const variable of variables) {
    const nodeKey = variable.name;
    nodeSet.add(nodeKey);

    for (const value of Object.values(variable.values)) {
      if (!isAlias(value)) continue;
      const targetKey = value.target;
      if (!graph.has(nodeKey)) {
        graph.set(nodeKey, new Set());
      }
      graph.get(nodeKey)!.add(targetKey);
    }
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string | null {
    if (inStack.has(node)) {
      // Found cycle — extract it from path
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat(node);
      return cycle.join(' → ');
    }
    if (visited.has(node)) return null;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbors = graph.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        const cycle = dfs(neighbor);
        if (cycle !== null) return cycle;
      }
    }

    path.pop();
    inStack.delete(node);
    return null;
  }

  for (const node of nodeSet) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle !== null) {
        return R.err(`Circular alias detected: ${cycle}`);
      }
    }
  }

  return R.ok(undefined);
}

// ============================================================================
// SECTION 4: TIER ARCHITECTURE BUILDER
// ============================================================================

/**
 * Create a default tier architecture from a design system spec.
 */
export function buildTierArchitecture(spec: DesignSystemSpec): TierArchitecture {
  return {
    primitives: {
      collectionName: spec.tiers.primitives.collectionName,
      modes: spec.tiers.primitives.modes,
      description: 'Raw design tokens: colors, spacing, typography, radii, shadows',
      tier: 'primitives',
    },
    semantic: {
      collectionName: spec.tiers.semantic.collectionName,
      modes: spec.tiers.semantic.modes,
      description: 'Purpose-driven aliases: bg/primary, text/muted, border/default',
      tier: 'semantic',
    },
    component: {
      collectionName: spec.tiers.component.collectionName,
      modes: spec.tiers.component.modes,
      description: 'Theme-mapped component tokens: button/bg, card/border',
      tier: 'component',
    },
    breakpoints: spec.tiers.breakpoints ? {
      collectionName: spec.tiers.breakpoints.collectionName,
      modes: spec.tiers.breakpoints.modes,
      description: 'Responsive breakpoint tokens: typography, spacing per viewport',
      tier: 'breakpoints',
    } : undefined,
  };
}

/**
 * Build a collection-name → tier-level mapping from the architecture.
 */
export function buildTierMapping(arch: TierArchitecture): Record<string, TierLevel> {
  const mapping: Record<string, TierLevel> = {
    [arch.primitives.collectionName]: 'primitives',
    [arch.semantic.collectionName]: 'semantic',
    [arch.component.collectionName]: 'component',
  };
  if (arch.breakpoints) {
    mapping[arch.breakpoints.collectionName] = 'breakpoints';
  }
  return mapping;
}

// ============================================================================
// SECTION 5: PRIMITIVE TOKEN GENERATION
// ============================================================================

/**
 * Generate Tier 1 (Primitives) variable definitions from a spec.
 *
 * Produces: color scales, spacing scale, typography tokens, and neutral palette.
 */
export function generatePrimitives(spec: DesignSystemSpec): VariableDefinition[] {
  const variables: VariableDefinition[] = [];
  const mode = spec.tiers.primitives.modes[0] || 'Value';

  // --- Color primitives ---
  variables.push(...generateColorPrimitives(spec.palette, mode));

  // --- Spacing primitives ---
  variables.push(...generateSpacingPrimitives(spec.spacing, mode));

  // --- Typography primitives ---
  variables.push(...generateTypographyPrimitives(spec.typography, mode));

  return variables;
}

function generateColorPrimitives(
  palette: PaletteSpec,
  mode: string
): VariableDefinition[] {
  const variables: VariableDefinition[] = [];

  const colorEntries: Array<[string, string]> = [
    ['primary', palette.primary],
  ];
  if (palette.secondary) colorEntries.push(['secondary', palette.secondary]);
  if (palette.accent) colorEntries.push(['accent', palette.accent]);
  if (palette.error) colorEntries.push(['error', palette.error]);
  if (palette.warning) colorEntries.push(['warning', palette.warning]);
  if (palette.success) colorEntries.push(['success', palette.success]);
  if (palette.info) colorEntries.push(['info', palette.info]);

  for (const [name, hex] of colorEntries) {
    const scale = generateColorScale(hex, name);
    for (const step of scale.steps) {
      variables.push({
        name: `color/${name}-${step.shade}`,
        type: 'color',
        scopes: ['ALL_FILLS', 'STROKE_COLOR'],
        values: { [mode]: step.color },
        tier: 'primitives',
      });
    }
  }

  // Neutral palette (tinted with primary hue)
  const neutralScale = generateNeutralPalette(palette.primary);
  for (const step of neutralScale.steps) {
    variables.push({
      name: `color/neutral-${step.shade}`,
      type: 'color',
      scopes: ['ALL_FILLS', 'STROKE_COLOR'],
      values: { [mode]: step.color },
      tier: 'primitives',
    });
  }

  // Pure white and black
  variables.push({
    name: 'color/white',
    type: 'color',
    scopes: ['ALL_FILLS', 'STROKE_COLOR'],
    values: { [mode]: hexToAllFormats('#FFFFFF') },
    tier: 'primitives',
  });
  variables.push({
    name: 'color/black',
    type: 'color',
    scopes: ['ALL_FILLS', 'STROKE_COLOR'],
    values: { [mode]: hexToAllFormats('#000000') },
    tier: 'primitives',
  });

  return variables;
}

function generateSpacingPrimitives(
  spacing: SpacingSpec,
  mode: string
): VariableDefinition[] {
  const SPACING_NAMES: Readonly<Record<number, string>> = {
    0: 'none',
    1: 'xs',
    2: 'sm',
    3: 'md',
    4: 'lg',
    5: 'xl',
    6: '2xl',
    8: '3xl',
    10: '4xl',
    12: '5xl',
    16: '6xl',
    20: '7xl',
    24: '8xl',
  };

  return spacing.scale.map((multiplier, index) => {
    const value = multiplier * spacing.baseUnit;
    const name = SPACING_NAMES[multiplier] || `${multiplier}`;
    return {
      name: `spacing/${name}`,
      type: 'float' as const,
      scopes: ['GAP', 'WIDTH_HEIGHT'],
      values: { [mode]: value },
      tier: 'primitives' as const,
    };
  });
}

function generateTypographyPrimitives(
  typography: TypographySpec,
  mode: string
): VariableDefinition[] {
  const variables: VariableDefinition[] = [];
  const ratio = typography.scaleRatio || 1.25; // Major third default
  const base = typography.baseFontSize;

  // Font families
  variables.push({
    name: 'font/heading',
    type: 'string',
    scopes: ['FONT_FAMILY'],
    values: { [mode]: typography.headingFont },
    tier: 'primitives',
  });
  variables.push({
    name: 'font/body',
    type: 'string',
    scopes: ['FONT_FAMILY'],
    values: { [mode]: typography.bodyFont },
    tier: 'primitives',
  });
  if (typography.monoFont) {
    variables.push({
      name: 'font/mono',
      type: 'string',
      scopes: ['FONT_FAMILY'],
      values: { [mode]: typography.monoFont },
      tier: 'primitives',
    });
  }

  // Font sizes (modular scale)
  const sizeNames = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
  // base is at index 2 (third item), so we compute relative to that
  for (let i = 0; i < sizeNames.length; i++) {
    const power = i - 2; // xs = -2, sm = -1, base = 0, lg = 1, ...
    const size = Math.round(base * Math.pow(ratio, power) * 100) / 100;
    variables.push({
      name: `fontSize/${sizeNames[i]}`,
      type: 'float',
      scopes: ['FONT_SIZE'],
      values: { [mode]: size },
      tier: 'primitives',
    });
  }

  // Line heights
  const lineHeights: Array<[string, number]> = [
    ['tight', 1.25],
    ['normal', 1.5],
    ['relaxed', 1.75],
  ];
  for (const [name, value] of lineHeights) {
    variables.push({
      name: `lineHeight/${name}`,
      type: 'float',
      scopes: ['LINE_HEIGHT'],
      values: { [mode]: value },
      tier: 'primitives',
    });
  }

  // Font weights
  const weights: Array<[string, number]> = [
    ['regular', 400],
    ['medium', 500],
    ['semibold', 600],
    ['bold', 700],
  ];
  for (const [name, value] of weights) {
    variables.push({
      name: `fontWeight/${name}`,
      type: 'float',
      scopes: ['FONT_WEIGHT'],
      values: { [mode]: value },
      tier: 'primitives',
    });
  }

  return variables;
}

// ============================================================================
// SECTION 6: SEMANTIC TOKEN GENERATION
// ============================================================================

/**
 * Generate Tier 2 (Semantic) variable definitions.
 *
 * These are purpose-driven aliases into Tier 1 primitives.
 * Each value is an AliasReference pointing to a primitive variable.
 */
export function generateSemanticTokens(
  spec: DesignSystemSpec
): VariableDefinition[] {
  const primitivesCollection = spec.tiers.primitives.collectionName;
  const modes = spec.tiers.semantic.modes;
  const variables: VariableDefinition[] = [];
  const palette = spec.palette;

  // Helper to create an alias reference
  const alias = (target: string): AliasReference => ({
    type: 'alias',
    target,
    collection: primitivesCollection,
  });

  // Helper to create values across all semantic modes (typically just "Value")
  const modeValues = (target: string): Record<string, AliasReference> => {
    const values: Record<string, AliasReference> = {};
    for (const mode of modes) {
      values[mode] = alias(target);
    }
    return values;
  };

  // --- Background semantics ---
  const bgMappings: Array<[string, string]> = [
    ['bg/primary', 'color/primary-500'],
    ['bg/secondary', 'color/neutral-100'],
    ['bg/surface', 'color/white'],
    ['bg/muted', 'color/neutral-200'],
    ['bg/accent', 'color/primary-100'],
  ];
  if (palette.error) bgMappings.push(['bg/destructive', 'color/error-500']);
  if (palette.success) bgMappings.push(['bg/success', 'color/success-500']);
  if (palette.warning) bgMappings.push(['bg/warning', 'color/warning-500']);

  for (const [name, target] of bgMappings) {
    variables.push({
      name,
      type: 'color',
      scopes: ['FRAME_FILL', 'SHAPE_FILL'],
      values: modeValues(target),
      tier: 'semantic',
    });
  }

  // --- Text semantics ---
  const textMappings: Array<[string, string]> = [
    ['text/primary', 'color/neutral-900'],
    ['text/secondary', 'color/neutral-600'],
    ['text/muted', 'color/neutral-400'],
    ['text/inverse', 'color/white'],
    ['text/link', 'color/primary-600'],
  ];
  if (palette.error) textMappings.push(['text/destructive', 'color/error-700']);
  if (palette.success) textMappings.push(['text/success', 'color/success-700']);

  for (const [name, target] of textMappings) {
    variables.push({
      name,
      type: 'color',
      scopes: ['TEXT_FILL'],
      values: modeValues(target),
      tier: 'semantic',
    });
  }

  // --- Border semantics ---
  const borderMappings: Array<[string, string]> = [
    ['border/default', 'color/neutral-200'],
    ['border/strong', 'color/neutral-400'],
    ['border/focus', 'color/primary-500'],
  ];
  if (palette.error) borderMappings.push(['border/destructive', 'color/error-500']);

  for (const [name, target] of borderMappings) {
    variables.push({
      name,
      type: 'color',
      scopes: ['STROKE_COLOR'],
      values: modeValues(target),
      tier: 'semantic',
    });
  }

  // --- Spacing semantics ---
  const spacingMappings: Array<[string, string]> = [
    ['spacing/page-margin', 'spacing/xl'],
    ['spacing/section-gap', 'spacing/3xl'],
    ['spacing/card-padding', 'spacing/lg'],
    ['spacing/input-padding', 'spacing/sm'],
    ['spacing/inline-gap', 'spacing/xs'],
  ];

  for (const [name, target] of spacingMappings) {
    variables.push({
      name,
      type: 'float',
      scopes: ['GAP', 'WIDTH_HEIGHT'],
      values: modeValues(target),
      tier: 'semantic',
    });
  }

  return variables;
}

// ============================================================================
// SECTION 7: COMPONENT TOKEN GENERATION
// ============================================================================

/**
 * Generate Tier 3 (Component/Mapped) variable definitions.
 *
 * These are theme-aware tokens. Each mode (Light/Dark) maps to different
 * Semantic aliases — this is where theming happens.
 */
export function generateComponentTokens(
  spec: DesignSystemSpec
): VariableDefinition[] {
  const semanticCollection = spec.tiers.semantic.collectionName;
  const modes = spec.tiers.component.modes;
  const palette = spec.palette;
  const variables: VariableDefinition[] = [];

  // Helper: create per-mode alias values with different targets per mode
  const themedAlias = (
    targets: Readonly<Record<string, string>>
  ): Record<string, AliasReference> => {
    const values: Record<string, AliasReference> = {};
    for (const mode of modes) {
      const target = targets[mode];
      if (target) {
        values[mode] = { type: 'alias', target, collection: semanticCollection };
      }
    }
    return values;
  };

  // If we don't have Light/Dark, just map everything the same
  const hasThemes = modes.length > 1;

  // For a default Light/Dark setup, swap key values for dark mode
  const lightTarget = (light: string, dark: string): Record<string, string> => {
    if (!hasThemes) {
      return { [modes[0]!]: light };
    }
    const targets: Record<string, string> = {};
    for (const mode of modes) {
      targets[mode] = mode.toLowerCase().includes('dark') ? dark : light;
    }
    return targets;
  };

  // --- Surface tokens (theme-aware) ---
  variables.push({
    name: 'surface/background',
    type: 'color',
    scopes: ['FRAME_FILL'],
    values: themedAlias(lightTarget('bg/surface', 'bg/primary')),
    tier: 'component',
  });
  variables.push({
    name: 'surface/card',
    type: 'color',
    scopes: ['FRAME_FILL'],
    values: themedAlias(lightTarget('bg/secondary', 'bg/muted')),
    tier: 'component',
  });
  variables.push({
    name: 'surface/overlay',
    type: 'color',
    scopes: ['FRAME_FILL'],
    values: themedAlias(lightTarget('bg/muted', 'bg/secondary')),
    tier: 'component',
  });

  // --- Text tokens (theme-aware) ---
  variables.push({
    name: 'content/primary',
    type: 'color',
    scopes: ['TEXT_FILL'],
    values: themedAlias(lightTarget('text/primary', 'text/inverse')),
    tier: 'component',
  });
  variables.push({
    name: 'content/secondary',
    type: 'color',
    scopes: ['TEXT_FILL'],
    values: themedAlias(lightTarget('text/secondary', 'text/muted')),
    tier: 'component',
  });

  // --- Border tokens (theme-aware) ---
  variables.push({
    name: 'outline/default',
    type: 'color',
    scopes: ['STROKE_COLOR'],
    values: themedAlias(lightTarget('border/default', 'border/strong')),
    tier: 'component',
  });
  variables.push({
    name: 'outline/focus',
    type: 'color',
    scopes: ['STROKE_COLOR'],
    values: themedAlias(lightTarget('border/focus', 'border/focus')),
    tier: 'component',
  });

  // --- Interactive tokens ---
  variables.push({
    name: 'interactive/primary',
    type: 'color',
    scopes: ['ALL_FILLS'],
    values: themedAlias(lightTarget('bg/primary', 'bg/accent')),
    tier: 'component',
  });
  if (palette.error) {
    variables.push({
      name: 'interactive/destructive',
      type: 'color',
      scopes: ['ALL_FILLS'],
      values: themedAlias(lightTarget('bg/destructive', 'bg/destructive')),
      tier: 'component',
    });
  }

  // --- Feedback tokens (only when palette colors are defined) ---
  if (palette.success) {
    variables.push({
      name: 'feedback/success',
      type: 'color',
      scopes: ['ALL_FILLS'],
      values: themedAlias(lightTarget('bg/success', 'bg/success')),
      tier: 'component',
    });
  }
  if (palette.warning) {
    variables.push({
      name: 'feedback/warning',
      type: 'color',
      scopes: ['ALL_FILLS'],
      values: themedAlias(lightTarget('bg/warning', 'bg/warning')),
      tier: 'component',
    });
  }

  return variables;
}

// ============================================================================
// SECTION 8: FULL SYSTEM GENERATION
// ============================================================================

/**
 * Generate all variables for a complete design system from a spec.
 *
 * Returns variables organized by tier, ready for Figma creation.
 */
export function generateAllTokens(spec: DesignSystemSpec): Result<{
  primitives: VariableDefinition[];
  semantic: VariableDefinition[];
  component: VariableDefinition[];
}, string> {
  const primitives = generatePrimitives(spec);
  const semantic = generateSemanticTokens(spec);
  const component = generateComponentTokens(spec);

  const allVariables = [...primitives, ...semantic, ...component];

  // Validate: no circular aliases
  const circularCheck = detectCircularAliases(allVariables);
  if (!circularCheck.ok) return circularCheck;

  // Validate: cross-tier alias rules
  const tierMapping = buildTierMapping(spec.tiers);
  const crossTierCheck = validateCrossTierAliases(allVariables, tierMapping);
  if (!crossTierCheck.ok) return crossTierCheck;

  return R.ok({ primitives, semantic, component });
}
