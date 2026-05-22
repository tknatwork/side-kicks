/**
 * Learner — Orchestrates the study → learn → generate pipeline.
 *
 * This module ties together the three phases of the Learning Engine:
 *
 *   1. **study()** — Runs extractors on source data to produce StructuralFingerprints
 *   2. **learn()** — Feeds fingerprints into the PatternSynthesizer to find common patterns
 *   3. **recommend()** — Translates synthesis output into actionable generation recommendations
 *
 * The generate phase (Phase 3) is separate — it lives in the token engine and
 * uses the recommendations from learn() to produce DSB-native token structures.
 *
 * Usage:
 * ```ts
 * const learner = new DesignSystemLearner();
 *
 * // Study one or more sources
 * const r1 = learner.study(figmaJsonString, {
 *   sourceName: 'Ant Design X',
 *   formatHint: 'figma-extractor-json',
 * });
 * const r2 = learner.study(cssString, {
 *   sourceName: 'Tailwind CSS',
 *   formatHint: 'css-variables',
 * });
 *
 * // Learn from all studied fingerprints
 * const synthesis = learner.learn();
 *
 * // Get generation recommendations
 * const recommendations = learner.recommend();
 * ```
 *
 * @module core/learning/learner
 */

import type {
  StructuralFingerprint,
  PatternSynthesis,
  ExtractionResult,
  ExtractorConfig,
  SourceFormat,
  NamingSeparator,
  CollectionTier,
} from './types';
import type { FingerprintExtractor } from './fingerprint-extractor';
import { FigmaTokenExtractor } from './extractors/figma-token-extractor';
import { CssTokenExtractor } from './extractors/css-token-extractor';
import { DtcgTokenExtractor } from './extractors/dtcg-token-extractor';
import { synthesizePatterns } from './pattern-synthesizer';

// ============================================================================
// SECTION 1: RECOMMENDATION TYPES
// ============================================================================

/** Actionable recommendations for the generation phase. */
export interface GenerationRecommendation {
  /** Recommended number of tiers (collections) to create. */
  readonly recommendedTierCount: number;

  /** Recommended tier structure (ordered from primitive to component). */
  readonly recommendedTiers: readonly RecommendedTier[];

  /** Recommended naming separator for variable paths. */
  readonly namingSeparator: NamingSeparator;

  /** Recommended number of shade steps per color palette. */
  readonly colorShadeCount: number;

  /** Whether to use cross-collection alias chains. */
  readonly useCrossCollectionAliases: boolean;

  /** Recommended alias chain depth (max). */
  readonly maxAliasDepth: number;

  /** Whether generated styles should bind to variables. */
  readonly bindStylesToVariables: boolean;

  /** Confidence level: how many sources agreed on these recommendations. */
  readonly confidence: RecommendationConfidence;

  /** Human-readable explanation of why these recommendations were chosen. */
  readonly rationale: readonly string[];

  /** The synthesis that produced these recommendations. */
  readonly synthesis: PatternSynthesis;
}

/** A single recommended tier / collection to create. */
export interface RecommendedTier {
  /** Suggested collection name. */
  readonly name: string;

  /** Tier classification. */
  readonly tier: CollectionTier;

  /** Suggested modes for this collection. */
  readonly modes: readonly string[];

  /** Brief description of what this tier holds. */
  readonly purpose: string;
}

/** How confident we are in the recommendations. */
export type RecommendationConfidence = 'high' | 'medium' | 'low' | 'single-source';

// ============================================================================
// SECTION 2: LEARNER CLASS
// ============================================================================

/**
 * DesignSystemLearner — The main entry point for the Learning Engine.
 *
 * Maintains a collection of studied fingerprints and provides
 * synthesis and recommendation capabilities.
 */
export class DesignSystemLearner {
  /** Accumulated fingerprints from study() calls. */
  private readonly fingerprints: StructuralFingerprint[] = [];

  /** Extraction results (includes warnings, timing). */
  private readonly extractionResults: ExtractionResult[] = [];

  /** Cached synthesis (invalidated when new fingerprints are added). */
  private cachedSynthesis: PatternSynthesis | null = null;

  /** Available extractors by format. */
  private readonly extractors: Map<SourceFormat, FingerprintExtractor>;

  constructor() {
    this.extractors = new Map<SourceFormat, FingerprintExtractor>();
    this.extractors.set('figma-extractor-json', new FigmaTokenExtractor());
    this.extractors.set('css-variables', new CssTokenExtractor());
    this.extractors.set('dtcg-json', new DtcgTokenExtractor());
  }

  // ==========================================================================
  // SECTION 2a: STUDY — Extract fingerprints from source data
  // ==========================================================================

  /**
   * Study a source design system by extracting its structural fingerprint.
   *
   * @param rawData - The raw source data (JSON string, CSS text, etc.)
   * @param config - Configuration specifying source name and format hint
   * @returns ExtractionResult with fingerprint (if successful) and any warnings
   */
  study(rawData: string, config: ExtractorConfig): ExtractionResult {
    const format = config.formatHint ?? this.detectFormat(rawData);
    const extractor = this.extractors.get(format);

    if (!extractor) {
      const result: ExtractionResult = {
        ok: false,
        error: `No extractor available for format "${format}". ` +
          `Supported formats: ${Array.from(this.extractors.keys()).join(', ')}. ` +
          'Provide a formatHint in the config or ensure the data matches a supported format.',
        warnings: [],
        durationMs: 0,
      };
      this.extractionResults.push(result);
      return result;
    }

    // Pre-parse JSON for JSON-based formats (extractors expect parsed objects)
    let inputData: unknown = rawData;
    if (format === 'figma-extractor-json' || format === 'dtcg-json' || format === 'style-dictionary' || format === 'tokens-studio') {
      try {
        inputData = JSON.parse(rawData);
      } catch {
        const result: ExtractionResult = {
          ok: false,
          error: `Invalid JSON input for format "${format}". Ensure the data is valid JSON.`,
          warnings: [],
          durationMs: 0,
        };
        this.extractionResults.push(result);
        return result;
      }
    }

    const result = extractor.extract(inputData, config);
    this.extractionResults.push(result);

    if (result.ok && result.fingerprint) {
      this.fingerprints.push(result.fingerprint);
      this.cachedSynthesis = null; // Invalidate cache
    }

    return result;
  }

  // ==========================================================================
  // SECTION 2b: LEARN — Synthesize patterns across all studied fingerprints
  // ==========================================================================

  /**
   * Learn from all studied fingerprints by synthesizing common patterns.
   *
   * Call this after one or more study() calls. Returns a PatternSynthesis
   * that summarizes what was learned across all sources.
   *
   * Results are cached — calling learn() multiple times without new study()
   * calls returns the same synthesis.
   *
   * @returns PatternSynthesis or null if no fingerprints have been studied
   */
  learn(): PatternSynthesis | null {
    if (this.fingerprints.length === 0) {
      return null;
    }

    if (this.cachedSynthesis) {
      return this.cachedSynthesis;
    }

    this.cachedSynthesis = synthesizePatterns(this.fingerprints);
    return this.cachedSynthesis;
  }

  // ==========================================================================
  // SECTION 2c: RECOMMEND — Translate synthesis into actionable guidance
  // ==========================================================================

  /**
   * Generate actionable recommendations for the generation phase.
   *
   * Translates the PatternSynthesis into specific, opinionated decisions:
   * - How many tiers to create and what they should be called
   * - What naming separator and shade count to use
   * - Whether to use cross-collection aliases
   *
   * If no synthesis is available, falls back to DSB's 3-tier defaults.
   *
   * @returns GenerationRecommendation with rationale
   */
  recommend(): GenerationRecommendation {
    const synthesis = this.learn();

    if (!synthesis || synthesis.sourceCount === 0) {
      return this.defaultRecommendation();
    }

    return this.synthesisToRecommendation(synthesis);
  }

  // ==========================================================================
  // SECTION 2d: ACCESSORS
  // ==========================================================================

  /** Get all studied fingerprints. */
  getFingerprints(): readonly StructuralFingerprint[] {
    return this.fingerprints;
  }

  /** Get all extraction results (including failures). */
  getExtractionResults(): readonly ExtractionResult[] {
    return this.extractionResults;
  }

  /** Get count of successfully studied sources. */
  getStudiedCount(): number {
    return this.fingerprints.length;
  }

  /** Clear all studied data and reset the learner. */
  reset(): void {
    this.fingerprints.length = 0;
    this.extractionResults.length = 0;
    this.cachedSynthesis = null;
  }

  /** Register a custom extractor for a specific format. */
  registerExtractor(format: SourceFormat, extractor: FingerprintExtractor): void {
    this.extractors.set(format, extractor);
  }

  // ==========================================================================
  // SECTION 3: FORMAT DETECTION
  // ==========================================================================

  /**
   * Attempt to detect the source format from the raw data.
   * Falls back to 'unknown' if no format can be determined.
   */
  private detectFormat(rawData: string): SourceFormat {
    const trimmed = rawData.trim();

    // JSON-based formats
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);

        // Figma extractor JSON is an array of collection objects
        if (Array.isArray(parsed)) {
          // Check if first element has a collection-like structure
          const first = parsed[0] as Record<string, unknown> | undefined;
          if (first && typeof first === 'object') {
            const keys = Object.keys(first);
            // Figma extractor entries have exactly 1 key (the collection name)
            // or a special _styles key
            if (keys.length === 1 || keys.includes('_styles')) {
              return 'figma-extractor-json';
            }
          }
        }

        // DTCG format check — has $type or $value at some level
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          const json = parsed as Record<string, unknown>;
          if ('$type' in json || '$value' in json) {
            return 'dtcg-json';
          }
          // Check nested for DTCG markers
          for (const val of Object.values(json)) {
            if (typeof val === 'object' && val !== null) {
              const nested = val as Record<string, unknown>;
              if ('$type' in nested || '$value' in nested) {
                return 'dtcg-json';
              }
            }
          }
        }
      } catch {
        // Not valid JSON — fall through
      }
    }

    // CSS format — contains custom properties.
    // Identifier is bounded to 128 chars to defend against ReDoS on
    // pathological repetition of '--A...' (CodeQL js/polynomial-redos).
    if (/--[a-zA-Z][\w-]{0,128}\s{0,8}:/.test(trimmed)) {
      return 'css-variables';
    }

    return 'unknown';
  }

  // ==========================================================================
  // SECTION 4: RECOMMENDATION GENERATION
  // ==========================================================================

  /**
   * Convert a PatternSynthesis into a GenerationRecommendation.
   */
  private synthesisToRecommendation(
    synthesis: PatternSynthesis,
  ): GenerationRecommendation {
    const rationale: string[] = [];

    // Determine confidence
    const confidence = this.assessConfidence(synthesis);

    // Tier count — use the average of the range, clamped to DSB's 3-4 tier model
    const avgTiers = Math.round(
      (synthesis.tierCountRange[0] + synthesis.tierCountRange[1]) / 2,
    );
    const recommendedTierCount = Math.max(3, Math.min(avgTiers, 5));
    rationale.push(
      `Tier count: ${recommendedTierCount} (sources ranged ${synthesis.tierCountRange[0]}–${synthesis.tierCountRange[1]})`,
    );

    // Build recommended tiers
    const recommendedTiers = this.buildRecommendedTiers(synthesis, recommendedTierCount);

    // Naming separator — use the dominant
    const namingSeparator = synthesis.dominantSeparator;
    rationale.push(`Naming separator: "${namingSeparator}" (most common across sources)`);

    // Shade count — use dominant, default to 10 if 0
    const colorShadeCount = synthesis.dominantShadeCount > 0
      ? synthesis.dominantShadeCount
      : 10;
    rationale.push(`Color shades: ${colorShadeCount} steps per palette`);

    // Cross-collection aliases — recommend if universal or if most sources use them
    const useCrossCollectionAliases = synthesis.crossCollectionAliasesUniversal
      || this.fingerprints.filter(fp => fp.aliasTopology.crossCollectionAliases).length
         > this.fingerprints.length / 2;
    rationale.push(
      useCrossCollectionAliases
        ? 'Cross-collection aliases: yes (standard practice across sources)'
        : 'Cross-collection aliases: no (not consistently used across sources)',
    );

    // Alias depth — use the average of the range
    const maxAliasDepth = Math.max(
      2,
      Math.round((synthesis.aliasDepthRange[0] + synthesis.aliasDepthRange[1]) / 2),
    );
    rationale.push(`Max alias depth: ${maxAliasDepth}`);

    // Style-variable binding
    const bindStylesToVariables = this.fingerprints.some(
      fp => fp.styleStrategy.stylesBindToVariables,
    );
    rationale.push(
      bindStylesToVariables
        ? 'Styles bind to variables (modern Figma best practice)'
        : 'Styles use raw values (older pattern)',
    );

    return {
      recommendedTierCount,
      recommendedTiers,
      namingSeparator,
      colorShadeCount,
      useCrossCollectionAliases,
      maxAliasDepth,
      bindStylesToVariables,
      confidence,
      rationale,
      synthesis,
    };
  }

  /**
   * Build recommended tier definitions based on synthesis and target count.
   */
  private buildRecommendedTiers(
    synthesis: PatternSynthesis,
    tierCount: number,
  ): RecommendedTier[] {
    // DSB's canonical 3-tier structure is the baseline
    const tiers: RecommendedTier[] = [
      {
        name: 'Primitives',
        tier: 'primitive',
        modes: ['Value'],
        purpose: 'Raw atomic values — colors, sizes, fonts. No aliases.',
      },
      {
        name: 'Semantic',
        tier: 'semantic',
        modes: ['Light', 'Dark'],
        purpose: 'Purpose-driven tokens that alias Primitives. Theme modes live here.',
      },
      {
        name: 'Mapped',
        tier: 'mapped',
        modes: ['Default'],
        purpose: 'Component-level tokens that alias Semantic. Closest to usage.',
      },
    ];

    // Add a 4th tier if sources consistently show seed/intermediate layer
    if (tierCount >= 4) {
      // Insert a seed tier between Primitives and Semantic
      tiers.splice(1, 0, {
        name: 'Seed',
        tier: 'seed',
        modes: ['Value'],
        purpose: 'Derived primitives — primary/secondary color picks from palettes.',
      });
    }

    // Add breakpoints tier if any source uses responsive modes
    const hasBreakpoints = this.fingerprints.some(
      fp => fp.scalePatterns.breakpointCount > 0,
    );
    if (hasBreakpoints || tierCount >= 5) {
      // Collect breakpoint names from sources, or use defaults
      const bpNames = this.collectBreakpointNames();
      tiers.push({
        name: 'Breakpoints',
        tier: 'responsive',
        modes: bpNames.length > 0 ? bpNames : ['Desktop', 'Tablet', 'Mobile'],
        purpose: 'Responsive tokens with per-breakpoint values.',
      });
    }

    // Incorporate mode information from studied sources
    return tiers.map(tier => this.enrichTierModes(tier, synthesis));
  }

  /**
   * Collect breakpoint names across all studied fingerprints.
   */
  private collectBreakpointNames(): string[] {
    const allNames = new Set<string>();
    for (const fp of this.fingerprints) {
      for (const name of fp.scalePatterns.breakpointNames) {
        allNames.add(name);
      }
    }
    return Array.from(allNames);
  }

  /**
   * Enrich a recommended tier's modes based on what was observed in sources.
   */
  private enrichTierModes(
    tier: RecommendedTier,
    _synthesis: PatternSynthesis,
  ): RecommendedTier {
    // For semantic/mapped tiers, check if sources use Light/Dark or other modes
    if (tier.tier === 'semantic' || tier.tier === 'mapped') {
      const observedModes = new Set<string>();
      for (const fp of this.fingerprints) {
        for (const coll of fp.collections) {
          if (coll.tier === tier.tier) {
            for (const mode of coll.modes) {
              observedModes.add(mode);
            }
          }
        }
      }

      if (observedModes.size > 0) {
        return { ...tier, modes: Array.from(observedModes) };
      }
    }

    return tier;
  }

  /**
   * Assess confidence level based on source count and agreement.
   */
  private assessConfidence(synthesis: PatternSynthesis): RecommendationConfidence {
    if (synthesis.sourceCount === 1) return 'single-source';

    // High confidence: many sources, few divergences
    if (synthesis.sourceCount >= 3 && synthesis.divergences.length <= 2) {
      return 'high';
    }

    // Medium confidence: 2+ sources with moderate agreement
    if (synthesis.sourceCount >= 2 && synthesis.divergences.length <= synthesis.commonPatterns.length) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * DSB's default 3-tier recommendation when no sources are studied.
   */
  private defaultRecommendation(): GenerationRecommendation {
    return {
      recommendedTierCount: 3,
      recommendedTiers: [
        {
          name: 'Primitives',
          tier: 'primitive',
          modes: ['Value'],
          purpose: 'Raw atomic values — colors, sizes, fonts. No aliases.',
        },
        {
          name: 'Semantic',
          tier: 'semantic',
          modes: ['Light', 'Dark'],
          purpose: 'Purpose-driven tokens that alias Primitives. Theme modes live here.',
        },
        {
          name: 'Mapped',
          tier: 'mapped',
          modes: ['Default'],
          purpose: 'Component-level tokens that alias Semantic. Closest to usage.',
        },
      ],
      namingSeparator: '/',
      colorShadeCount: 10,
      useCrossCollectionAliases: true,
      maxAliasDepth: 3,
      bindStylesToVariables: true,
      confidence: 'low',
      rationale: [
        'No sources studied — using DSB 3-tier defaults',
        'Study one or more design systems for better recommendations',
      ],
      synthesis: synthesizePatterns([]),
    };
  }
}
