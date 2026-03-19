/**
 * Figma Token Extractor — Extracts StructuralFingerprint from Figma Extractor JSON.
 *
 * The Variables & Styles Extractor plugin exports a JSON array where each element
 * represents a collection (keyed by collection name) with nested mode → group → variable
 * structure. The last element may be a `_styles` object containing color, text,
 * effect, and grid styles.
 *
 * This extractor parses that format, walks the variable tree, and produces a
 * StructuralFingerprint that captures the architecture without the specific values.
 *
 * Expected input format:
 * ```json
 * [
 *   { "collectionName": { "modes": { "Light": { "group": { "var": { "$value": ..., "$type": ..., "$scopes": [...] } } } } } },
 *   { "_styles": { "colorStyles": [...], "textStyles": [...], "effectStyles": [...], "gridStyles": [...] } }
 * ]
 * ```
 *
 * @module core/learning/extractors/figma-token-extractor
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
} from '../types';

// ============================================================================
// SECTION 1: INTERNAL TYPES
// ============================================================================

/**
 * A parsed variable from the extractor JSON.
 * Intermediate representation used during analysis.
 */
interface ParsedVariable {
  readonly name: string;
  readonly fullPath: string;
  readonly type: string;
  readonly isAlias: boolean;
  readonly aliasTarget?: string;
  readonly aliasCollection?: string;
  readonly scopes: readonly string[];
  readonly collectionName: string;
  readonly mode: string;
}

/** Alias edge for dependency graph construction. */
interface AliasEdge {
  readonly fromCollection: string;
  readonly toCollection: string;
  readonly fromVariable: string;
  readonly toVariable: string;
}

// ============================================================================
// SECTION 2: EXTRACTOR CLASS
// ============================================================================

export class FigmaTokenExtractor extends FingerprintExtractor {
  constructor(config?: ExtractorConfig) {
    super(config ? { ...config, formatHint: 'figma-extractor-json' } : { sourceName: 'Figma Source', formatHint: 'figma-extractor-json' });
  }

  /**
   * Extract a StructuralFingerprint from Figma Extractor JSON.
   *
   * @param rawData - The parsed JSON array from the Extractor plugin export.
   * @param config - Optional config override for per-call usage.
   */
  extract(rawData: unknown, config?: ExtractorConfig): ExtractionResult {
    if (config) this.config = { ...config, formatHint: 'figma-extractor-json' };
    const startTime = Date.now();
    const warnings: string[] = [];

    // Guard: must be an array
    if (!Array.isArray(rawData)) {
      return this.failure(
        'Invalid input: expected an array of collection objects. ' +
        'Ensure you are passing the parsed JSON from Variables & Styles Extractor.',
        Date.now() - startTime,
      );
    }

    if (rawData.length === 0) {
      return this.failure(
        'Empty input array: no collections found.',
        Date.now() - startTime,
      );
    }

    try {
      // Parse all collections and styles
      const { variables, aliasEdges, collectionInfos, stylesEntry } =
        this.parseRawData(rawData, warnings);

      // Build collection topology
      const collections = this.buildCollectionTopologies(
        variables,
        aliasEdges,
        collectionInfos,
      );

      // Analyze naming conventions
      const allNames = variables.map(v => v.fullPath);
      const separator = this.detectSeparator(allNames);
      const namingConventions: NamingConventions = {
        separator,
        grouping: this.detectGrouping(allNames, separator),
        shadeNaming: this.detectShadeNaming(allNames, separator),
        casing: this.detectCasing(allNames, separator),
        examples: this.pickExamples(allNames, 5),
      };

      // Analyze alias topology
      const aliasTopology = this.analyzeAliasTopology(variables, aliasEdges, collections);

      // Analyze scale patterns
      const scalePatterns = this.analyzeScalePatterns(variables, collections, separator);

      // Analyze style strategy
      const styleStrategy = this.analyzeStyleStrategy(stylesEntry, warnings);

      // Build source metadata
      const source: SourceMetadata = {
        name: this.config.sourceName,
        sourceFormat: 'figma-extractor-json',
        totalVariables: this.countUniqueVariables(variables),
        totalStyles:
          styleStrategy.colorStyleCount +
          styleStrategy.textStyleCount +
          styleStrategy.effectStyleCount +
          styleStrategy.gridStyleCount,
        totalPages: 0, // Not available in extractor JSON
        extractedAt: new Date().toISOString(),
        sourceLocation: this.config.description,
      };

      const fingerprint: StructuralFingerprint = {
        collections,
        namingConventions,
        aliasTopology,
        scalePatterns,
        styleStrategy,
        source,
      };

      return this.success(fingerprint, warnings, Date.now() - startTime);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return this.failure(
        `Extraction failed: ${message}. ` +
        'Check that the input matches the Variables & Styles Extractor JSON format.',
        Date.now() - startTime,
      );
    }
  }

  // ==========================================================================
  // SECTION 3: RAW DATA PARSING
  // ==========================================================================

  /**
   * Parse the raw JSON array into ParsedVariables and alias edges.
   */
  private parseRawData(
    rawData: unknown[],
    warnings: string[],
  ): {
    variables: ParsedVariable[];
    aliasEdges: AliasEdge[];
    collectionInfos: Map<string, { modes: Set<string> }>;
    stylesEntry: Record<string, unknown> | undefined;
  } {
    const variables: ParsedVariable[] = [];
    const aliasEdges: AliasEdge[] = [];
    const collectionInfos = new Map<string, { modes: Set<string> }>();
    let stylesEntry: Record<string, unknown> | undefined;

    for (const entry of rawData) {
      if (entry === null || typeof entry !== 'object') {
        warnings.push('Skipping non-object entry in input array.');
        continue;
      }

      const obj = entry as Record<string, unknown>;

      // Check for _styles entry
      if ('_styles' in obj && obj['_styles'] !== undefined) {
        stylesEntry = obj['_styles'] as Record<string, unknown>;
        continue;
      }

      // Each entry has a single key = collection name
      const keys = Object.keys(obj);
      if (keys.length !== 1) {
        warnings.push(`Entry has ${keys.length} keys; expected 1 collection. Using first key.`);
      }

      const collectionName = keys[0];
      if (!collectionName) {
        warnings.push('Entry has no keys, skipping.');
        continue;
      }
      const collectionData = obj[collectionName] as Record<string, unknown>;

      if (!collectionData || typeof collectionData !== 'object') {
        warnings.push(`Collection "${collectionName}" has no valid data, skipping.`);
        continue;
      }

      const modesData = collectionData['modes'] as Record<string, unknown> | undefined;
      if (!modesData || typeof modesData !== 'object') {
        warnings.push(`Collection "${collectionName}" has no modes object, skipping.`);
        continue;
      }

      if (!collectionInfos.has(collectionName)) {
        collectionInfos.set(collectionName, { modes: new Set<string>() });
      }
      // Safe: we just ensured key exists above
      const info = collectionInfos.get(collectionName) ?? { modes: new Set<string>() };

      for (const [modeName, modeData] of Object.entries(modesData)) {
        info.modes.add(modeName);

        if (modeData === null || typeof modeData !== 'object') continue;

        // Walk the nested variable tree
        this.walkVariableTree(
          modeData as Record<string, unknown>,
          '',
          collectionName,
          modeName,
          variables,
          aliasEdges,
        );
      }
    }

    return { variables, aliasEdges, collectionInfos, stylesEntry };
  }

  /**
   * Recursively walk a nested variable tree, collecting ParsedVariables.
   *
   * The extractor format nests groups as objects. A leaf node has `$value` and `$type`.
   * Intermediate nodes are group containers.
   */
  private walkVariableTree(
    node: Record<string, unknown>,
    pathPrefix: string,
    collectionName: string,
    mode: string,
    variables: ParsedVariable[],
    aliasEdges: AliasEdge[],
  ): void {
    for (const [key, value] of Object.entries(node)) {
      // Skip $ metadata keys at this level
      if (key.startsWith('$')) continue;

      if (value === null || typeof value !== 'object') continue;

      const child = value as Record<string, unknown>;
      const currentPath = pathPrefix ? `${pathPrefix}/${key}` : key;

      // Check if this is a leaf variable (has $value and $type)
      if ('$value' in child && '$type' in child) {
        const rawValue = child['$value'];
        const isAlias = typeof rawValue === 'string' && rawValue.startsWith('{') && rawValue.endsWith('}');

        let aliasTarget: string | undefined;
        let aliasCollection: string | undefined;

        if (isAlias) {
          // Parse alias: "{blue.6}" → target "blue/6"
          aliasTarget = (rawValue as string).slice(1, -1).replace(/\./g, '/');
          aliasCollection = (child['$collectionName'] as string) || collectionName;

          aliasEdges.push({
            fromCollection: collectionName,
            toCollection: aliasCollection,
            fromVariable: currentPath,
            toVariable: aliasTarget,
          });
        }

        const scopes = Array.isArray(child['$scopes'])
          ? (child['$scopes'] as string[])
          : [];

        variables.push({
          name: key,
          fullPath: currentPath,
          type: String(child['$type']),
          isAlias,
          aliasTarget,
          aliasCollection,
          scopes,
          collectionName,
          mode,
        });
      } else {
        // This is a group node — recurse
        this.walkVariableTree(child, currentPath, collectionName, mode, variables, aliasEdges);
      }
    }
  }

  // ==========================================================================
  // SECTION 4: COLLECTION TOPOLOGY
  // ==========================================================================

  /**
   * Build CollectionTopology entries from parsed variables and alias edges.
   */
  private buildCollectionTopologies(
    variables: ParsedVariable[],
    aliasEdges: AliasEdge[],
    collectionInfos: Map<string, { modes: Set<string> }>,
  ): CollectionTopology[] {
    // Build dependency maps
    const dependsOn = new Map<string, Set<string>>();
    const dependedOnBy = new Map<string, Set<string>>();

    for (const edge of aliasEdges) {
      if (edge.fromCollection !== edge.toCollection) {
        const depsSet = dependsOn.get(edge.fromCollection);
        if (depsSet) {
          depsSet.add(edge.toCollection);
        } else {
          dependsOn.set(edge.fromCollection, new Set([edge.toCollection]));
        }

        const revDepsSet = dependedOnBy.get(edge.toCollection);
        if (revDepsSet) {
          revDepsSet.add(edge.fromCollection);
        } else {
          dependedOnBy.set(edge.toCollection, new Set([edge.fromCollection]));
        }
      }
    }

    const topologies: CollectionTopology[] = [];

    for (const [collName, info] of collectionInfos.entries()) {
      // Get unique variables (deduplicate across modes — same path in different modes is one variable)
      const uniquePaths = new Set(
        variables
          .filter(v => v.collectionName === collName)
          .map(v => v.fullPath),
      );

      // Type distribution
      const typeDistribution: Record<string, number> = {};
      const seenPaths = new Set<string>();
      for (const v of variables) {
        if (v.collectionName === collName && !seenPaths.has(v.fullPath)) {
          seenPaths.add(v.fullPath);
          typeDistribution[v.type] = (typeDistribution[v.type] || 0) + 1;
        }
      }

      // Alias percentage for tier classification
      const collVars = variables.filter(v => v.collectionName === collName);
      const aliasCount = new Set(
        collVars.filter(v => v.isAlias).map(v => v.fullPath),
      ).size;
      const aliasPercentage = uniquePaths.size > 0
        ? (aliasCount / uniquePaths.size) * 100
        : 0;

      const deps = dependsOn.get(collName) || new Set();
      const revDeps = dependedOnBy.get(collName) || new Set();

      const tier = this.classifyTier(
        collName,
        aliasPercentage,
        deps.size,
        revDeps.size,
      );

      topologies.push({
        name: collName,
        tier,
        modes: Array.from(info.modes),
        variableCount: uniquePaths.size,
        dependsOn: Array.from(deps),
        dependedOnBy: Array.from(revDeps),
        typeDistribution,
      });
    }

    return topologies;
  }

  // ==========================================================================
  // SECTION 5: ALIAS TOPOLOGY ANALYSIS
  // ==========================================================================

  /**
   * Analyze alias chain depth and patterns.
   */
  private analyzeAliasTopology(
    variables: ParsedVariable[],
    aliasEdges: AliasEdge[],
    collections: readonly CollectionTopology[],
  ): AliasTopology {
    // Build alias graph for depth analysis
    const aliasMap = new Map<string, { target: string; targetCollection: string }>();
    for (const edge of aliasEdges) {
      const key = `${edge.fromCollection}::${edge.fromVariable}`;
      aliasMap.set(key, { target: edge.toVariable, targetCollection: edge.toCollection });
    }

    // Calculate chain depths
    const depths: number[] = [];
    const visited = new Set<string>();

    for (const edge of aliasEdges) {
      const startKey = `${edge.fromCollection}::${edge.fromVariable}`;
      if (visited.has(startKey)) continue;

      let depth = 0;
      let currentKey = startKey;
      const chainVisited = new Set<string>();

      while (aliasMap.has(currentKey) && !chainVisited.has(currentKey)) {
        chainVisited.add(currentKey);
        const next = aliasMap.get(currentKey);
        if (!next) break;
        currentKey = `${next.targetCollection}::${next.target}`;
        depth++;
      }

      depths.push(depth);
      visited.add(startKey);
    }

    const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
    const averageDepth = depths.length > 0
      ? depths.reduce((sum, d) => sum + d, 0) / depths.length
      : 0;

    // Determine typical chain from collection tiers
    const crossCollection = aliasEdges.some(e => e.fromCollection !== e.toCollection);

    // Build typical chain order using topological hints
    const typicalChain: string[] = [];
    const tierOrder: Record<string, number> = {
      'primitive': 0, 'seed': 1, 'mapped': 2,
      'semantic': 3, 'component': 4, 'responsive': 5, 'unknown': 6,
    };

    const sortedCollections = [...collections].sort(
      (a, b) => (tierOrder[a.tier] ?? 6) - (tierOrder[b.tier] ?? 6),
    );
    for (const coll of sortedCollections) {
      if (coll.tier !== 'unknown' && coll.tier !== 'responsive') {
        typicalChain.push(coll.name);
      }
    }

    // Count unique aliased variables
    const uniqueAliasedPaths = new Set(
      variables.filter(v => v.isAlias).map(v => `${v.collectionName}::${v.fullPath}`),
    );
    const uniqueAllPaths = new Set(
      variables.map(v => `${v.collectionName}::${v.fullPath}`),
    );
    const aliasPercentage = uniqueAllPaths.size > 0
      ? (uniqueAliasedPaths.size / uniqueAllPaths.size) * 100
      : 0;

    // Count circular references (simple check — if chain depth exceeds collection count)
    const circularCount = depths.filter(d => d > collections.length + 1).length;

    return {
      maxDepth,
      averageDepth: Math.round(averageDepth * 100) / 100,
      typicalChain,
      crossCollectionAliases: crossCollection,
      aliasPercentage: Math.round(aliasPercentage * 100) / 100,
      circularCount,
    };
  }

  // ==========================================================================
  // SECTION 6: SCALE PATTERN ANALYSIS
  // ==========================================================================

  /**
   * Analyze color scale, spacing, and breakpoint patterns.
   */
  private analyzeScalePatterns(
    variables: ParsedVariable[],
    collections: readonly CollectionTopology[],
    separator: string,
  ): ScalePatterns {
    // Find color palettes in primitive/seed collections
    const primitiveCollections = collections.filter(
      c => c.tier === 'primitive' || c.tier === 'seed',
    );
    const primitiveCollNames = new Set(primitiveCollections.map(c => c.name));

    // Get unique color variable paths from primitive collections
    const colorVarPaths = new Set<string>();
    for (const v of variables) {
      if (primitiveCollNames.has(v.collectionName) && v.type === 'color') {
        colorVarPaths.add(v.fullPath);
      }
    }

    // Extract palette names and shade counts
    const palettes = new Map<string, Set<string>>();
    for (const varPath of colorVarPaths) {
      const parts = varPath.split(separator);
      if (parts.length >= 2) {
        const paletteName = parts[0] ?? '';
        const shade = parts.slice(1).join(separator);
        const existing = palettes.get(paletteName);
        if (existing) {
          existing.add(shade);
        } else {
          palettes.set(paletteName, new Set([shade]));
        }
      }
    }

    const colorPalettes = Array.from(palettes.keys());
    const shadeCounts = Array.from(palettes.values()).map(s => s.size);
    const dominantShadeCount = shadeCounts.length > 0
      ? this.mode(shadeCounts)
      : 0;

    // Find responsive collection for breakpoints
    const responsiveCollection = collections.find(c => c.tier === 'responsive');
    const breakpointCount = responsiveCollection ? responsiveCollection.modes.length : 0;
    const breakpointNames = responsiveCollection ? responsiveCollection.modes : [];

    // Count typography sizes (unique float variables in semantic/component tiers that look like font sizes)
    const typographyVarPaths = new Set<string>();
    for (const v of variables) {
      if (v.type === 'float' && /font|size|text|typography/i.test(v.fullPath)) {
        typographyVarPaths.add(v.fullPath);
      }
    }

    return {
      colorShades: dominantShadeCount,
      colorPalettes,
      spacingMultipliers: [], // Would need value analysis to detect — fingerprint is structural
      typographySizes: typographyVarPaths.size,
      breakpointCount,
      breakpointNames: Array.from(breakpointNames),
    };
  }

  // ==========================================================================
  // SECTION 7: STYLE STRATEGY ANALYSIS
  // ==========================================================================

  /**
   * Analyze the styles entry from the extractor JSON.
   */
  private analyzeStyleStrategy(
    stylesEntry: Record<string, unknown> | undefined,
    warnings: string[],
  ): StyleStrategy {
    if (!stylesEntry) {
      return {
        colorStyleCount: 0,
        textStyleCount: 0,
        effectStyleCount: 0,
        gridStyleCount: 0,
        textStyleNaming: 'unknown',
        effectStyleNaming: 'unknown',
        stylesBindToVariables: false,
      };
    }

    const colorStyles = Array.isArray(stylesEntry['colorStyles']) ? stylesEntry['colorStyles'] : [];
    const textStyles = Array.isArray(stylesEntry['textStyles']) ? stylesEntry['textStyles'] : [];
    const effectStyles = Array.isArray(stylesEntry['effectStyles']) ? stylesEntry['effectStyles'] : [];
    const gridStyles = Array.isArray(stylesEntry['gridStyles']) ? stylesEntry['gridStyles'] : [];

    // Detect naming patterns
    const textStyleNaming = this.detectStyleNamingPattern(
      textStyles.map((s: Record<string, unknown>) => String(s['name'] || '')),
    );
    const effectStyleNaming = this.detectStyleNamingPattern(
      effectStyles.map((s: Record<string, unknown>) => String(s['name'] || '')),
    );

    // Check if styles reference variables (bound)
    const stylesBindToVariables = this.checkStyleVariableBindings(
      colorStyles,
      textStyles,
      effectStyles,
      warnings,
    );

    return {
      colorStyleCount: colorStyles.length,
      textStyleCount: textStyles.length,
      effectStyleCount: effectStyles.length,
      gridStyleCount: gridStyles.length,
      textStyleNaming,
      effectStyleNaming,
      stylesBindToVariables,
    };
  }

  /**
   * Detect the naming pattern used in style names.
   * Returns a pattern string like "{weight}/{size}" or "{role}".
   */
  private detectStyleNamingPattern(names: string[]): string {
    if (names.length === 0) return 'unknown';

    // Check for slash-separated patterns
    const withSlash = names.filter(n => n.includes('/'));
    if (withSlash.length > names.length * 0.5) {
      // Analyze segments
      const segmentCounts = withSlash.map(n => n.split('/').length);
      const avgSegments = Math.round(
        segmentCounts.reduce((a, b) => a + b, 0) / segmentCounts.length,
      );
      return avgSegments === 2 ? '{category}/{name}' : '{category}/{subcategory}/{name}';
    }

    // Check for dash-separated
    const withDash = names.filter(n => n.includes('-'));
    if (withDash.length > names.length * 0.5) {
      return '{name}-{variant}';
    }

    return '{name}';
  }

  /**
   * Check if any styles reference variables (have variable bindings).
   */
  private checkStyleVariableBindings(
    colorStyles: unknown[],
    textStyles: unknown[],
    effectStyles: unknown[],
    _warnings: string[],
  ): boolean {
    const allStyles = [...colorStyles, ...textStyles, ...effectStyles];
    for (const style of allStyles) {
      if (style !== null && typeof style === 'object') {
        const s = style as Record<string, unknown>;
        // Check for variable binding indicators
        if (s['boundVariables'] || s['variableId'] || s['$variable']) {
          return true;
        }
      }
    }
    return false;
  }

  // ==========================================================================
  // SECTION 8: UTILITY METHODS
  // ==========================================================================

  /** Count unique variables across all modes (same path = one variable). */
  private countUniqueVariables(variables: ParsedVariable[]): number {
    const unique = new Set(
      variables.map(v => `${v.collectionName}::${v.fullPath}`),
    );
    return unique.size;
  }

  /** Pick N representative example names, spaced evenly through the list. */
  private pickExamples(names: readonly string[], count: number): string[] {
    if (names.length <= count) return [...names];

    const step = Math.floor(names.length / count);
    const examples: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = names[i * step];
      if (name !== undefined) examples.push(name);
    }
    return examples;
  }

  /** Calculate the statistical mode (most frequent value) of an array. */
  private mode(values: number[]): number {
    const freq = new Map<number, number>();
    for (const v of values) {
      freq.set(v, (freq.get(v) || 0) + 1);
    }

    let modeVal = values[0] ?? 0;
    let maxFreq = 0;
    for (const [val, count] of freq.entries()) {
      if (count > maxFreq) {
        maxFreq = count;
        modeVal = val;
      }
    }
    return modeVal;
  }
}
