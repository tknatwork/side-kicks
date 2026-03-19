/**
 * Fingerprint Extractor — Abstract base class for all Learning Engine extractors.
 *
 * Every extractor follows the same contract:
 *   1. Accept raw input data (JSON, CSS text, etc.)
 *   2. Parse it into intermediate structures
 *   3. Analyze structural patterns (naming, tiers, aliases, scales)
 *   4. Return a StructuralFingerprint
 *
 * Concrete extractors:
 *   - FigmaTokenExtractor: Extracts from Figma Extractor plugin JSON
 *   - CssTokenExtractor: Extracts from CSS custom property files
 *
 * @module core/learning/fingerprint-extractor
 */

import type {
  StructuralFingerprint,
  ExtractorConfig,
  ExtractionResult,
  CollectionTier,
  NamingSeparator,
  NamingCasing,
  GroupingStrategy,
  ShadeNaming,
} from './types';

// ============================================================================
// SECTION 1: ABSTRACT EXTRACTOR
// ============================================================================

/**
 * Base class for all fingerprint extractors.
 *
 * Subclasses implement `extractFingerprint()` to parse their specific
 * format. This base class provides shared analysis utilities.
 */
export abstract class FingerprintExtractor {
  protected config: ExtractorConfig;

  constructor(config?: ExtractorConfig) {
    this.config = config ?? { sourceName: 'Unknown' };
  }

  /**
   * Extract a StructuralFingerprint from raw input data.
   * Each subclass implements this for its specific format.
   *
   * @param rawData - The raw source data to analyze.
   * @param config - Optional config override (used by DesignSystemLearner to
   *   pass per-call config without reconstructing the extractor).
   */
  abstract extract(rawData: unknown, config?: ExtractorConfig): ExtractionResult;

  // ==========================================================================
  // SECTION 2: NAMING ANALYSIS UTILITIES
  // ==========================================================================

  /**
   * Detect the dominant separator character in variable names.
   * Counts occurrences of /, ., -, _ and returns the most common.
   */
  protected detectSeparator(names: readonly string[]): NamingSeparator {
    if (names.length === 0) return '/';

    const counts: Record<NamingSeparator, number> = { '/': 0, '.': 0, '-': 0, '_': 0 };

    for (const name of names) {
      for (const char of name) {
        if (char in counts) {
          counts[char as NamingSeparator]++;
        }
      }
    }

    let maxSep: NamingSeparator = '/';
    let maxCount = 0;
    const separators: NamingSeparator[] = ['/', '.', '-', '_'];
    for (const sep of separators) {
      if (counts[sep] > maxCount) {
        maxCount = counts[sep];
        maxSep = sep;
      }
    }

    return maxSep;
  }

  /**
   * Detect the dominant casing style in variable name segments.
   * Splits names by detected separator, then checks each segment.
   */
  protected detectCasing(names: readonly string[], separator: NamingSeparator): NamingCasing {
    if (names.length === 0) return 'camelCase';

    const votes: Record<NamingCasing, number> = {
      'camelCase': 0,
      'kebab-case': 0,
      'PascalCase': 0,
      'snake_case': 0,
      'mixed': 0,
    };

    for (const name of names) {
      const segments = name.split(separator);
      for (const seg of segments) {
        if (seg.length === 0) continue;

        if (/^[a-z][a-zA-Z0-9]*$/.test(seg) && /[A-Z]/.test(seg)) {
          votes['camelCase']++;
        } else if (/^[A-Z][a-zA-Z0-9]*$/.test(seg)) {
          votes['PascalCase']++;
        } else if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(seg)) {
          votes['kebab-case']++;
        } else if (/^[a-z0-9]+(_[a-z0-9]+)*$/.test(seg) && seg.includes('_')) {
          votes['snake_case']++;
        } else {
          // Single lowercase word or number — ambiguous, skip
        }
      }
    }

    let maxCasing: NamingCasing = 'camelCase';
    let maxCount = 0;
    const casings: NamingCasing[] = ['camelCase', 'kebab-case', 'PascalCase', 'snake_case'];
    for (const c of casings) {
      if (votes[c] > maxCount) {
        maxCount = votes[c];
        maxCasing = c;
      }
    }

    // If no clear winner and multiple styles detected, return mixed
    const totalVotes = casings.reduce((sum, c) => sum + votes[c], 0);
    if (totalVotes > 0 && maxCount < totalVotes * 0.6) {
      return 'mixed';
    }

    return maxCasing;
  }

  /**
   * Detect how color shades are named in a set of variable names.
   *
   * Looks for trailing numeric segments in color groups to identify
   * patterns like "blue/1" through "blue/10" vs "blue-50" through "blue-950".
   */
  protected detectShadeNaming(names: readonly string[], separator: NamingSeparator): ShadeNaming {
    // Extract trailing numeric segments from names
    const numericSuffixes: number[] = [];
    for (const name of names) {
      const parts = name.split(separator);
      const last = parts[parts.length - 1] ?? '';
      const num = Number(last);
      if (!isNaN(num) && last.length > 0) {
        numericSuffixes.push(num);
      }
    }

    if (numericSuffixes.length === 0) return 'semantic-names';

    const uniqueNums = Array.from(new Set(numericSuffixes)).sort((a, b) => a - b);
    const firstNum = uniqueNums[0] ?? 0;
    const lastNum = uniqueNums[uniqueNums.length - 1] ?? 0;

    // Check for 1-to-10 pattern (Ant Design style)
    if (uniqueNums.length >= 5 && firstNum === 1 && lastNum <= 13) {
      return 'numeric-1-to-10';
    }

    // Check for 50-to-950 pattern (Tailwind style)
    if (uniqueNums.length >= 5 && firstNum >= 50 && uniqueNums.every(n => n % 50 === 0)) {
      return 'numeric-50-to-950';
    }

    // Check for 100-to-900 pattern (Material style)
    if (uniqueNums.length >= 5 && firstNum >= 100 && uniqueNums.every(n => n % 100 === 0)) {
      return 'numeric-100-to-900';
    }

    return 'custom';
  }

  /**
   * Detect grouping strategy from variable name structure.
   * Analyzes first-level groups to determine organizational pattern.
   */
  protected detectGrouping(
    names: readonly string[],
    separator: NamingSeparator,
  ): GroupingStrategy {
    if (names.length === 0) return 'flat';

    // Extract first-level groups
    const firstLevelGroups = new Set<string>();
    let hasNestedNames = false;

    for (const name of names) {
      const parts = name.split(separator);
      if (parts.length > 1) {
        firstLevelGroups.add(parts[0] ?? '');
        hasNestedNames = true;
      }
    }

    if (!hasNestedNames) return 'flat';

    // Check if groups look like color names
    const colorWords = new Set([
      'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
      'cyan', 'teal', 'indigo', 'violet', 'amber', 'lime', 'emerald',
      'slate', 'gray', 'grey', 'zinc', 'neutral', 'stone', 'rose',
      'fuchsia', 'magenta', 'gold', 'geekblue', 'volcano', 'sunset',
    ]);

    const colorGroupCount = Array.from(firstLevelGroups)
      .filter(g => colorWords.has(g.toLowerCase()))
      .length;

    if (colorGroupCount > firstLevelGroups.size * 0.5) {
      return 'by-color-then-shade';
    }

    // Check if groups look like purposes (bg, text, border, shadow, etc.)
    const purposeWords = new Set([
      'bg', 'background', 'text', 'border', 'shadow', 'fill', 'stroke',
      'surface', 'overlay', 'primary', 'secondary', 'success', 'error',
      'warning', 'info', 'danger', 'accent', 'muted', 'foreground',
    ]);

    const purposeGroupCount = Array.from(firstLevelGroups)
      .filter(g => purposeWords.has(g.toLowerCase()))
      .length;

    if (purposeGroupCount > firstLevelGroups.size * 0.3) {
      return 'by-purpose';
    }

    // Check if groups look like component names
    const componentWords = new Set([
      'button', 'input', 'card', 'modal', 'table', 'menu', 'tab',
      'badge', 'alert', 'avatar', 'tooltip', 'dropdown', 'select',
      'checkbox', 'radio', 'switch', 'slider', 'progress', 'tag',
    ]);

    const componentGroupCount = Array.from(firstLevelGroups)
      .filter(g => componentWords.has(g.toLowerCase()))
      .length;

    if (componentGroupCount > firstLevelGroups.size * 0.3) {
      return 'by-component';
    }

    return 'mixed';
  }

  // ==========================================================================
  // SECTION 3: TIER CLASSIFICATION
  // ==========================================================================

  /**
   * Classify a collection's tier based on its name and characteristics.
   *
   * Uses name heuristics first, then falls back to structural analysis
   * (alias percentage, dependency position).
   */
  protected classifyTier(
    collectionName: string,
    aliasPercentage: number,
    dependsOnCount: number,
    dependedOnByCount: number,
  ): CollectionTier {
    const lower = collectionName.toLowerCase();

    // Name-based classification
    if (/\b(primitive|raw|base|palette|color[s]?)\b/.test(lower) && dependsOnCount === 0) {
      return 'primitive';
    }
    if (/\b(seed)\b/.test(lower)) {
      return 'seed';
    }
    if (/\b(map|mapped)\b/.test(lower)) {
      return 'mapped';
    }
    if (/\b(semantic|alias|theme)\b/.test(lower)) {
      return 'semantic';
    }
    if (/\b(component|comp|ui)\b/.test(lower)) {
      return 'component';
    }
    if (/\b(responsive|breakpoint|screen|viewport)\b/.test(lower)) {
      return 'responsive';
    }
    if (/\b(static)\b/.test(lower)) {
      // Static collections in Ant Design — treat as semantic
      return 'semantic';
    }

    // Structural classification fallback
    if (aliasPercentage < 10 && dependsOnCount === 0) {
      return 'primitive';
    }
    if (aliasPercentage > 80 && dependedOnByCount === 0) {
      return 'component';
    }
    if (aliasPercentage > 50 && dependedOnByCount > 0) {
      return 'semantic';
    }

    return 'unknown';
  }

  // ==========================================================================
  // SECTION 4: RESULT HELPERS
  // ==========================================================================

  /** Build a successful ExtractionResult. */
  protected success(
    fingerprint: StructuralFingerprint,
    warnings: readonly string[],
    durationMs: number,
  ): ExtractionResult {
    return {
      ok: true,
      fingerprint,
      warnings,
      durationMs,
    };
  }

  /** Build a failed ExtractionResult. */
  protected failure(error: string, durationMs: number): ExtractionResult {
    return {
      ok: false,
      error,
      warnings: [],
      durationMs,
    };
  }
}
