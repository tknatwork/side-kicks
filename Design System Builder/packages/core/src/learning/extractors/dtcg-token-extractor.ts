/**
 * DTCG Token Extractor — Extracts StructuralFingerprint from W3C DTCG JSON.
 *
 * Parses W3C Design Token Community Group format (2025.10 draft) and analyzes
 * the nested tree structure to produce a StructuralFingerprint.
 *
 * DTCG key characteristics:
 *   - Nested JSON objects where leaf nodes have `$type` + `$value`
 *   - `$type` can appear at group level and be inherited by descendants
 *   - Aliases use curly-brace dot-notation: `{color.primary.500}`
 *   - Single-mode format (no built-in mode support)
 *   - Top-level groups often map to token categories (color, spacing, etc.)
 *
 * DTCG does NOT have explicit collections or modes, so this extractor:
 *   1. Treats top-level groups as virtual collections
 *   2. Classifies groups into tiers based on content analysis
 *   3. Identifies `{reference}` patterns as aliases
 *   4. Detects scale patterns from numeric suffixes
 *
 * @see https://tr.designtokens.org/format/
 * @module core/learning/extractors/dtcg-token-extractor
 */

import { FingerprintExtractor } from '../fingerprint-extractor';
import type {
  StructuralFingerprint,
  ExtractionResult,
  ExtractorConfig,
  CollectionTopology,
  NamingConventions,
  AliasTopology,
  ScalePatterns,
  StyleStrategy,
  SourceMetadata,
  CollectionTier,
} from '../types';

// ============================================================================
// SECTION 1: INTERNAL TYPES
// ============================================================================

/** A parsed DTCG token from the nested tree. */
interface DtcgParsedToken {
  /** Full dot-separated path (e.g., "color.primary.500"). */
  readonly path: string;

  /** The $type value (inherited from parent group if not on leaf). */
  readonly type: string;

  /** Whether the $value is a reference (e.g., "{color.primary.500}"). */
  readonly isAlias: boolean;

  /** If alias, the resolved reference path. */
  readonly aliasTarget?: string;

  /** Top-level group name this token belongs to. */
  readonly topGroup: string;

  /** Description if present. */
  readonly description?: string;

  /** Raw $value for analysis. */
  readonly rawValue: unknown;
}

/** Represents a top-level group acting as a virtual collection. */
interface VirtualCollection {
  readonly name: string;
  readonly tokens: DtcgParsedToken[];
  readonly aliasTargetGroups: Set<string>;
  readonly aliasSourceGroups: Set<string>;
}

// ============================================================================
// SECTION 2: EXTRACTOR CLASS
// ============================================================================

export class DtcgTokenExtractor extends FingerprintExtractor {
  constructor(config?: ExtractorConfig) {
    super(config
      ? { ...config, formatHint: 'dtcg-json' }
      : { sourceName: 'DTCG Source', formatHint: 'dtcg-json' },
    );
  }

  /**
   * Extract a StructuralFingerprint from a parsed DTCG JSON object.
   *
   * @param rawData - The parsed DTCG JSON object (not a string).
   * @param config - Optional config override for per-call usage.
   */
  extract(rawData: unknown, config?: ExtractorConfig): ExtractionResult {
    if (config) this.config = { ...config, formatHint: 'dtcg-json' };
    const startTime = Date.now();
    const warnings: string[] = [];

    // Guard: must be a non-null object (not array)
    if (typeof rawData !== 'object' || rawData === null || Array.isArray(rawData)) {
      return this.failure(
        'Invalid input: expected a JSON object (DTCG document). ' +
        'DTCG files are nested objects with $type/$value leaf tokens.',
        Date.now() - startTime,
      );
    }

    const doc = rawData as Record<string, unknown>;

    try {
      // Phase 1: Walk tree and collect all tokens
      const allTokens = this.walkTree(doc, '', undefined, warnings);

      if (allTokens.length === 0) {
        return this.failure(
          'No DTCG tokens found in input. Expected leaf nodes with $type and $value properties.',
          Date.now() - startTime,
        );
      }

      // Phase 2: Group tokens by top-level group (virtual collections)
      const collections = this.groupByTopLevel(allTokens);

      // Phase 3: Analyze alias topology
      const aliasEdges = this.extractAliasEdges(allTokens, collections);

      // Phase 4: Assign dependency edges to collections
      this.assignDependencies(collections, aliasEdges);

      // Phase 5: Build the fingerprint
      const tokenNames = allTokens.map(t => t.path);
      const fingerprint = this.buildFingerprint(
        collections,
        allTokens,
        tokenNames,
        warnings,
      );

      return this.success(fingerprint, warnings, Date.now() - startTime);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.failure(
        `DTCG extraction failed: ${msg}`,
        Date.now() - startTime,
      );
    }
  }

  // ==========================================================================
  // SECTION 3: TREE WALKING
  // ==========================================================================

  /**
   * Recursively walk the DTCG tree and collect all leaf tokens.
   *
   * The $type property can be inherited: if a group has $type, all descendant
   * tokens inherit that type unless they override it.
   *
   * @param node - Current node in the tree
   * @param path - Dot-separated path to this node
   * @param inheritedType - $type inherited from an ancestor group
   * @param warnings - Mutable warnings array
   */
  private walkTree(
    node: Record<string, unknown>,
    path: string,
    inheritedType: string | undefined,
    warnings: string[],
  ): DtcgParsedToken[] {
    const tokens: DtcgParsedToken[] = [];

    // Check for $type at this level (group-level type inheritance)
    const localType = typeof node['$type'] === 'string'
      ? node['$type'] as string
      : inheritedType;

    // Check if this node IS a leaf token ($value present)
    if ('$value' in node) {
      const effectiveType = typeof node['$type'] === 'string'
        ? node['$type'] as string
        : inheritedType;

      if (!effectiveType) {
        warnings.push(`Token at "${path}" has $value but no $type (and no inherited type). Skipping.`);
        return tokens;
      }

      const rawValue = node['$value'];
      const description = typeof node['$description'] === 'string'
        ? node['$description'] as string
        : undefined;

      // Check if value is a DTCG reference: "{group.token}"
      const isAlias = this.isDtcgReference(rawValue);
      const aliasTarget = isAlias ? this.extractReference(rawValue) : undefined;

      // Determine top-level group from path
      const topGroup = this.topGroupFromPath(path);

      tokens.push({
        path,
        type: effectiveType,
        isAlias,
        aliasTarget,
        topGroup,
        description,
        rawValue,
      });

      return tokens;
    }

    // Not a leaf — recurse into child groups/tokens
    for (const [key, value] of Object.entries(node)) {
      // Skip DTCG metadata keys
      if (key.startsWith('$')) continue;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const childPath = path ? `${path}.${key}` : key;
        const childTokens = this.walkTree(
          value as Record<string, unknown>,
          childPath,
          localType,
          warnings,
        );
        for (const t of childTokens) {
          tokens.push(t);
        }
      }
    }

    return tokens;
  }

  /**
   * Check if a DTCG value is a reference (alias).
   * References are strings matching `{some.path}`.
   */
  private isDtcgReference(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return /^\{[^}]+\}$/.test(value.trim());
  }

  /**
   * Extract the reference path from a DTCG reference value.
   * "{color.primary.500}" → "color.primary.500"
   */
  private extractReference(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const match = /^\{([^}]+)\}$/.exec(value.trim());
    if (match && match[1]) {
      return match[1];
    }
    return undefined;
  }

  /** Extract the top-level group name from a dot-separated path. */
  private topGroupFromPath(path: string): string {
    const dotIdx = path.indexOf('.');
    if (dotIdx === -1) return path;
    return path.substring(0, dotIdx);
  }

  // ==========================================================================
  // SECTION 4: COLLECTION GROUPING
  // ==========================================================================

  /**
   * Group parsed tokens by their top-level group to create virtual collections.
   * Top-level groups in DTCG serve a similar purpose to Figma collections.
   */
  private groupByTopLevel(
    tokens: readonly DtcgParsedToken[],
  ): Map<string, VirtualCollection> {
    const map = new Map<string, VirtualCollection>();

    for (const token of tokens) {
      const group = token.topGroup;
      let collection = map.get(group);
      if (!collection) {
        collection = {
          name: group,
          tokens: [],
          aliasTargetGroups: new Set<string>(),
          aliasSourceGroups: new Set<string>(),
        };
        map.set(group, collection);
      }
      // We need mutable arrays for building — cast carefully
      (collection.tokens as DtcgParsedToken[]).push(token);
    }

    return map;
  }

  // ==========================================================================
  // SECTION 5: ALIAS ANALYSIS
  // ==========================================================================

  /** Alias edge for dependency tracking. */
  private extractAliasEdges(
    tokens: readonly DtcgParsedToken[],
    collections: Map<string, VirtualCollection>,
  ): Array<{ from: string; to: string; fromGroup: string; toGroup: string }> {
    const edges: Array<{ from: string; to: string; fromGroup: string; toGroup: string }> = [];

    for (const token of tokens) {
      if (!token.isAlias || !token.aliasTarget) continue;

      const fromGroup = token.topGroup;
      const toGroup = this.topGroupFromPath(token.aliasTarget);

      edges.push({
        from: token.path,
        to: token.aliasTarget,
        fromGroup,
        toGroup,
      });
    }

    return edges;
  }

  /**
   * Assign dependency edges to virtual collections (dependsOn / dependedOnBy).
   */
  private assignDependencies(
    collections: Map<string, VirtualCollection>,
    edges: ReadonlyArray<{ from: string; to: string; fromGroup: string; toGroup: string }>,
  ): void {
    for (const edge of edges) {
      const fromColl = collections.get(edge.fromGroup);
      const toColl = collections.get(edge.toGroup);

      if (fromColl && edge.fromGroup !== edge.toGroup) {
        (fromColl.aliasTargetGroups as Set<string>).add(edge.toGroup);
      }
      if (toColl && edge.fromGroup !== edge.toGroup) {
        (toColl.aliasSourceGroups as Set<string>).add(edge.fromGroup);
      }
    }
  }

  // ==========================================================================
  // SECTION 6: TIER CLASSIFICATION
  // ==========================================================================

  /**
   * Classify a virtual collection into a tier based on its characteristics.
   *
   * DTCG doesn't have explicit tiers, so we infer from:
   *   - Alias ratios: high alias % → semantic or component tier
   *   - Content types: mostly colors → primitive, mostly references → semantic
   *   - Dependencies: depended on by many → primitive; depends on many → component
   */
  private classifyCollection(
    coll: VirtualCollection,
    allCollections: Map<string, VirtualCollection>,
  ): CollectionTier {
    const totalTokens = coll.tokens.length;
    if (totalTokens === 0) return 'unknown';

    const aliasCount = coll.tokens.filter(t => t.isAlias).length;
    const aliasRatio = aliasCount / totalTokens;

    const depCount = coll.aliasTargetGroups.size; // how many groups this one aliases INTO
    const revDepCount = coll.aliasSourceGroups.size; // how many groups alias INTO this one

    // Name-based hints
    const lowerName = coll.name.toLowerCase();
    if (lowerName === 'primitive' || lowerName === 'primitives' || lowerName === 'base') {
      return 'primitive';
    }
    if (lowerName === 'semantic' || lowerName === 'theme' || lowerName === 'alias') {
      return 'semantic';
    }
    if (lowerName === 'component' || lowerName === 'mapped' || lowerName === 'comp') {
      return 'component';
    }
    if (lowerName === 'breakpoint' || lowerName === 'breakpoints' || lowerName === 'responsive') {
      return 'responsive';
    }

    // Ratio-based classification
    // Pure values → primitive
    if (aliasRatio < 0.1 && revDepCount > 0) return 'primitive';
    if (aliasRatio < 0.1 && depCount === 0) return 'primitive';

    // All aliases → component/mapped tier
    if (aliasRatio > 0.8) {
      // If it depends on more groups → higher tier
      if (depCount > 1) return 'component';
      return 'semantic';
    }

    // Mixed → semantic tier
    if (aliasRatio >= 0.1 && aliasRatio <= 0.8) return 'semantic';

    return 'unknown';
  }

  // ==========================================================================
  // SECTION 7: FINGERPRINT CONSTRUCTION
  // ==========================================================================

  /**
   * Build the complete StructuralFingerprint from analyzed data.
   */
  private buildFingerprint(
    collections: Map<string, VirtualCollection>,
    allTokens: readonly DtcgParsedToken[],
    tokenNames: readonly string[],
    warnings: readonly string[],
  ): StructuralFingerprint {
    // --- Collection topologies ---
    const topologies: CollectionTopology[] = [];
    for (const [, coll] of collections) {
      const tier = this.classifyCollection(coll, collections);
      const typeDistribution: Record<string, number> = {};
      for (const token of coll.tokens) {
        const t = token.type;
        typeDistribution[t] = (typeDistribution[t] ?? 0) + 1;
      }

      topologies.push({
        name: coll.name,
        tier,
        modes: ['Value'], // DTCG is single-mode
        variableCount: coll.tokens.length,
        dependsOn: Array.from(coll.aliasTargetGroups),
        dependedOnBy: Array.from(coll.aliasSourceGroups),
        typeDistribution,
      });
    }

    // --- Naming conventions ---
    const namingConventions = this.analyzeNaming(tokenNames);

    // --- Alias topology ---
    const aliasTopology = this.analyzeAliases(allTokens, collections);

    // --- Scale patterns ---
    const scalePatterns = this.analyzeScales(allTokens);

    // --- Style strategy (DTCG has no styles — empty) ---
    const styleStrategy: StyleStrategy = {
      colorStyleCount: 0,
      textStyleCount: 0,
      effectStyleCount: 0,
      gridStyleCount: 0,
      textStyleNaming: '',
      effectStyleNaming: '',
      stylesBindToVariables: false,
    };

    // --- Source metadata ---
    const source: SourceMetadata = {
      name: this.config.sourceName,
      sourceFormat: 'dtcg-json',
      totalVariables: allTokens.length,
      totalStyles: 0,
      totalPages: 0,
      extractedAt: new Date().toISOString(),
      sourceLocation: this.config.description,
    };

    return {
      collections: topologies,
      namingConventions,
      aliasTopology,
      scalePatterns,
      styleStrategy,
      source,
    };
  }

  // ==========================================================================
  // SECTION 8: NAMING ANALYSIS
  // ==========================================================================

  /**
   * Analyze naming conventions from DTCG token paths.
   * DTCG uses dot-separated paths natively, but individual segments
   * may use kebab-case, camelCase, etc.
   */
  private analyzeNaming(names: readonly string[]): NamingConventions {
    if (names.length === 0) {
      return {
        separator: '.',
        grouping: 'flat',
        shadeNaming: 'custom',
        casing: 'kebab-case',
        examples: [],
      };
    }

    // DTCG natively uses dots for path separation, but detect if the file
    // also uses other separators within segments
    const separator = this.detectSeparator(names);

    // Detect casing from individual path segments
    const segments: string[] = [];
    for (const name of names) {
      const parts = name.split('.');
      for (const p of parts) {
        if (p.length > 1) segments.push(p);
      }
    }
    const casing = this.detectCasing(segments, separator);

    // Detect grouping strategy
    const grouping = this.detectGrouping(names, separator);

    // Detect shade naming from numeric suffixes
    const shadeNaming = this.detectShadeNaming(names, separator);

    // Pick representative examples (up to 5)
    const exampleCount = Math.min(5, names.length);
    const step = Math.max(1, Math.floor(names.length / exampleCount));
    const examples: string[] = [];
    for (let i = 0; i < names.length && examples.length < exampleCount; i += step) {
      const name = names[i];
      if (name !== undefined) {
        examples.push(name);
      }
    }

    return {
      separator,
      grouping,
      shadeNaming,
      casing,
      examples,
    };
  }

  // ==========================================================================
  // SECTION 9: ALIAS TOPOLOGY ANALYSIS
  // ==========================================================================

  /**
   * Analyze the alias structure across all tokens and virtual collections.
   */
  private analyzeAliases(
    tokens: readonly DtcgParsedToken[],
    collections: Map<string, VirtualCollection>,
  ): AliasTopology {
    const totalTokens = tokens.length;
    const aliasTokens = tokens.filter(t => t.isAlias);
    const aliasCount = aliasTokens.length;

    if (aliasCount === 0) {
      return {
        maxDepth: 0,
        averageDepth: 0,
        typicalChain: [],
        crossCollectionAliases: false,
        aliasPercentage: 0,
        circularCount: 0,
      };
    }

    // Build a lookup for resolving alias chains
    const tokenByPath = new Map<string, DtcgParsedToken>();
    for (const t of tokens) {
      tokenByPath.set(t.path, t);
    }

    // Compute alias chain depths
    let maxDepth = 0;
    let totalDepth = 0;
    let circularCount = 0;
    let crossCollectionCount = 0;

    for (const token of aliasTokens) {
      const visited = new Set<string>();
      let current: DtcgParsedToken | undefined = token;
      let depth = 0;

      while (current && current.isAlias && current.aliasTarget) {
        if (visited.has(current.path)) {
          circularCount++;
          break;
        }
        visited.add(current.path);
        depth++;
        current = tokenByPath.get(current.aliasTarget);
      }

      if (depth > maxDepth) maxDepth = depth;
      totalDepth += depth;

      // Cross-collection check
      if (token.aliasTarget) {
        const targetGroup = this.topGroupFromPath(token.aliasTarget);
        if (targetGroup !== token.topGroup) {
          crossCollectionCount++;
        }
      }
    }

    const averageDepth = aliasCount > 0 ? totalDepth / aliasCount : 0;
    const crossCollectionAliases = crossCollectionCount > 0;

    // Build typical chain from collection tiers
    const tierOrder: CollectionTier[] = ['component', 'semantic', 'primitive'];
    const presentTiers: string[] = [];
    for (const tier of tierOrder) {
      for (const [, coll] of collections) {
        const t = this.classifyCollection(coll, collections);
        if (t === tier && !presentTiers.includes(tier)) {
          presentTiers.push(tier);
        }
      }
    }

    return {
      maxDepth,
      averageDepth: Math.round(averageDepth * 100) / 100,
      typicalChain: presentTiers.length > 0 ? presentTiers : ['value'],
      crossCollectionAliases,
      aliasPercentage: totalTokens > 0
        ? Math.round((aliasCount / totalTokens) * 100)
        : 0,
      circularCount,
    };
  }

  // ==========================================================================
  // SECTION 10: SCALE PATTERN ANALYSIS
  // ==========================================================================

  /**
   * Analyze scale patterns (color palettes, spacing, typography, breakpoints).
   */
  private analyzeScales(tokens: readonly DtcgParsedToken[]): ScalePatterns {
    // --- Color palettes ---
    // Look for tokens of type "color" grouped by parent path
    const colorTokens = tokens.filter(t => t.type === 'color' && !t.isAlias);
    const paletteMap = new Map<string, string[]>();

    for (const ct of colorTokens) {
      const lastDot = ct.path.lastIndexOf('.');
      if (lastDot === -1) continue;
      const parent = ct.path.substring(0, lastDot);
      const leaf = ct.path.substring(lastDot + 1);
      let existing = paletteMap.get(parent);
      if (!existing) {
        existing = [];
        paletteMap.set(parent, existing);
      }
      existing.push(leaf);
    }

    // Identify palette names and shade counts
    const palettes: string[] = [];
    const shadeCounts: number[] = [];

    for (const [parentPath, leaves] of paletteMap) {
      // Only count as a palette if it has 3+ shades
      if (leaves.length >= 3) {
        // Extract palette name (last segment of parent path)
        const lastDot = parentPath.lastIndexOf('.');
        const paletteName = lastDot === -1
          ? parentPath
          : parentPath.substring(lastDot + 1);
        palettes.push(paletteName);
        shadeCounts.push(leaves.length);
      }
    }

    // Dominant shade count (mode of shade counts)
    const colorShades = this.mode(shadeCounts) ?? 0;

    // --- Typography ---
    const typographyTypes = ['fontFamily', 'fontSize', 'fontWeight', 'typography', 'lineHeight'];
    const typographyTokens = tokens.filter(t =>
      typographyTypes.includes(t.type) && !t.isAlias,
    );
    // Count distinct "size-level" tokens
    const fontSizeTokens = tokens.filter(t =>
      (t.type === 'fontSize' || t.type === 'dimension') &&
      !t.isAlias &&
      t.path.toLowerCase().includes('font'),
    );
    const typographySizes = fontSizeTokens.length > 0
      ? fontSizeTokens.length
      : typographyTokens.length;

    // --- Spacing ---
    const spacingTokens = tokens.filter(t =>
      t.type === 'dimension' && !t.isAlias &&
      (t.path.toLowerCase().includes('spacing') || t.path.toLowerCase().includes('space')),
    );
    const spacingValues: number[] = [];
    for (const st of spacingTokens) {
      const numVal = this.extractNumericValue(st.rawValue);
      if (numVal !== undefined) {
        spacingValues.push(numVal);
      }
    }
    // Detect multiplier pattern
    const spacingMultipliers = this.detectMultiplierPattern(spacingValues);

    // --- Breakpoints ---
    // DTCG is single-mode, so no native breakpoints. Check for breakpoint-named tokens.
    const breakpointTokens = tokens.filter(t =>
      t.path.toLowerCase().includes('breakpoint') ||
      t.path.toLowerCase().includes('screen'),
    );
    const breakpointNames: string[] = [];
    for (const bt of breakpointTokens) {
      const lastDot = bt.path.lastIndexOf('.');
      const name = lastDot === -1 ? bt.path : bt.path.substring(lastDot + 1);
      if (!breakpointNames.includes(name)) {
        breakpointNames.push(name);
      }
    }

    return {
      colorShades,
      colorPalettes: palettes,
      spacingMultipliers,
      typographySizes,
      breakpointCount: breakpointNames.length,
      breakpointNames,
    };
  }

  // ==========================================================================
  // SECTION 11: UTILITY METHODS
  // ==========================================================================

  /**
   * Extract a numeric value from a DTCG $value.
   * Handles plain numbers, dimension objects { value: N, unit: "px" }, and strings.
   */
  private extractNumericValue(value: unknown): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) return num;
    }
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const inner = (value as Record<string, unknown>)['value'];
      if (typeof inner === 'number') return inner;
    }
    return undefined;
  }

  /**
   * Detect if spacing values follow a multiplier pattern.
   * E.g., [4, 8, 12, 16, 24, 32] → base=4, multipliers=[1, 2, 3, 4, 6, 8]
   */
  private detectMultiplierPattern(values: readonly number[]): readonly number[] {
    if (values.length < 2) return values;

    const sorted = [...values].sort((a, b) => a - b);
    const smallest = sorted[0];
    if (smallest === undefined || smallest <= 0) return values;

    // Check if all values are multiples of the smallest
    const allMultiples = sorted.every(v => v % smallest === 0);
    if (!allMultiples) return values;

    return sorted.map(v => v / smallest);
  }

  /**
   * Get the statistical mode (most frequent value) of a number array.
   */
  private mode(values: readonly number[]): number | undefined {
    if (values.length === 0) return undefined;

    const counts = new Map<number, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    let maxCount = 0;
    let modeValue: number | undefined;
    for (const [val, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        modeValue = val;
      }
    }

    return modeValue;
  }
}
