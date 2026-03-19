/**
 * Tests for FigmaTokenExtractor — Figma Variables & Styles Extractor JSON format.
 *
 * Tests cover:
 *   - Basic extraction from single-collection Figma JSON
 *   - Multi-collection parsing with cross-collection aliases
 *   - Mode detection (Light/Dark)
 *   - Variable type distribution (color, float, string)
 *   - Tier classification heuristics (primitive vs semantic vs component)
 *   - Naming convention detection (separator, casing, grouping)
 *   - Alias topology (depth, cross-collection, circular)
 *   - Scale pattern detection (palettes, shade counts)
 *   - Style strategy analysis (_styles entry)
 *   - Error handling (invalid input types, empty arrays)
 */

import { describe, it, expect } from 'vitest';
import { FigmaTokenExtractor } from '../../src/learning/extractors/figma-token-extractor';
import type { ExtractorConfig } from '../../src/learning/types';

// ============================================================================
// SECTION 1: TEST FIXTURES
// ============================================================================

/** Minimal valid Figma extractor JSON — single collection, single mode, two vars. */
function minimalFigma(): unknown[] {
  return [
    {
      Primitives: {
        modes: {
          Value: {
            color: {
              blue: {
                '500': {
                  $value: '#3B82F6',
                  $type: 'color',
                  $scopes: ['ALL_FILLS'],
                },
              },
            },
            spacing: {
              base: {
                $value: 8,
                $type: 'float',
                $scopes: ['GAP'],
              },
            },
          },
        },
      },
    },
  ];
}

/** Three-tier Figma JSON with aliases between collections. */
function threeTierFigma(): unknown[] {
  return [
    {
      Primitives: {
        modes: {
          Value: {
            color: {
              blue: {
                '500': { $value: '#3B82F6', $type: 'color', $scopes: ['ALL_FILLS'] },
                '600': { $value: '#2563EB', $type: 'color', $scopes: ['ALL_FILLS'] },
                '700': { $value: '#1D4ED8', $type: 'color', $scopes: ['ALL_FILLS'] },
              },
              red: {
                '500': { $value: '#EF4444', $type: 'color', $scopes: ['ALL_FILLS'] },
                '600': { $value: '#DC2626', $type: 'color', $scopes: ['ALL_FILLS'] },
              },
            },
            spacing: {
              '1': { $value: 4, $type: 'float', $scopes: ['GAP'] },
              '2': { $value: 8, $type: 'float', $scopes: ['GAP'] },
              '3': { $value: 12, $type: 'float', $scopes: ['GAP'] },
              '4': { $value: 16, $type: 'float', $scopes: ['GAP'] },
            },
          },
        },
      },
    },
    {
      Semantic: {
        modes: {
          Light: {
            bg: {
              primary: {
                $value: '{color.blue.500}',
                $type: 'color',
                $scopes: ['FRAME_FILL'],
                $collectionName: 'Primitives',
              },
              danger: {
                $value: '{color.red.500}',
                $type: 'color',
                $scopes: ['FRAME_FILL'],
                $collectionName: 'Primitives',
              },
            },
            text: {
              primary: {
                $value: '{color.blue.700}',
                $type: 'color',
                $scopes: ['TEXT_FILL'],
                $collectionName: 'Primitives',
              },
            },
          },
          Dark: {
            bg: {
              primary: {
                $value: '{color.blue.700}',
                $type: 'color',
                $scopes: ['FRAME_FILL'],
                $collectionName: 'Primitives',
              },
              danger: {
                $value: '{color.red.600}',
                $type: 'color',
                $scopes: ['FRAME_FILL'],
                $collectionName: 'Primitives',
              },
            },
            text: {
              primary: {
                $value: '{color.blue.500}',
                $type: 'color',
                $scopes: ['TEXT_FILL'],
                $collectionName: 'Primitives',
              },
            },
          },
        },
      },
    },
    {
      Component: {
        modes: {
          Light: {
            button: {
              bg: {
                default: {
                  $value: '{bg.primary}',
                  $type: 'color',
                  $scopes: ['ALL_FILLS'],
                  $collectionName: 'Semantic',
                },
              },
              text: {
                default: {
                  $value: '{text.primary}',
                  $type: 'color',
                  $scopes: ['TEXT_FILL'],
                  $collectionName: 'Semantic',
                },
              },
            },
          },
          Dark: {
            button: {
              bg: {
                default: {
                  $value: '{bg.primary}',
                  $type: 'color',
                  $scopes: ['ALL_FILLS'],
                  $collectionName: 'Semantic',
                },
              },
              text: {
                default: {
                  $value: '{text.primary}',
                  $type: 'color',
                  $scopes: ['TEXT_FILL'],
                  $collectionName: 'Semantic',
                },
              },
            },
          },
        },
      },
    },
  ];
}

/** Figma JSON with _styles entry. */
function figmaWithStyles(): unknown[] {
  return [
    {
      Primitives: {
        modes: {
          Value: {
            color: {
              primary: { $value: '#6366F1', $type: 'color', $scopes: ['ALL_FILLS'] },
            },
          },
        },
      },
    },
    {
      _styles: {
        colorStyles: [
          { name: 'Primary/500', type: 'PAINT', boundVariables: true },
          { name: 'Primary/600', type: 'PAINT' },
        ],
        textStyles: [
          { name: 'Heading/H1', type: 'TEXT' },
          { name: 'Heading/H2', type: 'TEXT' },
          { name: 'Body/Regular', type: 'TEXT' },
        ],
        effectStyles: [
          { name: 'Shadow/sm', type: 'EFFECT' },
        ],
        gridStyles: [],
      },
    },
  ];
}

// ============================================================================
// SECTION 2: BASIC EXTRACTION TESTS
// ============================================================================

describe('FigmaTokenExtractor', () => {
  const config: ExtractorConfig = {
    sourceName: 'Test Figma',
    formatHint: 'figma-extractor-json',
  };

  describe('basic extraction', () => {
    it('should extract a minimal Figma JSON with one collection', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(minimalFigma());

      expect(result.ok).toBe(true);
      expect(result.fingerprint).toBeDefined();

      const fp = result.fingerprint!;
      expect(fp.collections).toHaveLength(1);
      expect(fp.collections[0]!.name).toBe('Primitives');
      expect(fp.collections[0]!.variableCount).toBe(2); // color/blue/500 + spacing/base
      expect(fp.source.totalVariables).toBe(2);
      expect(fp.source.sourceFormat).toBe('figma-extractor-json');
    });

    it('should detect modes from collection data', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(minimalFigma());

      expect(result.ok).toBe(true);
      const fp = result.fingerprint!;
      expect(fp.collections[0]!.modes).toContain('Value');
    });

    it('should detect variable types correctly', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(minimalFigma());

      expect(result.ok).toBe(true);
      const fp = result.fingerprint!;
      const types = fp.collections[0]!.typeDistribution;
      expect(types['color']).toBe(1);
      expect(types['float']).toBe(1);
    });
  });

  // ============================================================================
  // SECTION 3: MULTI-COLLECTION + TIER CLASSIFICATION
  // ============================================================================

  describe('multi-collection and tier classification', () => {
    it('should parse three collections from three-tier input', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      expect(result.ok).toBe(true);
      const fp = result.fingerprint!;
      expect(fp.collections).toHaveLength(3);

      const names = fp.collections.map(c => c.name);
      expect(names).toContain('Primitives');
      expect(names).toContain('Semantic');
      expect(names).toContain('Component');
    });

    it('should classify Primitives as primitive tier (no aliases)', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      const primitives = fp.collections.find(c => c.name === 'Primitives');
      expect(primitives).toBeDefined();
      expect(primitives!.tier).toBe('primitive');
    });

    it('should classify Semantic as semantic or mapped tier (high alias ratio, depends on Primitives)', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      const semantic = fp.collections.find(c => c.name === 'Semantic');
      expect(semantic).toBeDefined();
      expect(['semantic', 'mapped']).toContain(semantic!.tier);
      expect(semantic!.dependsOn).toContain('Primitives');
    });

    it('should classify Component as component tier (all aliases, depends on Semantic)', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      const component = fp.collections.find(c => c.name === 'Component');
      expect(component).toBeDefined();
      expect(['component', 'mapped']).toContain(component!.tier);
      expect(component!.dependsOn).toContain('Semantic');
    });

    it('should detect Light and Dark modes in Semantic collection', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      const semantic = fp.collections.find(c => c.name === 'Semantic');
      expect(semantic!.modes).toContain('Light');
      expect(semantic!.modes).toContain('Dark');
    });

    it('should count unique variables (deduped across modes)', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      // Semantic has bg/primary, bg/danger, text/primary = 3 unique vars (in both Light and Dark)
      const semantic = fp.collections.find(c => c.name === 'Semantic');
      expect(semantic!.variableCount).toBe(3);
    });
  });

  // ============================================================================
  // SECTION 4: ALIAS TOPOLOGY
  // ============================================================================

  describe('alias topology', () => {
    it('should detect cross-collection aliases', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      expect(fp.aliasTopology.crossCollectionAliases).toBe(true);
    });

    it('should calculate alias depth >= 1 (Semantic → Primitives)', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      expect(fp.aliasTopology.maxDepth).toBeGreaterThanOrEqual(1);
    });

    it('should have alias percentage > 0 (there are aliases in Semantic+Component)', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      expect(fp.aliasTopology.aliasPercentage).toBeGreaterThan(0);
    });

    it('should report zero circular aliases in well-formed input', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      expect(fp.aliasTopology.circularCount).toBe(0);
    });

    it('should build a typical chain across tiers', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      // typicalChain should contain Primitives first (primitive), then Semantic, then Component
      expect(fp.aliasTopology.typicalChain.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // SECTION 5: NAMING CONVENTIONS
  // ============================================================================

  describe('naming conventions', () => {
    it('should detect / as the separator (Figma native paths)', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      expect(fp.namingConventions.separator).toBe('/');
    });

    it('should provide example variable names', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      expect(fp.namingConventions.examples.length).toBeGreaterThan(0);
    });

    it('should detect grouping strategy', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      expect(fp.namingConventions.grouping).toBeDefined();
    });
  });

  // ============================================================================
  // SECTION 6: SCALE PATTERNS
  // ============================================================================

  describe('scale patterns', () => {
    it('should detect color palettes from primitive collections', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      // Primitives has color/blue and color/red groups
      expect(fp.scalePatterns.colorPalettes.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect shade counts per palette', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      // blue has 3 shades (500, 600, 700), red has 2 shades
      expect(fp.scalePatterns.colorShades).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // SECTION 7: STYLE STRATEGY
  // ============================================================================

  describe('style strategy', () => {
    it('should parse _styles entry with style counts', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(figmaWithStyles());

      expect(result.ok).toBe(true);
      const fp = result.fingerprint!;
      expect(fp.styleStrategy.colorStyleCount).toBe(2);
      expect(fp.styleStrategy.textStyleCount).toBe(3);
      expect(fp.styleStrategy.effectStyleCount).toBe(1);
      expect(fp.styleStrategy.gridStyleCount).toBe(0);
    });

    it('should detect style-variable bindings', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(figmaWithStyles());

      const fp = result.fingerprint!;
      expect(fp.styleStrategy.stylesBindToVariables).toBe(true);
    });

    it('should detect text style naming pattern', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(figmaWithStyles());

      const fp = result.fingerprint!;
      // Names like "Heading/H1" → "{category}/{name}" pattern
      expect(fp.styleStrategy.textStyleNaming).toContain('{');
    });

    it('should handle missing _styles gracefully', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(minimalFigma());

      expect(result.ok).toBe(true);
      const fp = result.fingerprint!;
      expect(fp.styleStrategy.colorStyleCount).toBe(0);
      expect(fp.styleStrategy.textStyleCount).toBe(0);
    });
  });

  // ============================================================================
  // SECTION 8: SOURCE METADATA
  // ============================================================================

  describe('source metadata', () => {
    it('should set source name from config', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(minimalFigma());

      const fp = result.fingerprint!;
      expect(fp.source.name).toBe('Test Figma');
    });

    it('should set sourceFormat to figma-extractor-json', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(minimalFigma());

      const fp = result.fingerprint!;
      expect(fp.source.sourceFormat).toBe('figma-extractor-json');
    });

    it('should record extraction time', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(minimalFigma());

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should count total variables across all collections', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      // Primitives: 5 colors + 4 spacing = 9
      // Semantic: 3 (bg/primary, bg/danger, text/primary)
      // Component: 2 (button/bg/default, button/text/default)
      expect(fp.source.totalVariables).toBe(14);
    });
  });

  // ============================================================================
  // SECTION 9: ERROR HANDLING
  // ============================================================================

  describe('error handling', () => {
    it('should fail on non-array input', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract({ not: 'an array' });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('array');
    });

    it('should fail on empty array', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract([]);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Empty');
    });

    it('should fail on string input', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract('not json');

      expect(result.ok).toBe(false);
    });

    it('should fail on null input', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(null);

      expect(result.ok).toBe(false);
    });

    it('should handle entry with missing modes gracefully', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract([
        { BadCollection: { noModes: true } },
      ]);

      // Should either fail or produce empty result with warnings
      if (result.ok && result.fingerprint) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });

    it('should handle non-object entries with warnings', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract([null, 42, 'string']);

      // Should produce warnings about skipped entries
      if (result.ok) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });

    it('should accept config override per call', () => {
      const extractor = new FigmaTokenExtractor();
      const overrideConfig: ExtractorConfig = {
        sourceName: 'Override Name',
        formatHint: 'figma-extractor-json',
      };
      const result = extractor.extract(minimalFigma(), overrideConfig);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.source.name).toBe('Override Name');
    });
  });

  // ============================================================================
  // SECTION 10: DEPENDENCY GRAPH
  // ============================================================================

  describe('dependency graph', () => {
    it('should track dependsOn relationships (Semantic → Primitives)', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      const semantic = fp.collections.find(c => c.name === 'Semantic');
      expect(semantic!.dependsOn).toContain('Primitives');
    });

    it('should track dependedOnBy relationships (Primitives ← Semantic)', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      const primitives = fp.collections.find(c => c.name === 'Primitives');
      expect(primitives!.dependedOnBy).toContain('Semantic');
    });

    it('should track Component → Semantic dependency', () => {
      const extractor = new FigmaTokenExtractor(config);
      const result = extractor.extract(threeTierFigma());

      const fp = result.fingerprint!;
      const component = fp.collections.find(c => c.name === 'Component');
      expect(component!.dependsOn).toContain('Semantic');
    });
  });
});
