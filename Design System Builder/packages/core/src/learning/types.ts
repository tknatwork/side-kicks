/**
 * Learning Types — Core data structures for the Learning Engine.
 *
 * The Learning Engine follows a study → learn → generate pipeline:
 *   1. study(): Extracts a StructuralFingerprint from a design system source
 *   2. learn(): Analyzes fingerprints, builds token vocabulary and naming conventions
 *   3. generate(): Creates DSB-native token structure inspired by learned patterns
 *
 * StructuralFingerprint is the central data structure — every extractor produces
 * one, every learner consumes one. It captures the ARCHITECTURE of a design system
 * (not the specific values), enabling DSB to generate custom systems that follow
 * the same structural patterns.
 *
 * @module core/learning/types
 */

// ============================================================================
// SECTION 1: COLLECTION TOPOLOGY
// ============================================================================

/** Classification of a collection's role in the token hierarchy. */
export type CollectionTier =
  | 'primitive'
  | 'seed'
  | 'mapped'
  | 'semantic'
  | 'component'
  | 'responsive'
  | 'unknown';

/** Structural description of a single variable collection. */
export interface CollectionTopology {
  /** Collection name as it appears in the source. */
  readonly name: string;

  /** Detected role in the token hierarchy. */
  readonly tier: CollectionTier;

  /** Mode names (e.g., ["Light", "Dark"] or ["Mobile", "Tablet", "Desktop"]). */
  readonly modes: readonly string[];

  /** Total number of variables in this collection. */
  readonly variableCount: number;

  /** Names of other collections this one aliases into (dependency edges). */
  readonly dependsOn: readonly string[];

  /** Names of collections that alias into this one (reverse dependency). */
  readonly dependedOnBy: readonly string[];

  /** Variable type distribution (e.g., { color: 120, float: 10 }). */
  readonly typeDistribution: Readonly<Record<string, number>>;
}

// ============================================================================
// SECTION 2: NAMING CONVENTIONS
// ============================================================================

/** Detected separator character used in variable names. */
export type NamingSeparator = '/' | '.' | '-' | '_';

/** How variables are grouped within a collection. */
export type GroupingStrategy =
  | 'by-color-then-shade'
  | 'by-purpose'
  | 'by-component'
  | 'flat'
  | 'mixed';

/** How color shades are named. */
export type ShadeNaming =
  | 'numeric-1-to-10'
  | 'numeric-50-to-950'
  | 'numeric-100-to-900'
  | 'semantic-names'
  | 'custom';

/** Casing convention for variable names. */
export type NamingCasing =
  | 'camelCase'
  | 'kebab-case'
  | 'PascalCase'
  | 'snake_case'
  | 'mixed';

/** Detected naming patterns from variable names. */
export interface NamingConventions {
  /** Primary separator in variable paths. */
  readonly separator: NamingSeparator;

  /** How variables are organized into groups. */
  readonly grouping: GroupingStrategy;

  /** How color shades are named (if applicable). */
  readonly shadeNaming: ShadeNaming;

  /** Dominant casing style in variable name segments. */
  readonly casing: NamingCasing;

  /** Example variable names that represent the dominant pattern. */
  readonly examples: readonly string[];
}

// ============================================================================
// SECTION 3: ALIAS TOPOLOGY
// ============================================================================

/** Structural description of the alias chain architecture. */
export interface AliasTopology {
  /** Maximum alias chain depth observed (e.g., 4 means A → B → C → D → value). */
  readonly maxDepth: number;

  /** Average alias chain depth across all aliased variables. */
  readonly averageDepth: number;

  /** Typical chain of collection tiers from component to raw value. */
  readonly typicalChain: readonly string[];

  /** Whether aliases cross collection boundaries. */
  readonly crossCollectionAliases: boolean;

  /** Percentage of variables that are aliases (0–100). */
  readonly aliasPercentage: number;

  /** Number of circular alias references detected (should be 0). */
  readonly circularCount: number;
}

// ============================================================================
// SECTION 4: SCALE PATTERNS
// ============================================================================

/** Detected patterns for how scales (color, spacing, typography) are structured. */
export interface ScalePatterns {
  /** Number of shade steps per color palette (e.g., 10 for Ant, 11 for Material). */
  readonly colorShades: number;

  /** Names of detected color palettes (e.g., ["blue", "red", "green"]). */
  readonly colorPalettes: readonly string[];

  /** Spacing multiplier values if a consistent scale was detected. */
  readonly spacingMultipliers: readonly number[];

  /** Number of distinct typography size levels. */
  readonly typographySizes: number;

  /** Number of breakpoint modes. */
  readonly breakpointCount: number;

  /** Breakpoint mode names if detected. */
  readonly breakpointNames: readonly string[];
}

// ============================================================================
// SECTION 5: STYLE STRATEGY
// ============================================================================

/** How the design system organizes and names its styles. */
export interface StyleStrategy {
  /** Total number of color styles. */
  readonly colorStyleCount: number;

  /** Total number of text styles. */
  readonly textStyleCount: number;

  /** Total number of effect styles (shadows, blurs). */
  readonly effectStyleCount: number;

  /** Total number of grid styles. */
  readonly gridStyleCount: number;

  /** Detected naming pattern for text styles (e.g., "{weight}/{size}", "{role}"). */
  readonly textStyleNaming: string;

  /** Detected naming pattern for effect styles (e.g., "shadow-{level}"). */
  readonly effectStyleNaming: string;

  /** Whether styles reference variables (bound) vs have raw values. */
  readonly stylesBindToVariables: boolean;
}

// ============================================================================
// SECTION 6: SOURCE METADATA
// ============================================================================

/** Metadata about the source design system that was fingerprinted. */
export interface SourceMetadata {
  /** Human-readable name (e.g., "Ant Design X v2.2.1"). */
  readonly name: string;

  /** Source format that was analyzed. */
  readonly sourceFormat: SourceFormat;

  /** Total number of variables across all collections. */
  readonly totalVariables: number;

  /** Total number of styles. */
  readonly totalStyles: number;

  /** Total number of pages (if applicable). */
  readonly totalPages: number;

  /** ISO timestamp when fingerprint was extracted. */
  readonly extractedAt: string;

  /** Optional URL or path to the original source. */
  readonly sourceLocation?: string;
}

/** Type of source material that was fingerprinted. */
export type SourceFormat =
  | 'figma-extractor-json'
  | 'css-variables'
  | 'dtcg-json'
  | 'style-dictionary'
  | 'tokens-studio'
  | 'unknown';

// ============================================================================
// SECTION 7: STRUCTURAL FINGERPRINT (CORE TYPE)
// ============================================================================

/**
 * StructuralFingerprint — The core data structure of the Learning Engine.
 *
 * A schema-level description of a design system's architecture that strips
 * away specific values but preserves structural decisions: collection
 * topology, naming conventions, alias chains, scale patterns, and style
 * strategies.
 *
 * Every extractor produces one. Every learner consumes one.
 *
 * Think of it as a blueprint — it captures HOW a design system is built,
 * not WHAT specific colors or fonts it uses.
 */
export interface StructuralFingerprint {
  /** Collection topology — what collections exist and how they relate. */
  readonly collections: readonly CollectionTopology[];

  /** Detected naming patterns across variable names. */
  readonly namingConventions: NamingConventions;

  /** Alias chain structure — depth, cross-collection, patterns. */
  readonly aliasTopology: AliasTopology;

  /** Scale patterns — shades, palettes, spacing, breakpoints. */
  readonly scalePatterns: ScalePatterns;

  /** Style organization — counts, naming, variable bindings. */
  readonly styleStrategy: StyleStrategy;

  /** Source metadata — what was fingerprinted and when. */
  readonly source: SourceMetadata;
}

// ============================================================================
// SECTION 8: EXTRACTOR TYPES
// ============================================================================

/** Configuration for running an extractor. */
export interface ExtractorConfig {
  /** Human-readable name for the source (e.g., "Ant Design X v2.2.1"). */
  readonly sourceName: string;

  /** Optional description or notes about the source. */
  readonly description?: string;

  /** Source format hint — helps the extractor choose the right parser. */
  readonly formatHint?: SourceFormat;
}

/** The result of a fingerprint extraction — either success or a descriptive error. */
export interface ExtractionResult {
  /** Whether extraction succeeded. */
  readonly ok: boolean;

  /** The extracted fingerprint (present when ok is true). */
  readonly fingerprint?: StructuralFingerprint;

  /** Error description (present when ok is false). */
  readonly error?: string;

  /** Warnings encountered during extraction (non-fatal issues). */
  readonly warnings: readonly string[];

  /** How long the extraction took in milliseconds. */
  readonly durationMs: number;
}

// ============================================================================
// SECTION 9: SYNTHESIS TYPES (Multi-source learning)
// ============================================================================

/** Analysis comparing multiple fingerprints to find common patterns. */
export interface PatternSynthesis {
  /** Number of sources analyzed. */
  readonly sourceCount: number;

  /** Source names that were compared. */
  readonly sourceNames: readonly string[];

  /** Common collection tier counts (e.g., "3-5 tiers is standard"). */
  readonly tierCountRange: readonly [number, number];

  /** Most common number of color shade steps. */
  readonly dominantShadeCount: number;

  /** Most common naming separator. */
  readonly dominantSeparator: NamingSeparator;

  /** Whether cross-collection aliases are universal among sources. */
  readonly crossCollectionAliasesUniversal: boolean;

  /** Common alias chain depth range. */
  readonly aliasDepthRange: readonly [number, number];

  /** Shared architectural patterns identified. */
  readonly commonPatterns: readonly string[];

  /** Differences between sources worth noting. */
  readonly divergences: readonly string[];

  /** ISO timestamp when synthesis was produced. */
  readonly synthesizedAt: string;
}

/** User preference for which structural patterns to follow during generation. */
export type StructurePreference =
  | 'three-tier'
  | 'ant-design'
  | 'material-design'
  | 'custom';
