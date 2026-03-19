/**
 * Tests for DtcgTokenExtractor — W3C DTCG JSON format extraction.
 *
 * Tests cover:
 *   - Basic token parsing from nested DTCG objects
 *   - $type inheritance from parent groups
 *   - Reference (alias) detection via {path} syntax
 *   - Virtual collection grouping by top-level keys
 *   - Tier classification heuristics
 *   - Scale pattern detection (color palettes, spacing)
 *   - Edge cases (empty input, invalid input, single tokens)
 */

import { describe, it, expect } from 'vitest';
import { DtcgTokenExtractor } from '../../src/learning/extractors/dtcg-token-extractor';
import type { ExtractorConfig } from '../../src/learning/types';

// ============================================================================
// SECTION 1: TEST FIXTURES
// ============================================================================

/** Minimal valid DTCG document with one color token. */
function minimalDtcg(): Record<string, unknown> {
  return {
    color: {
      primary: {
        $type: 'color',
        $value: '#3B82F6',
        $description: 'Primary brand color',
      },
    },
  };
}

/** DTCG doc with group-level $type inheritance. */
function inheritedTypeDtcg(): Record<string, unknown> {
  return {
    color: {
      $type: 'color',
      primary: {
        '500': { $value: '#3B82F6' },
        '600': { $value: '#2563EB' },
        '700': { $value: '#1D4ED8' },
      },
      secondary: {
        '500': { $value: '#8B5CF6' },
        '600': { $value: '#7C3AED' },
      },
    },
  };
}

/** DTCG doc with alias references. */
function aliasedDtcg(): Record<string, unknown> {
  return {
    primitives: {
      color: {
        $type: 'color',
        blue: {
          '500': { $value: '#3B82F6' },
          '600': { $value: '#2563EB' },
        },
      },
    },
    semantic: {
      bg: {
        primary: {
          $type: 'color',
          $value: '{primitives.color.blue.500}',
        },
      },
      text: {
        primary: {
          $type: 'color',
          $value: '{primitives.color.blue.600}',
        },
      },
    },
  };
}

/** Realistic multi-tier DTCG document. */
function multiTierDtcg(): Record<string, unknown> {
  return {
    color: {
      $type: 'color',
      blue: {
        '50': { $value: '#EFF6FF' },
        '100': { $value: '#DBEAFE' },
        '200': { $value: '#BFDBFE' },
        '300': { $value: '#93C5FD' },
        '400': { $value: '#60A5FA' },
        '500': { $value: '#3B82F6' },
        '600': { $value: '#2563EB' },
        '700': { $value: '#1D4ED8' },
        '800': { $value: '#1E40AF' },
        '900': { $value: '#1E3A8A' },
        '950': { $value: '#172554' },
      },
      red: {
        '50': { $value: '#FEF2F2' },
        '100': { $value: '#FEE2E2' },
        '200': { $value: '#FECACA' },
        '300': { $value: '#FCA5A5' },
        '400': { $value: '#F87171' },
        '500': { $value: '#EF4444' },
        '600': { $value: '#DC2626' },
        '700': { $value: '#B91C1C' },
        '800': { $value: '#991B1B' },
        '900': { $value: '#7F1D1D' },
        '950': { $value: '#450A0A' },
      },
    },
    spacing: {
      $type: 'dimension',
      '1': { $value: { value: 4, unit: 'px' } },
      '2': { $value: { value: 8, unit: 'px' } },
      '3': { $value: { value: 12, unit: 'px' } },
      '4': { $value: { value: 16, unit: 'px' } },
      '6': { $value: { value: 24, unit: 'px' } },
      '8': { $value: { value: 32, unit: 'px' } },
    },
    semantic: {
      bg: {
        primary: {
          $type: 'color',
          $value: '{color.blue.500}',
        },
        danger: {
          $type: 'color',
          $value: '{color.red.500}',
        },
      },
      text: {
        primary: {
          $type: 'color',
          $value: '{color.blue.900}',
        },
      },
    },
  };
}

const DEFAULT_CONFIG: ExtractorConfig = {
  sourceName: 'Test DTCG',
  formatHint: 'dtcg-json',
};

// ============================================================================
// SECTION 2: BASIC EXTRACTION TESTS
// ============================================================================

describe('DtcgTokenExtractor', () => {
  const extractor = new DtcgTokenExtractor();

  describe('extract — basic functionality', () => {
    it('extracts tokens from a minimal DTCG document', () => {
      const result = extractor.extract(minimalDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      expect(result.fingerprint).toBeDefined();
      expect(result.fingerprint!.source.sourceFormat).toBe('dtcg-json');
      expect(result.fingerprint!.source.totalVariables).toBe(1);
    });

    it('extracts multiple tokens with inherited $type', () => {
      const result = extractor.extract(inheritedTypeDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      expect(result.fingerprint).toBeDefined();
      // 3 primary shades + 2 secondary shades = 5 tokens
      expect(result.fingerprint!.source.totalVariables).toBe(5);
    });

    it('detects alias references correctly', () => {
      const result = extractor.extract(aliasedDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      const fp = result.fingerprint!;

      // Should have 4 tokens total (2 primitives + 2 semantic)
      expect(fp.source.totalVariables).toBe(4);

      // Alias topology should detect the 2 references
      expect(fp.aliasTopology.aliasPercentage).toBe(50); // 2 out of 4
      expect(fp.aliasTopology.crossCollectionAliases).toBe(true);
    });

    it('creates virtual collections from top-level groups', () => {
      const result = extractor.extract(aliasedDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      const collections = result.fingerprint!.collections;

      // Should have 2 virtual collections: primitives, semantic
      expect(collections.length).toBe(2);
      const names = collections.map(c => c.name).sort();
      expect(names).toEqual(['primitives', 'semantic']);
    });

    it('records timing information', () => {
      const result = extractor.extract(minimalDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // SECTION 3: TIER CLASSIFICATION TESTS
  // ==========================================================================

  describe('tier classification', () => {
    it('classifies primitives collection by name', () => {
      const result = extractor.extract(aliasedDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      const primColl = result.fingerprint!.collections.find(c => c.name === 'primitives');
      expect(primColl).toBeDefined();
      expect(primColl!.tier).toBe('primitive');
    });

    it('classifies semantic collection by name', () => {
      const result = extractor.extract(aliasedDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      const semColl = result.fingerprint!.collections.find(c => c.name === 'semantic');
      expect(semColl).toBeDefined();
      expect(semColl!.tier).toBe('semantic');
    });

    it('classifies raw-value groups as primitive', () => {
      const result = extractor.extract(multiTierDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      const colorColl = result.fingerprint!.collections.find(c => c.name === 'color');
      expect(colorColl).toBeDefined();
      // color has no aliases and is depended on by semantic → primitive
      expect(colorColl!.tier).toBe('primitive');
    });
  });

  // ==========================================================================
  // SECTION 4: SCALE PATTERN TESTS
  // ==========================================================================

  describe('scale patterns', () => {
    it('detects color palettes', () => {
      const result = extractor.extract(multiTierDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      const scales = result.fingerprint!.scalePatterns;
      expect(scales.colorPalettes.length).toBeGreaterThanOrEqual(2);
      expect(scales.colorPalettes).toContain('blue');
      expect(scales.colorPalettes).toContain('red');
    });

    it('detects color shade count', () => {
      const result = extractor.extract(multiTierDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      const scales = result.fingerprint!.scalePatterns;
      // Both blue and red have 11 shades
      expect(scales.colorShades).toBe(11);
    });

    it('detects spacing multiplier pattern', () => {
      const result = extractor.extract(multiTierDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      const scales = result.fingerprint!.scalePatterns;
      // spacing values: 4, 8, 12, 16, 24, 32 → multipliers: 1, 2, 3, 4, 6, 8
      expect(scales.spacingMultipliers.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SECTION 5: NAMING CONVENTION TESTS
  // ==========================================================================

  describe('naming conventions', () => {
    it('detects dot separator for DTCG paths', () => {
      const result = extractor.extract(multiTierDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      // DTCG uses dots natively
      expect(result.fingerprint!.namingConventions.separator).toBe('.');
    });

    it('provides example token names', () => {
      const result = extractor.extract(multiTierDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.namingConventions.examples.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SECTION 6: ALIAS TOPOLOGY TESTS
  // ==========================================================================

  describe('alias topology', () => {
    it('detects cross-collection aliases', () => {
      const result = extractor.extract(multiTierDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.aliasTopology.crossCollectionAliases).toBe(true);
    });

    it('computes alias chain depth', () => {
      const result = extractor.extract(aliasedDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      // Single-level aliases → depth 1
      expect(result.fingerprint!.aliasTopology.maxDepth).toBe(1);
    });

    it('reports zero circular references in valid data', () => {
      const result = extractor.extract(multiTierDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.aliasTopology.circularCount).toBe(0);
    });
  });

  // ==========================================================================
  // SECTION 7: STYLE STRATEGY TESTS
  // ==========================================================================

  describe('style strategy', () => {
    it('reports zero styles (DTCG has no style concept)', () => {
      const result = extractor.extract(minimalDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      const styles = result.fingerprint!.styleStrategy;
      expect(styles.colorStyleCount).toBe(0);
      expect(styles.textStyleCount).toBe(0);
      expect(styles.effectStyleCount).toBe(0);
      expect(styles.gridStyleCount).toBe(0);
    });
  });

  // ==========================================================================
  // SECTION 8: METADATA TESTS
  // ==========================================================================

  describe('source metadata', () => {
    it('uses config source name', () => {
      const config: ExtractorConfig = {
        sourceName: 'My Design Tokens',
        formatHint: 'dtcg-json',
      };
      const result = extractor.extract(minimalDtcg(), config);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.source.name).toBe('My Design Tokens');
    });

    it('records extraction timestamp', () => {
      const result = extractor.extract(minimalDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      const ts = result.fingerprint!.source.extractedAt;
      expect(new Date(ts).getTime()).not.toBeNaN();
    });

    it('DTCG has zero pages and zero styles', () => {
      const result = extractor.extract(multiTierDtcg(), DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.source.totalPages).toBe(0);
      expect(result.fingerprint!.source.totalStyles).toBe(0);
    });
  });

  // ==========================================================================
  // SECTION 9: ERROR HANDLING TESTS
  // ==========================================================================

  describe('error handling', () => {
    it('rejects non-object input', () => {
      const result = extractor.extract('not an object', DEFAULT_CONFIG);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid input');
    });

    it('rejects array input', () => {
      const result = extractor.extract([], DEFAULT_CONFIG);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid input');
    });

    it('rejects null input', () => {
      const result = extractor.extract(null, DEFAULT_CONFIG);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid input');
    });

    it('fails gracefully on empty object (no tokens)', () => {
      const result = extractor.extract({}, DEFAULT_CONFIG);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('No DTCG tokens found');
    });

    it('warns on tokens without $type when no inheritance', () => {
      const doc = {
        group: {
          token: { $value: '#fff' }, // no $type, no inherited type
        },
      };
      const result = extractor.extract(doc, DEFAULT_CONFIG);
      // Should either fail or have warnings
      if (result.ok) {
        expect(result.warnings.length).toBeGreaterThan(0);
      } else {
        // If it fails, the error should mention no tokens found
        expect(result.error).toContain('No DTCG tokens found');
      }
    });
  });

  // ==========================================================================
  // SECTION 10: $TYPE INHERITANCE TESTS
  // ==========================================================================

  describe('$type inheritance', () => {
    it('inherits $type from parent group', () => {
      const doc = {
        spacing: {
          $type: 'dimension',
          sm: { $value: { value: 4, unit: 'px' } },
          md: { $value: { value: 8, unit: 'px' } },
          lg: { $value: { value: 16, unit: 'px' } },
        },
      };

      const result = extractor.extract(doc, DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.source.totalVariables).toBe(3);
    });

    it('overrides inherited $type at leaf level', () => {
      const doc = {
        tokens: {
          $type: 'color',
          primary: { $value: '#3B82F6' }, // inherits color
          weight: { $type: 'fontWeight', $value: 700 }, // overrides
        },
      };

      const result = extractor.extract(doc, DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.source.totalVariables).toBe(2);
    });

    it('handles deeply nested $type inheritance', () => {
      const doc = {
        design: {
          $type: 'color',
          palette: {
            primary: {
              light: { $value: '#DBEAFE' },
              dark: { $value: '#1E3A8A' },
            },
          },
        },
      };

      const result = extractor.extract(doc, DEFAULT_CONFIG);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.source.totalVariables).toBe(2);
    });
  });
});
