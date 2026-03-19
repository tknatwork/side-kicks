/**
 * Pattern Synthesizer — Compares multiple StructuralFingerprints to find
 * common architectural patterns across design systems.
 *
 * This is the "learn" step in the study → learn → generate pipeline.
 * It takes fingerprints from multiple sources (produced by extractors in the
 * "study" step) and identifies:
 *   - Universal patterns (shared by all sources)
 *   - Dominant conventions (most common approaches)
 *   - Divergences (where sources disagree — useful for user decisions)
 *
 * The output `PatternSynthesis` feeds into the "generate" step, where
 * DSB creates a custom design system applying learned patterns to the
 * user's specific configuration.
 *
 * @module core/learning/pattern-synthesizer
 */

import type {
  StructuralFingerprint,
  PatternSynthesis,
  NamingSeparator,
  CollectionTier,
} from './types';

// ============================================================================
// SECTION 1: PUBLIC API
// ============================================================================

/**
 * Synthesize patterns from multiple structural fingerprints.
 *
 * @param fingerprints - Two or more fingerprints to compare. A single
 *   fingerprint is accepted but produces less useful output (no cross-source
 *   comparison).
 * @returns PatternSynthesis summarizing common patterns and divergences.
 */
export function synthesizePatterns(
  fingerprints: readonly StructuralFingerprint[],
): PatternSynthesis {
  if (fingerprints.length === 0) {
    return emptySynthesis();
  }

  if (fingerprints.length === 1) {
    return singleSourceSynthesis(fingerprints[0] as StructuralFingerprint);
  }

  return multiSourceSynthesis(fingerprints);
}

// ============================================================================
// SECTION 2: SINGLE-SOURCE SYNTHESIS
// ============================================================================

/**
 * When only one fingerprint is available, report its structure as-is.
 * No cross-source comparison is possible, but we still normalize into
 * PatternSynthesis format for downstream consistency.
 */
function singleSourceSynthesis(fp: StructuralFingerprint): PatternSynthesis {
  const uniqueTiers = countUniqueTiers(fp);

  return {
    sourceCount: 1,
    sourceNames: [fp.source.name],
    tierCountRange: [uniqueTiers, uniqueTiers],
    dominantShadeCount: fp.scalePatterns.colorShades,
    dominantSeparator: fp.namingConventions.separator,
    crossCollectionAliasesUniversal: fp.aliasTopology.crossCollectionAliases,
    aliasDepthRange: [fp.aliasTopology.maxDepth, fp.aliasTopology.maxDepth],
    commonPatterns: describeSingleSource(fp),
    divergences: [],
    synthesizedAt: new Date().toISOString(),
  };
}

/**
 * Build human-readable pattern descriptions from a single fingerprint.
 */
function describeSingleSource(fp: StructuralFingerprint): string[] {
  const patterns: string[] = [];

  // Collection structure
  const tiers = fp.collections.map(c => c.tier).filter(t => t !== 'unknown');
  if (tiers.length > 0) {
    patterns.push(`${tiers.length} collection tiers: ${[...new Set(tiers)].join(', ')}`);
  }

  // Naming
  patterns.push(
    `Naming: ${fp.namingConventions.separator}-separated, ` +
    `${fp.namingConventions.casing} casing, ` +
    `${fp.namingConventions.grouping} grouping`,
  );

  // Alias depth
  if (fp.aliasTopology.maxDepth > 0) {
    patterns.push(
      `Alias chains up to ${fp.aliasTopology.maxDepth} deep, ` +
      `${fp.aliasTopology.aliasPercentage.toFixed(0)}% of variables are aliases`,
    );
  }

  // Color scale
  if (fp.scalePatterns.colorShades > 0) {
    patterns.push(
      `${fp.scalePatterns.colorShades}-step color shades across ` +
      `${fp.scalePatterns.colorPalettes.length} palettes`,
    );
  }

  // Shade naming
  if (fp.namingConventions.shadeNaming !== 'custom') {
    patterns.push(`Shade naming: ${fp.namingConventions.shadeNaming}`);
  }

  // Style strategy
  const totalStyles =
    fp.styleStrategy.colorStyleCount +
    fp.styleStrategy.textStyleCount +
    fp.styleStrategy.effectStyleCount +
    fp.styleStrategy.gridStyleCount;

  if (totalStyles > 0) {
    patterns.push(
      `${totalStyles} styles (${fp.styleStrategy.colorStyleCount} color, ` +
      `${fp.styleStrategy.textStyleCount} text, ` +
      `${fp.styleStrategy.effectStyleCount} effect, ` +
      `${fp.styleStrategy.gridStyleCount} grid)`,
    );
  }

  if (fp.styleStrategy.stylesBindToVariables) {
    patterns.push('Styles bind to variables (modern Figma pattern)');
  }

  // Breakpoints
  if (fp.scalePatterns.breakpointCount > 0) {
    patterns.push(
      `${fp.scalePatterns.breakpointCount} responsive breakpoints: ` +
      fp.scalePatterns.breakpointNames.join(', '),
    );
  }

  return patterns;
}

// ============================================================================
// SECTION 3: MULTI-SOURCE SYNTHESIS
// ============================================================================

/**
 * Compare two or more fingerprints, identifying shared patterns
 * and divergences across sources.
 */
function multiSourceSynthesis(
  fingerprints: readonly StructuralFingerprint[],
): PatternSynthesis {
  const sourceNames = fingerprints.map(fp => fp.source.name);

  // Tier count range
  const tierCounts = fingerprints.map(countUniqueTiers);
  const minTiers = Math.min(...tierCounts);
  const maxTiers = Math.max(...tierCounts);

  // Dominant shade count (mode)
  const shadeCounts = fingerprints.map(fp => fp.scalePatterns.colorShades);
  const dominantShadeCount = mode(shadeCounts);

  // Dominant separator (mode)
  const separators = fingerprints.map(fp => fp.namingConventions.separator);
  const dominantSeparator = mode(separators);

  // Cross-collection aliases — universal if ALL sources use them
  const crossCollectionAliasesUniversal = fingerprints.every(
    fp => fp.aliasTopology.crossCollectionAliases,
  );

  // Alias depth range
  const maxDepths = fingerprints.map(fp => fp.aliasTopology.maxDepth);
  const minDepth = Math.min(...maxDepths);
  const maxDepth = Math.max(...maxDepths);

  // Common patterns + divergences
  const commonPatterns = findCommonPatterns(fingerprints);
  const divergences = findDivergences(fingerprints);

  return {
    sourceCount: fingerprints.length,
    sourceNames,
    tierCountRange: [minTiers, maxTiers],
    dominantShadeCount,
    dominantSeparator,
    crossCollectionAliasesUniversal,
    aliasDepthRange: [minDepth, maxDepth],
    commonPatterns,
    divergences,
    synthesizedAt: new Date().toISOString(),
  };
}

// ============================================================================
// SECTION 4: COMMON PATTERN DETECTION
// ============================================================================

/**
 * Identify architectural patterns shared by all (or most) sources.
 */
function findCommonPatterns(
  fingerprints: readonly StructuralFingerprint[],
): string[] {
  const patterns: string[] = [];
  const count = fingerprints.length;

  // Check if all sources use the same separator
  const separators = new Set(fingerprints.map(fp => fp.namingConventions.separator));
  if (separators.size === 1) {
    const sep = fingerprints[0] as StructuralFingerprint;
    patterns.push(`All sources use "${sep.namingConventions.separator}" as naming separator`);
  }

  // Check if all sources use cross-collection aliases
  const allCrossAlias = fingerprints.every(fp => fp.aliasTopology.crossCollectionAliases);
  if (allCrossAlias) {
    patterns.push('All sources use cross-collection alias chains');
  }

  // Check if all sources bind styles to variables
  const allStyleBind = fingerprints.every(fp => fp.styleStrategy.stylesBindToVariables);
  if (allStyleBind) {
    patterns.push('All sources bind styles to variables');
  }

  // Check for shared tier types
  const tierSets = fingerprints.map(fp =>
    new Set(fp.collections.map(c => c.tier).filter(t => t !== 'unknown')),
  );
  const sharedTiers = intersectSets(tierSets);
  if (sharedTiers.size > 0) {
    patterns.push(`Shared collection tiers: ${Array.from(sharedTiers).join(', ')}`);
  }

  // Check for consistent shade count
  const shadeCounts = new Set(fingerprints.map(fp => fp.scalePatterns.colorShades));
  if (shadeCounts.size === 1) {
    const shades = fingerprints[0] as StructuralFingerprint;
    patterns.push(`All sources use ${shades.scalePatterns.colorShades}-step color shades`);
  }

  // Check for consistent shade naming
  const shadeNamings = new Set(fingerprints.map(fp => fp.namingConventions.shadeNaming));
  if (shadeNamings.size === 1) {
    const naming = fingerprints[0] as StructuralFingerprint;
    patterns.push(`All sources use ${naming.namingConventions.shadeNaming} shade naming`);
  }

  // Check for consistent casing
  const casings = new Set(fingerprints.map(fp => fp.namingConventions.casing));
  if (casings.size === 1) {
    const casing = fingerprints[0] as StructuralFingerprint;
    patterns.push(`All sources use ${casing.namingConventions.casing} casing`);
  }

  // Check for consistent grouping
  const groupings = new Set(fingerprints.map(fp => fp.namingConventions.grouping));
  if (groupings.size === 1) {
    const grouping = fingerprints[0] as StructuralFingerprint;
    patterns.push(`All sources use "${grouping.namingConventions.grouping}" grouping strategy`);
  }

  // Alias percentage range
  const aliasPercentages = fingerprints.map(fp => fp.aliasTopology.aliasPercentage);
  const minAlias = Math.min(...aliasPercentages);
  const maxAlias = Math.max(...aliasPercentages);
  if (minAlias > 30) {
    patterns.push(
      `High alias usage across all sources (${minAlias.toFixed(0)}%–${maxAlias.toFixed(0)}% aliased)`,
    );
  }

  // Average tier count pattern
  const tierCounts = fingerprints.map(countUniqueTiers);
  const avgTiers = tierCounts.reduce((s, t) => s + t, 0) / count;
  if (avgTiers >= 3) {
    patterns.push(`Multi-tier architecture (avg ${avgTiers.toFixed(1)} tiers per source)`);
  }

  return patterns;
}

// ============================================================================
// SECTION 5: DIVERGENCE DETECTION
// ============================================================================

/**
 * Identify points where source systems differ — these are decision points
 * the user (or DSB defaults) must resolve during generation.
 */
function findDivergences(
  fingerprints: readonly StructuralFingerprint[],
): string[] {
  const divergences: string[] = [];

  // Separator disagreement
  const separators = new Set(fingerprints.map(fp => fp.namingConventions.separator));
  if (separators.size > 1) {
    const examples = fingerprints.map(
      fp => `${fp.source.name}: "${fp.namingConventions.separator}"`,
    );
    divergences.push(`Naming separator varies — ${examples.join(', ')}`);
  }

  // Shade count disagreement
  const shadeCounts = new Set(fingerprints.map(fp => fp.scalePatterns.colorShades));
  if (shadeCounts.size > 1) {
    const examples = fingerprints.map(
      fp => `${fp.source.name}: ${fp.scalePatterns.colorShades} shades`,
    );
    divergences.push(`Color shade count varies — ${examples.join(', ')}`);
  }

  // Shade naming disagreement
  const shadeNamings = new Set(fingerprints.map(fp => fp.namingConventions.shadeNaming));
  if (shadeNamings.size > 1) {
    const examples = fingerprints.map(
      fp => `${fp.source.name}: ${fp.namingConventions.shadeNaming}`,
    );
    divergences.push(`Shade naming convention varies — ${examples.join(', ')}`);
  }

  // Casing disagreement
  const casings = new Set(fingerprints.map(fp => fp.namingConventions.casing));
  if (casings.size > 1) {
    const examples = fingerprints.map(
      fp => `${fp.source.name}: ${fp.namingConventions.casing}`,
    );
    divergences.push(`Casing convention varies — ${examples.join(', ')}`);
  }

  // Grouping disagreement
  const groupings = new Set(fingerprints.map(fp => fp.namingConventions.grouping));
  if (groupings.size > 1) {
    const examples = fingerprints.map(
      fp => `${fp.source.name}: ${fp.namingConventions.grouping}`,
    );
    divergences.push(`Grouping strategy varies — ${examples.join(', ')}`);
  }

  // Alias depth disagreement (>2x difference)
  const depths = fingerprints.map(fp => fp.aliasTopology.maxDepth);
  const minD = Math.min(...depths);
  const maxD = Math.max(...depths);
  if (maxD > 0 && minD > 0 && maxD / minD > 2) {
    const examples = fingerprints.map(
      fp => `${fp.source.name}: ${fp.aliasTopology.maxDepth} deep`,
    );
    divergences.push(`Alias chain depth varies significantly — ${examples.join(', ')}`);
  }

  // Tier count disagreement
  const tierCounts = fingerprints.map(countUniqueTiers);
  const minT = Math.min(...tierCounts);
  const maxT = Math.max(...tierCounts);
  if (maxT - minT > 1) {
    const examples = fingerprints.map(
      fp => `${fp.source.name}: ${countUniqueTiers(fp)} tiers`,
    );
    divergences.push(`Tier count varies — ${examples.join(', ')}`);
  }

  // Style binding disagreement
  const bindings = new Set(fingerprints.map(fp => fp.styleStrategy.stylesBindToVariables));
  if (bindings.size > 1) {
    const bound = fingerprints.filter(fp => fp.styleStrategy.stylesBindToVariables).map(fp => fp.source.name);
    const unbound = fingerprints.filter(fp => !fp.styleStrategy.stylesBindToVariables).map(fp => fp.source.name);
    divergences.push(
      `Style-variable binding: bound (${bound.join(', ')}) vs unbound (${unbound.join(', ')})`,
    );
  }

  // Cross-collection alias disagreement
  const crossAlias = new Set(fingerprints.map(fp => fp.aliasTopology.crossCollectionAliases));
  if (crossAlias.size > 1) {
    const withCross = fingerprints.filter(fp => fp.aliasTopology.crossCollectionAliases).map(fp => fp.source.name);
    const withoutCross = fingerprints.filter(fp => !fp.aliasTopology.crossCollectionAliases).map(fp => fp.source.name);
    divergences.push(
      `Cross-collection aliases: yes (${withCross.join(', ')}) vs no (${withoutCross.join(', ')})`,
    );
  }

  return divergences;
}

// ============================================================================
// SECTION 6: UTILITY FUNCTIONS
// ============================================================================

/** Count unique non-unknown tiers in a fingerprint. */
function countUniqueTiers(fp: StructuralFingerprint): number {
  const tiers = new Set(fp.collections.map(c => c.tier).filter(t => t !== 'unknown'));
  return tiers.size;
}

/** Statistical mode — most frequent value in an array. */
function mode<T>(values: readonly T[]): T {
  const freq = new Map<T, number>();
  for (const v of values) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }

  let best: T = values[0] as T;
  let bestCount = 0;
  for (const [val, count] of freq.entries()) {
    if (count > bestCount) {
      bestCount = count;
      best = val;
    }
  }
  return best;
}

/** Intersect multiple sets — returns elements present in ALL sets. */
function intersectSets<T>(sets: readonly Set<T>[]): Set<T> {
  if (sets.length === 0) return new Set();
  const first = sets[0] as Set<T>;
  const result = new Set(first);
  for (let i = 1; i < sets.length; i++) {
    const current = sets[i] as Set<T>;
    for (const item of result) {
      if (!current.has(item)) {
        result.delete(item);
      }
    }
  }
  return result;
}

/** Produce an empty synthesis (no sources). */
function emptySynthesis(): PatternSynthesis {
  return {
    sourceCount: 0,
    sourceNames: [],
    tierCountRange: [0, 0],
    dominantShadeCount: 0,
    dominantSeparator: '/',
    crossCollectionAliasesUniversal: false,
    aliasDepthRange: [0, 0],
    commonPatterns: [],
    divergences: [],
    synthesizedAt: new Date().toISOString(),
  };
}
