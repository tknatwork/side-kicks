/**
 * CSS Token Extractor — Extracts StructuralFingerprint from CSS custom properties.
 *
 * Parses CSS files containing custom properties (--var-name: value) and analyzes
 * the naming conventions, grouping, and structure to produce a StructuralFingerprint.
 *
 * CSS variables don't have explicit collections or modes, so this extractor:
 *   1. Groups variables by prefix to infer collections
 *   2. Detects :root vs media query scopes to infer modes
 *   3. Identifies var() references as aliases
 *
 * Supported input:
 * ```css
 * :root {
 *   --color-primary-500: #6366F1;
 *   --bg-primary: var(--color-primary-500);
 * }
 * @media (prefers-color-scheme: dark) {
 *   :root {
 *     --bg-primary: var(--color-primary-900);
 *   }
 * }
 * ```
 *
 * @module core/learning/extractors/css-token-extractor
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

/** A parsed CSS custom property declaration. */
interface CssVariable {
  readonly name: string;
  readonly rawValue: string;
  readonly isAlias: boolean;
  readonly aliasTarget?: string;
  readonly scope: string;
  readonly type: 'color' | 'dimension' | 'string' | 'number' | 'unknown';
}

/** A detected scope context (e.g., :root, .dark, @media). */
interface ScopeContext {
  readonly name: string;
  readonly variables: CssVariable[];
}

// ============================================================================
// SECTION 2: EXTRACTOR CLASS
// ============================================================================

export class CssTokenExtractor extends FingerprintExtractor {
  constructor(config?: ExtractorConfig) {
    super(config ? { ...config, formatHint: 'css-variables' } : { sourceName: 'CSS Source', formatHint: 'css-variables' });
  }

  /**
   * Extract a StructuralFingerprint from CSS text containing custom properties.
   *
   * @param rawData - CSS text as a string.
   * @param config - Optional config override for per-call usage.
   */
  extract(rawData: unknown, config?: ExtractorConfig): ExtractionResult {
    if (config) this.config = { ...config, formatHint: 'css-variables' };
    const startTime = Date.now();
    const warnings: string[] = [];

    if (typeof rawData !== 'string') {
      return this.failure(
        'Invalid input: expected a CSS string. ' +
        'Pass the CSS file content as a string.',
        Date.now() - startTime,
      );
    }

    const cssText = rawData.trim();
    if (cssText.length === 0) {
      return this.failure('Empty CSS input.', Date.now() - startTime);
    }

    try {
      // Parse CSS custom properties
      const scopes = this.parseCssScopes(cssText, warnings);
      const allVariables = scopes.flatMap(s => s.variables);

      if (allVariables.length === 0) {
        return this.failure(
          'No CSS custom properties found. Ensure the CSS contains --variable declarations.',
          Date.now() - startTime,
        );
      }

      // Group variables by prefix to infer collections
      const collections = this.inferCollections(allVariables, scopes, warnings);

      // Analyze naming conventions
      const allNames = allVariables.map(v => v.name);
      const separator = this.detectSeparator(allNames);
      const namingConventions: NamingConventions = {
        separator,
        grouping: this.detectGrouping(allNames, separator),
        shadeNaming: this.detectShadeNaming(allNames, separator),
        casing: this.detectCasing(allNames, separator),
        examples: this.pickExamples(allNames, 5),
      };

      // Analyze alias topology
      const aliasTopology = this.analyzeAliasTopology(allVariables);

      // Analyze scale patterns
      const scalePatterns = this.analyzeScalePatterns(allVariables, separator);

      // CSS doesn't have Figma-style styles
      const styleStrategy: StyleStrategy = {
        colorStyleCount: 0,
        textStyleCount: 0,
        effectStyleCount: 0,
        gridStyleCount: 0,
        textStyleNaming: 'n/a',
        effectStyleNaming: 'n/a',
        stylesBindToVariables: false,
      };

      const source: SourceMetadata = {
        name: this.config.sourceName,
        sourceFormat: 'css-variables',
        totalVariables: new Set(allVariables.map(v => v.name)).size,
        totalStyles: 0,
        totalPages: 0,
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
        `CSS extraction failed: ${message}`,
        Date.now() - startTime,
      );
    }
  }

  // ==========================================================================
  // SECTION 3: CSS PARSING
  // ==========================================================================

  /**
   * Parse CSS text into scope contexts, each containing its custom properties.
   */
  private parseCssScopes(cssText: string, warnings: string[]): ScopeContext[] {
    const scopes: ScopeContext[] = [];

    // Match custom property declarations: --name: value;
    const varRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;

    // Match scope blocks — simplified parser for :root, .dark, [data-theme], @media
    // Leading \s* ensures @media is matched after inter-block whitespace
    const scopeRegex = /\s*(?:(@media[^{]*)\{[^{]*|([^{]*?))\{([^}]*)\}/g;

    let scopeMatch: RegExpExecArray | null;
    while ((scopeMatch = scopeRegex.exec(cssText)) !== null) {
      const mediaQuery = (scopeMatch[1] || '').trim();
      const selector = (scopeMatch[2] || '').trim();
      const block = scopeMatch[3] || '';

      let scopeName = 'default';
      if (mediaQuery) {
        // Extract mode from media query
        if (/prefers-color-scheme:\s*dark/i.test(mediaQuery)) {
          scopeName = 'Dark';
        } else if (/prefers-color-scheme:\s*light/i.test(mediaQuery)) {
          scopeName = 'Light';
        } else if (/min-width|max-width/i.test(mediaQuery)) {
          // Breakpoint scope
          const widthMatch = mediaQuery.match(/(?:min|max)-width:\s*(\d+)/);
          scopeName = widthMatch && widthMatch[1] ? `breakpoint-${widthMatch[1]}` : 'responsive';
        } else {
          scopeName = mediaQuery;
        }
      } else if (selector) {
        if (/\.dark|data-theme.*dark|dark-mode/i.test(selector)) {
          scopeName = 'Dark';
        } else if (/\.light|data-theme.*light|:root/i.test(selector)) {
          scopeName = 'Light';
        } else if (selector === ':root') {
          scopeName = 'Light'; // Default :root = Light mode
        } else {
          scopeName = selector;
        }
      }

      const variables: CssVariable[] = [];
      let varMatch: RegExpExecArray | null;
      const localVarRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;

      while ((varMatch = localVarRegex.exec(block)) !== null) {
        const name = varMatch[1] || '';
        const rawValue = (varMatch[2] || '').trim();
        const isAlias = /var\(--[a-zA-Z0-9_-]+\)/.test(rawValue);

        let aliasTarget: string | undefined;
        if (isAlias) {
          const aliasMatch = rawValue.match(/var\(--([a-zA-Z0-9_-]+)\)/);
          if (aliasMatch) {
            aliasTarget = aliasMatch[1];
          }
        }

        variables.push({
          name,
          rawValue,
          isAlias,
          aliasTarget,
          scope: scopeName,
          type: this.inferCssValueType(rawValue),
        });
      }

      if (variables.length > 0) {
        scopes.push({ name: scopeName, variables });
      }
    }

    // If no scopes matched (flat CSS with just custom properties at top level)
    if (scopes.length === 0) {
      const variables: CssVariable[] = [];
      let varMatch: RegExpExecArray | null;
      while ((varMatch = varRegex.exec(cssText)) !== null) {
        const name = varMatch[1] || '';
        const rawValue = (varMatch[2] || '').trim();
        const isAlias = /var\(--[a-zA-Z0-9_-]+\)/.test(rawValue);

        let aliasTarget: string | undefined;
        if (isAlias) {
          const aliasMatch = rawValue.match(/var\(--([a-zA-Z0-9_-]+)\)/);
          if (aliasMatch) {
            aliasTarget = aliasMatch[1];
          }
        }

        variables.push({
          name,
          rawValue,
          isAlias,
          aliasTarget,
          scope: 'default',
          type: this.inferCssValueType(rawValue),
        });
      }

      if (variables.length > 0) {
        scopes.push({ name: 'default', variables });
        warnings.push('No scope blocks detected — all variables treated as default scope.');
      }
    }

    return scopes;
  }

  /**
   * Infer the type of a CSS value.
   */
  private inferCssValueType(value: string): CssVariable['type'] {
    // Color patterns
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return 'color';
    if (/^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/.test(value)) return 'color';
    if (/^(transparent|currentColor|inherit)$/i.test(value)) return 'color';

    // Dimension patterns
    if (/^-?[\d.]+\s*(px|rem|em|vh|vw|%|pt|cm|mm|in|ch|ex|vmin|vmax)$/i.test(value)) {
      return 'dimension';
    }

    // Number
    if (/^-?[\d.]+$/.test(value)) return 'number';

    // var() reference — type depends on target
    if (/^var\(/.test(value)) return 'unknown';

    // String (quoted)
    if (/^["']/.test(value)) return 'string';

    return 'unknown';
  }

  // ==========================================================================
  // SECTION 4: COLLECTION INFERENCE
  // ==========================================================================

  /**
   * Group CSS variables by their first prefix segment to infer "collections."
   *
   * For CSS variables like --color-primary-500, --bg-primary, --text-body,
   * the first segment (color, bg, text) acts as a pseudo-collection.
   */
  private inferCollections(
    allVariables: CssVariable[],
    scopes: ScopeContext[],
    _warnings: string[],
  ): CollectionTopology[] {
    // Detect separator in CSS names
    const names = allVariables.map(v => v.name);
    const separator = this.detectSeparator(names);

    // Group by first segment
    const groups = new Map<string, CssVariable[]>();
    for (const v of allVariables) {
      const parts = v.name.split(separator);
      const group = parts.length > 1 ? (parts[0] ?? '_ungrouped') : '_ungrouped';
      const existing = groups.get(group);
      if (existing) {
        existing.push(v);
      } else {
        groups.set(group, [v]);
      }
    }

    // Collect unique modes
    const allModes = Array.from(new Set(scopes.map(s => s.name)));

    // Build alias dependency map between groups
    const groupDeps = new Map<string, Set<string>>();
    for (const v of allVariables) {
      if (v.isAlias && v.aliasTarget) {
        const fromGroup = v.name.split(separator)[0] ?? '';
        const toGroup = v.aliasTarget.split(separator)[0] ?? '';
        if (fromGroup !== toGroup) {
          const existing = groupDeps.get(fromGroup);
          if (existing) {
            existing.add(toGroup);
          } else {
            groupDeps.set(fromGroup, new Set([toGroup]));
          }
        }
      }
    }

    const groupRevDeps = new Map<string, Set<string>>();
    for (const [from, tos] of groupDeps.entries()) {
      for (const to of tos) {
        const existing = groupRevDeps.get(to);
        if (existing) {
          existing.add(from);
        } else {
          groupRevDeps.set(to, new Set([from]));
        }
      }
    }

    const topologies: CollectionTopology[] = [];

    for (const [groupName, vars] of groups.entries()) {
      const uniqueNames = new Set(vars.map(v => v.name));
      const aliasCount = new Set(vars.filter(v => v.isAlias).map(v => v.name)).size;
      const aliasPercentage = uniqueNames.size > 0
        ? (aliasCount / uniqueNames.size) * 100
        : 0;

      const deps = groupDeps.get(groupName) || new Set();
      const revDeps = groupRevDeps.get(groupName) || new Set();

      const typeDistribution: Record<string, number> = {};
      const seenNames = new Set<string>();
      for (const v of vars) {
        if (!seenNames.has(v.name)) {
          seenNames.add(v.name);
          typeDistribution[v.type] = (typeDistribution[v.type] || 0) + 1;
        }
      }

      const tier = this.classifyTier(
        groupName,
        aliasPercentage,
        deps.size,
        revDeps.size,
      );

      topologies.push({
        name: groupName,
        tier,
        modes: allModes,
        variableCount: uniqueNames.size,
        dependsOn: Array.from(deps),
        dependedOnBy: Array.from(revDeps),
        typeDistribution,
      });
    }

    return topologies;
  }

  // ==========================================================================
  // SECTION 5: ALIAS ANALYSIS
  // ==========================================================================

  /**
   * Analyze alias chains in CSS variables.
   */
  private analyzeAliasTopology(variables: CssVariable[]): AliasTopology {
    // Build alias graph
    const aliasMap = new Map<string, string>();
    for (const v of variables) {
      if (v.isAlias && v.aliasTarget) {
        aliasMap.set(v.name, v.aliasTarget);
      }
    }

    // Calculate chain depths
    const depths: number[] = [];
    for (const [name] of aliasMap.entries()) {
      let depth = 0;
      let current = name;
      const visited = new Set<string>();

      while (aliasMap.has(current) && !visited.has(current)) {
        visited.add(current);
        const next = aliasMap.get(current);
        if (!next) break;
        current = next;
        depth++;
      }

      depths.push(depth);
    }

    const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
    const averageDepth = depths.length > 0
      ? depths.reduce((sum, d) => sum + d, 0) / depths.length
      : 0;

    const uniqueNames = new Set(variables.map(v => v.name));
    const aliasNames = new Set(variables.filter(v => v.isAlias).map(v => v.name));
    const aliasPercentage = uniqueNames.size > 0
      ? (aliasNames.size / uniqueNames.size) * 100
      : 0;

    // Detect cross-group aliases
    const separator = this.detectSeparator(Array.from(aliasMap.keys()));
    let crossGroup = false;
    for (const [from, to] of aliasMap.entries()) {
      const fromGroup = from.split(separator)[0] ?? '';
      const toGroup = to.split(separator)[0] ?? '';
      if (fromGroup !== toGroup) {
        crossGroup = true;
        break;
      }
    }

    const circularCount = depths.filter(d => d > 10).length;

    return {
      maxDepth,
      averageDepth: Math.round(averageDepth * 100) / 100,
      typicalChain: [],
      crossCollectionAliases: crossGroup,
      aliasPercentage: Math.round(aliasPercentage * 100) / 100,
      circularCount,
    };
  }

  // ==========================================================================
  // SECTION 6: SCALE PATTERNS
  // ==========================================================================

  /**
   * Analyze color and dimension scale patterns in CSS variables.
   */
  private analyzeScalePatterns(
    variables: CssVariable[],
    separator: string,
  ): ScalePatterns {
    // Find color palettes
    const colorVars = variables.filter(v => v.type === 'color');
    const palettes = new Map<string, Set<string>>();

    for (const v of colorVars) {
      const parts = v.name.split(separator);
      if (parts.length >= 2) {
        const palette = parts[0] ?? '';
        const shade = parts.slice(1).join(separator);
        const existing = palettes.get(palette);
        if (existing) {
          existing.add(shade);
        } else {
          palettes.set(palette, new Set([shade]));
        }
      }
    }

    const colorPalettes = Array.from(palettes.keys());
    const shadeCounts = Array.from(palettes.values()).map(s => s.size);
    const dominantShadeCount = shadeCounts.length > 0
      ? this.modeOfArray(shadeCounts)
      : 0;

    // Detect breakpoints from scope names
    const breakpointScopes = variables
      .filter(v => v.scope.startsWith('breakpoint-'))
      .map(v => v.scope);
    const uniqueBreakpoints = Array.from(new Set(breakpointScopes));

    return {
      colorShades: dominantShadeCount,
      colorPalettes,
      spacingMultipliers: [],
      typographySizes: variables.filter(
        v => v.type === 'dimension' && /font|size|text/i.test(v.name),
      ).length,
      breakpointCount: uniqueBreakpoints.length,
      breakpointNames: uniqueBreakpoints,
    };
  }

  // ==========================================================================
  // SECTION 7: UTILITIES
  // ==========================================================================

  /** Pick N representative examples from names. */
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

  /** Statistical mode of a number array. */
  private modeOfArray(values: number[]): number {
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
