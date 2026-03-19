/**
 * Token Generator — Phase 3 of the Learning Engine.
 *
 * Bridges the gap between the Learning Engine's recommendations
 * and the Three-Tier Engine's concrete token generation.
 *
 * Pipeline: study → learn → **generate**
 *
 * The generator takes:
 *   1. A `GenerationRecommendation` (from Phase 2 — learned structural patterns)
 *   2. A `DesignSystemSpec` (from the user's config UI selections)
 *
 * And produces:
 *   - An adapted `DesignSystemSpec` that incorporates learned patterns
 *   - A `GeneratedTokenSystem` containing all `VariableDefinition[]` organized by tier
 *
 * The generator does NOT replace the Three-Tier Engine — it **configures** it
 * using learned recommendations, then delegates token creation to it.
 *
 * @module core/learning/token-generator
 */

import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';
import type {
  DesignSystemSpec,
  VariableDefinition,
  TierArchitecture,
  TierConfig,
  TierLevel,
  PaletteSpec,
  SpacingSpec,
  BreakpointSpec,
} from '../tokens/schema';
import type {
  GenerationRecommendation,
  RecommendedTier,
} from './learner';
import type { CollectionTier, NamingSeparator } from './types';
import {
  generatePrimitives,
  generateSemanticTokens,
  generateComponentTokens,
  detectCircularAliases,
  validateCrossTierAliases,
  buildTierMapping,
} from '../tokens/three-tier-engine';

// ============================================================================
// SECTION 1: OUTPUT TYPES
// ============================================================================

/** The output of the generate phase — a complete token system ready for Figma. */
export interface GeneratedTokenSystem {
  /** The adapted spec that was used for generation. */
  readonly spec: DesignSystemSpec;

  /** Variables organized by tier, in creation order. */
  readonly tiers: readonly GeneratedTier[];

  /** Flat list of all variables across all tiers. */
  readonly allVariables: readonly VariableDefinition[];

  /** Summary of what was generated. */
  readonly summary: GenerationSummary;

  /** How the recommendation influenced the output. */
  readonly adaptations: readonly string[];
}

/** A single generated tier with its collection config and variables. */
export interface GeneratedTier {
  /** Collection name to create in Figma. */
  readonly collectionName: string;

  /** Tier classification. */
  readonly tier: TierLevel;

  /** Modes for this collection. */
  readonly modes: readonly string[];

  /** Variables belonging to this tier. */
  readonly variables: readonly VariableDefinition[];

  /** Purpose description. */
  readonly purpose: string;
}

/** Summary statistics of the generated token system. */
export interface GenerationSummary {
  /** Total variables across all tiers. */
  readonly totalVariables: number;

  /** Variables per tier. */
  readonly variablesPerTier: Readonly<Record<string, number>>;

  /** Total collections created. */
  readonly totalCollections: number;

  /** Total modes across all collections. */
  readonly totalModes: number;

  /** Color palette count. */
  readonly paletteCount: number;

  /** Whether the system includes breakpoints. */
  readonly hasBreakpoints: boolean;

  /** Naming separator used. */
  readonly separator: string;

  /** Shade count per palette. */
  readonly shadeCount: number;
}

// ============================================================================
// SECTION 2: GENERATOR CLASS
// ============================================================================

/**
 * TokenGenerator — Creates token systems by adapting user config with
 * learned recommendations.
 */
export class TokenGenerator {
  /**
   * Generate a complete token system from a user spec + learned recommendation.
   *
   * If no recommendation is provided, uses the spec as-is (pure three-tier
   * engine defaults).
   *
   * @param spec - The user's design system specification from config UI
   * @param recommendation - Optional learned recommendations from Phase 2
   * @returns Result with GeneratedTokenSystem or error string
   */
  generate(
    spec: DesignSystemSpec,
    recommendation?: GenerationRecommendation,
  ): Result<GeneratedTokenSystem, string> {
    const adaptations: string[] = [];

    // Step 1: Adapt the spec based on recommendations
    const adaptedSpec = recommendation
      ? this.adaptSpec(spec, recommendation, adaptations)
      : spec;

    // Step 2: Generate all token tiers using the three-tier engine
    const primitives = generatePrimitives(adaptedSpec);
    const semantic = generateSemanticTokens(adaptedSpec);
    const component = generateComponentTokens(adaptedSpec);

    // Rename variables if recommendation uses different separator
    const separator = recommendation?.namingSeparator ?? '/';
    const renamedPrimitives = this.applyNaming(primitives, separator, '/');
    const renamedSemantic = this.applyNaming(semantic, separator, '/');
    const renamedComponent = this.applyNaming(component, separator, '/');

    // Step 3: Validate the complete system
    const allVariables = [...renamedPrimitives, ...renamedSemantic, ...renamedComponent];

    const circularCheck = detectCircularAliases(allVariables);
    if (!circularCheck.ok) {
      return R.err(
        `Generated token system has circular aliases: ${circularCheck.error}. ` +
        'This is a bug in the token generator — please report it.',
      );
    }

    const tierMapping = buildTierMapping(adaptedSpec.tiers);
    const crossTierCheck = validateCrossTierAliases(allVariables, tierMapping);
    if (!crossTierCheck.ok) {
      return R.err(
        `Generated token system has cross-tier alias violations: ${crossTierCheck.error}. ` +
        'This is a bug in the token generator — please report it.',
      );
    }

    // Step 4: Build tier output structures
    const tiers: GeneratedTier[] = [
      {
        collectionName: adaptedSpec.tiers.primitives.collectionName,
        tier: 'primitives',
        modes: [...adaptedSpec.tiers.primitives.modes],
        variables: renamedPrimitives,
        purpose: 'Raw atomic values — colors, spacing, typography. No aliases.',
      },
      {
        collectionName: adaptedSpec.tiers.semantic.collectionName,
        tier: 'semantic',
        modes: [...adaptedSpec.tiers.semantic.modes],
        variables: renamedSemantic,
        purpose: 'Purpose-driven aliases into Primitives. Theme modes live here.',
      },
      {
        collectionName: adaptedSpec.tiers.component.collectionName,
        tier: 'component',
        modes: [...adaptedSpec.tiers.component.modes],
        variables: renamedComponent,
        purpose: 'Component-level tokens aliasing Semantic. Closest to usage.',
      },
    ];

    // Add breakpoints tier if specified
    if (adaptedSpec.breakpoints && adaptedSpec.tiers.breakpoints) {
      const breakpointVars = this.generateBreakpointTokens(adaptedSpec);
      const renamedBreakpoints = this.applyNaming(breakpointVars, separator, '/');
      allVariables.push(...renamedBreakpoints);

      tiers.push({
        collectionName: adaptedSpec.tiers.breakpoints.collectionName,
        tier: 'breakpoints',
        modes: [...adaptedSpec.tiers.breakpoints.modes],
        variables: renamedBreakpoints,
        purpose: 'Responsive tokens with per-breakpoint values.',
      });
    }

    // Step 5: Build summary
    const variablesPerTier: Record<string, number> = {};
    let totalModes = 0;
    for (const tier of tiers) {
      variablesPerTier[tier.collectionName] = tier.variables.length;
      totalModes += tier.modes.length;
    }

    const paletteColors = this.countPaletteColors(adaptedSpec.palette);
    const shadeCount = recommendation?.colorShadeCount ?? 11;

    const summary: GenerationSummary = {
      totalVariables: allVariables.length,
      variablesPerTier,
      totalCollections: tiers.length,
      totalModes,
      paletteCount: paletteColors,
      hasBreakpoints: adaptedSpec.breakpoints !== undefined,
      separator,
      shadeCount,
    };

    return R.ok({
      spec: adaptedSpec,
      tiers,
      allVariables,
      summary,
      adaptations,
    });
  }

  // ==========================================================================
  // SECTION 3: SPEC ADAPTATION
  // ==========================================================================

  /**
   * Adapt the user's spec by incorporating learned recommendations.
   *
   * This is where learning meets configuration:
   * - Tier names and modes from recommendations
   * - Breakpoint structure if sources used responsive modes
   * - Separator for naming is tracked but applied during renaming
   *
   * The user's CONTENT choices (colors, fonts, spacing) are preserved.
   * Only STRUCTURAL choices are adapted from the recommendation.
   */
  private adaptSpec(
    spec: DesignSystemSpec,
    recommendation: GenerationRecommendation,
    adaptations: string[],
  ): DesignSystemSpec {
    // Adapt tier architecture
    const adaptedTiers = this.adaptTierArchitecture(
      spec.tiers,
      recommendation,
      adaptations,
    );

    // Adapt breakpoints if recommendation includes responsive tier
    const adaptedBreakpoints = this.adaptBreakpoints(
      spec.breakpoints,
      recommendation,
      adaptations,
    );

    return {
      ...spec,
      tiers: adaptedTiers,
      breakpoints: adaptedBreakpoints,
    };
  }

  /**
   * Adapt tier architecture based on recommendations.
   *
   * Preserves the user's collection names if they set them,
   * but uses recommended modes and structure.
   */
  private adaptTierArchitecture(
    userTiers: TierArchitecture,
    recommendation: GenerationRecommendation,
    adaptations: string[],
  ): TierArchitecture {
    // Find recommended tiers by classification
    const recPrimitive = recommendation.recommendedTiers.find(t => t.tier === 'primitive');
    const recSemantic = recommendation.recommendedTiers.find(
      t => t.tier === 'semantic' || t.tier === 'mapped',
    );
    const recComponent = recommendation.recommendedTiers.find(t => t.tier === 'component');
    const recBreakpoints = recommendation.recommendedTiers.find(t => t.tier === 'responsive');

    // Primitives — preserve user name, adapt modes if recommendation differs
    const primitives = this.adaptSingleTier(
      userTiers.primitives,
      recPrimitive,
      'primitives',
      adaptations,
    );

    // Semantic
    const semantic = this.adaptSingleTier(
      userTiers.semantic,
      recSemantic,
      'semantic',
      adaptations,
    );

    // Component
    const component = this.adaptSingleTier(
      userTiers.component,
      recComponent,
      'component',
      adaptations,
    );

    // Breakpoints — create if recommendation suggests it, or preserve user's
    let breakpoints: TierConfig | undefined = userTiers.breakpoints;
    if (!breakpoints && recBreakpoints) {
      breakpoints = {
        collectionName: recBreakpoints.name,
        modes: [...recBreakpoints.modes],
        tier: 'breakpoints',
        description: recBreakpoints.purpose,
      };
      adaptations.push(
        `Added Breakpoints tier "${recBreakpoints.name}" with modes ` +
        `[${recBreakpoints.modes.join(', ')}] (from learned sources)`,
      );
    }

    return { primitives, semantic, component, breakpoints };
  }

  /**
   * Adapt a single tier's config, merging user choices with recommendations.
   */
  private adaptSingleTier(
    userTier: TierConfig,
    recommended: RecommendedTier | undefined,
    tierLevel: TierLevel,
    adaptations: string[],
  ): TierConfig {
    if (!recommended) return userTier;

    // Preserve user's collection name if they explicitly set one
    // (non-default names indicate intentional choice)
    const collectionName = userTier.collectionName;

    // Adapt modes if recommendation has different (richer) modes
    let modes = userTier.modes;
    if (recommended.modes.length > userTier.modes.length) {
      modes = [...recommended.modes];
      adaptations.push(
        `${collectionName}: expanded modes from [${userTier.modes.join(', ')}] ` +
        `to [${modes.join(', ')}] (from learned sources)`,
      );
    }

    return {
      ...userTier,
      collectionName,
      modes,
      tier: tierLevel,
    };
  }

  /**
   * Adapt breakpoints from recommendation if user didn't specify any.
   */
  private adaptBreakpoints(
    userBreakpoints: BreakpointSpec | undefined,
    recommendation: GenerationRecommendation,
    adaptations: string[],
  ): BreakpointSpec | undefined {
    if (userBreakpoints) return userBreakpoints;

    const recBreakpoints = recommendation.recommendedTiers.find(t => t.tier === 'responsive');
    if (!recBreakpoints) return undefined;

    // Generate default breakpoint widths for recommended modes
    const widths: Record<string, number> = {};
    const defaultWidths: Record<string, number> = {
      Desktop: 1440,
      Tablet: 768,
      Mobile: 375,
      Large: 1440,
      Medium: 768,
      Small: 375,
    };

    for (const mode of recBreakpoints.modes) {
      widths[mode] = defaultWidths[mode] ?? 1024;
    }

    adaptations.push(
      `Added responsive breakpoints [${recBreakpoints.modes.join(', ')}] from learned sources`,
    );

    return {
      modes: [...recBreakpoints.modes],
      widths,
    };
  }

  // ==========================================================================
  // SECTION 4: NAMING ADAPTATION
  // ==========================================================================

  /**
   * Rename all variable paths to use the recommended separator.
   *
   * The three-tier engine generates paths with "/" (e.g., "color/primary-500").
   * If the learned recommendation uses a different separator (e.g., "."),
   * this converts all paths: "color/primary-500" → "color.primary-500".
   *
   * Also renames alias targets to match.
   */
  private applyNaming(
    variables: VariableDefinition[],
    targetSeparator: NamingSeparator,
    sourceSeparator: string,
  ): VariableDefinition[] {
    if (targetSeparator === sourceSeparator) return variables;

    return variables.map(v => {
      const newName = v.name.split(sourceSeparator).join(targetSeparator);

      // Also rename alias targets
      const newValues: Record<string, unknown> = {};
      for (const [mode, value] of Object.entries(v.values)) {
        if (typeof value === 'object' && value !== null && 'type' in value) {
          const alias = value as { type: string; target: string; collection: string };
          if (alias.type === 'alias') {
            newValues[mode] = {
              type: 'alias',
              target: alias.target.split(sourceSeparator).join(targetSeparator),
              collection: alias.collection,
            };
            continue;
          }
        }
        newValues[mode] = value;
      }

      return {
        ...v,
        name: newName,
        values: newValues as VariableDefinition['values'],
      };
    });
  }

  // ==========================================================================
  // SECTION 5: BREAKPOINT TOKEN GENERATION
  // ==========================================================================

  /**
   * Generate breakpoint-responsive tokens (Tier 3b).
   *
   * These create per-breakpoint values for typography and spacing,
   * enabling responsive design tokens.
   */
  private generateBreakpointTokens(spec: DesignSystemSpec): VariableDefinition[] {
    if (!spec.breakpoints || !spec.tiers.breakpoints) return [];

    const variables: VariableDefinition[] = [];
    const modes = spec.breakpoints.modes;
    const semanticCollection = spec.tiers.semantic.collectionName;

    // Responsive font sizes: scale down for smaller breakpoints
    const fontSizeScales: Record<string, number> = {};
    for (let i = 0; i < modes.length; i++) {
      const mode = modes[i] ?? 'Desktop';
      // First mode (usually Desktop) = 1.0, subsequent modes scale down
      fontSizeScales[mode] = i === 0 ? 1.0 : (i === 1 ? 0.875 : 0.75);
    }

    // Heading responsive sizes
    const headingNames = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const baseHeadingSizes = [48, 36, 28, 24, 20, 16];

    for (let i = 0; i < headingNames.length; i++) {
      const heading = headingNames[i] ?? `h${i + 1}`;
      const baseSize = baseHeadingSizes[i] ?? 16;
      const values: Record<string, number> = {};

      for (const mode of modes) {
        const scale = fontSizeScales[mode] ?? 1.0;
        values[mode] = Math.round(baseSize * scale);
      }

      variables.push({
        name: `fontSize/heading-${heading}`,
        type: 'float',
        scopes: ['FONT_SIZE'],
        values,
        tier: 'breakpoints',
      });
    }

    // Responsive spacing: reduce padding/margins for smaller viewports
    const spacingNames = ['page-margin', 'section-gap', 'card-padding'];
    const baseSpacingValues = [80, 64, 24];
    const spacingScales: Record<string, number> = {};
    for (let i = 0; i < modes.length; i++) {
      const mode = modes[i] ?? 'Desktop';
      spacingScales[mode] = i === 0 ? 1.0 : (i === 1 ? 0.75 : 0.5);
    }

    for (let i = 0; i < spacingNames.length; i++) {
      const spacingName = spacingNames[i] ?? `spacing-${i}`;
      const baseValue = baseSpacingValues[i] ?? 16;
      const values: Record<string, number> = {};

      for (const mode of modes) {
        const scale = spacingScales[mode] ?? 1.0;
        values[mode] = Math.round(baseValue * scale);
      }

      variables.push({
        name: `spacing/${spacingName}`,
        type: 'float',
        scopes: ['GAP', 'WIDTH_HEIGHT'],
        values,
        tier: 'breakpoints',
      });
    }

    return variables;
  }

  // ==========================================================================
  // SECTION 6: UTILITY METHODS
  // ==========================================================================

  /** Count how many palette colors are defined in the spec. */
  private countPaletteColors(palette: PaletteSpec): number {
    let count = 1; // primary always exists
    if (palette.secondary) count++;
    if (palette.accent) count++;
    if (palette.neutral) count++;
    if (palette.error) count++;
    if (palette.warning) count++;
    if (palette.success) count++;
    if (palette.info) count++;
    return count;
  }
}

// ============================================================================
// SECTION 7: CONVENIENCE FUNCTION
// ============================================================================

/**
 * Generate a token system from a spec + optional recommendation.
 *
 * Convenience wrapper around `TokenGenerator.generate()`.
 *
 * @param spec - User's design system specification
 * @param recommendation - Optional learned recommendations
 * @returns Result with GeneratedTokenSystem or error
 */
export function generateTokenSystem(
  spec: DesignSystemSpec,
  recommendation?: GenerationRecommendation,
): Result<GeneratedTokenSystem, string> {
  const generator = new TokenGenerator();
  return generator.generate(spec, recommendation);
}
