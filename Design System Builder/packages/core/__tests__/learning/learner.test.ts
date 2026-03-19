/**
 * Tests for DesignSystemLearner — study → learn → recommend pipeline.
 *
 * Tests cover:
 *   - Single-source study with each format (Figma, CSS, DTCG)
 *   - Multi-source synthesis
 *   - Format auto-detection
 *   - Recommendation generation (tiers, shades, separator)
 *   - Learner state management (reset, accessors)
 *   - Error handling for unsupported formats
 */

import { describe, it, expect } from 'vitest';
import { DesignSystemLearner } from '../../src/learning/learner';
import type { ExtractorConfig } from '../../src/learning/types';

// ============================================================================
// SECTION 1: TEST DATA
// ============================================================================

/** Minimal DTCG JSON (as string for study()). */
function dtcgJsonString(): string {
  return JSON.stringify({
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
    },
    semantic: {
      bg: {
        primary: { $type: 'color', $value: '{color.blue.500}' },
      },
    },
  });
}

/** Minimal CSS custom properties (as string for study()). */
function cssString(): string {
  return `
:root {
  --color-primary-50: #EFF6FF;
  --color-primary-100: #DBEAFE;
  --color-primary-200: #BFDBFE;
  --color-primary-300: #93C5FD;
  --color-primary-400: #60A5FA;
  --color-primary-500: #3B82F6;
  --color-primary-600: #2563EB;
  --color-primary-700: #1D4ED8;
  --color-primary-800: #1E40AF;
  --color-primary-900: #1E3A8A;
  --bg-primary: var(--color-primary-500);
  --text-primary: var(--color-primary-900);
}
`;
}

// ============================================================================
// SECTION 2: STUDY TESTS
// ============================================================================

describe('DesignSystemLearner', () => {
  describe('study()', () => {
    it('studies DTCG JSON input', () => {
      const learner = new DesignSystemLearner();
      const config: ExtractorConfig = {
        sourceName: 'Test DTCG',
        formatHint: 'dtcg-json',
      };

      const result = learner.study(dtcgJsonString(), config);

      expect(result.ok).toBe(true);
      expect(result.fingerprint).toBeDefined();
      expect(learner.getStudiedCount()).toBe(1);
    });

    it('studies CSS input', () => {
      const learner = new DesignSystemLearner();
      const config: ExtractorConfig = {
        sourceName: 'Test CSS',
        formatHint: 'css-variables',
      };

      const result = learner.study(cssString(), config);

      expect(result.ok).toBe(true);
      expect(result.fingerprint).toBeDefined();
      expect(learner.getStudiedCount()).toBe(1);
    });

    it('auto-detects DTCG format from JSON with $type', () => {
      const learner = new DesignSystemLearner();
      const config: ExtractorConfig = { sourceName: 'Auto DTCG' };

      const result = learner.study(dtcgJsonString(), config);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.source.sourceFormat).toBe('dtcg-json');
    });

    it('auto-detects CSS format from custom properties', () => {
      const learner = new DesignSystemLearner();
      const config: ExtractorConfig = { sourceName: 'Auto CSS' };

      const result = learner.study(cssString(), config);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.source.sourceFormat).toBe('css-variables');
    });

    it('fails for unsupported format', () => {
      const learner = new DesignSystemLearner();
      const config: ExtractorConfig = {
        sourceName: 'Bad',
        formatHint: 'unknown',
      };

      const result = learner.study('blah blah', config);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('No extractor');
    });

    it('fails for invalid JSON when format expects JSON', () => {
      const learner = new DesignSystemLearner();
      const config: ExtractorConfig = {
        sourceName: 'Bad JSON',
        formatHint: 'dtcg-json',
      };

      const result = learner.study('{ invalid json', config);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('accumulates multiple study results', () => {
      const learner = new DesignSystemLearner();

      learner.study(dtcgJsonString(), { sourceName: 'DTCG', formatHint: 'dtcg-json' });
      learner.study(cssString(), { sourceName: 'CSS', formatHint: 'css-variables' });

      expect(learner.getStudiedCount()).toBe(2);
      expect(learner.getFingerprints().length).toBe(2);
    });
  });

  // ==========================================================================
  // SECTION 3: LEARN TESTS
  // ==========================================================================

  describe('learn()', () => {
    it('returns null when no fingerprints studied', () => {
      const learner = new DesignSystemLearner();

      expect(learner.learn()).toBeNull();
    });

    it('returns synthesis from single source', () => {
      const learner = new DesignSystemLearner();
      learner.study(dtcgJsonString(), { sourceName: 'DTCG', formatHint: 'dtcg-json' });

      const synthesis = learner.learn();

      expect(synthesis).not.toBeNull();
      expect(synthesis!.sourceCount).toBe(1);
      expect(synthesis!.sourceNames).toEqual(['DTCG']);
    });

    it('synthesizes patterns from multiple sources', () => {
      const learner = new DesignSystemLearner();
      learner.study(dtcgJsonString(), { sourceName: 'Source A', formatHint: 'dtcg-json' });
      learner.study(cssString(), { sourceName: 'Source B', formatHint: 'css-variables' });

      const synthesis = learner.learn();

      expect(synthesis).not.toBeNull();
      expect(synthesis!.sourceCount).toBe(2);
      expect(synthesis!.sourceNames.length).toBe(2);
    });

    it('caches synthesis results', () => {
      const learner = new DesignSystemLearner();
      learner.study(dtcgJsonString(), { sourceName: 'DTCG', formatHint: 'dtcg-json' });

      const s1 = learner.learn();
      const s2 = learner.learn();

      // Same reference (cached)
      expect(s1).toBe(s2);
    });

    it('invalidates cache after new study()', () => {
      const learner = new DesignSystemLearner();
      learner.study(dtcgJsonString(), { sourceName: 'A', formatHint: 'dtcg-json' });
      const s1 = learner.learn();

      learner.study(cssString(), { sourceName: 'B', formatHint: 'css-variables' });
      const s2 = learner.learn();

      expect(s1).not.toBe(s2);
      expect(s2!.sourceCount).toBe(2);
    });
  });

  // ==========================================================================
  // SECTION 4: RECOMMEND TESTS
  // ==========================================================================

  describe('recommend()', () => {
    it('returns default recommendation with no study data', () => {
      const learner = new DesignSystemLearner();

      const rec = learner.recommend();

      // Should fall back to DSB defaults
      expect(rec.recommendedTierCount).toBeGreaterThanOrEqual(3);
      expect(rec.recommendedTiers.length).toBeGreaterThanOrEqual(3);
      expect(rec.rationale.length).toBeGreaterThan(0);
      expect(rec.confidence).toBe('low');
    });

    it('generates recommendation from single source', () => {
      const learner = new DesignSystemLearner();
      learner.study(dtcgJsonString(), { sourceName: 'DTCG', formatHint: 'dtcg-json' });

      const rec = learner.recommend();

      expect(rec.recommendedTierCount).toBeGreaterThanOrEqual(3);
      expect(rec.namingSeparator).toBeDefined();
      expect(rec.colorShadeCount).toBeGreaterThan(0);
      expect(rec.synthesis).toBeDefined();
      expect(rec.rationale.length).toBeGreaterThan(0);
    });

    it('generates higher-confidence recommendation from multiple sources', () => {
      const learner = new DesignSystemLearner();
      learner.study(dtcgJsonString(), { sourceName: 'A', formatHint: 'dtcg-json' });
      learner.study(cssString(), { sourceName: 'B', formatHint: 'css-variables' });

      const rec = learner.recommend();

      expect(rec.synthesis.sourceCount).toBe(2);
      // Confidence should be at least medium with 2 sources
      expect(['high', 'medium']).toContain(rec.confidence);
    });

    it('includes recommended tiers with names and purposes', () => {
      const learner = new DesignSystemLearner();
      learner.study(dtcgJsonString(), { sourceName: 'Test', formatHint: 'dtcg-json' });

      const rec = learner.recommend();

      for (const tier of rec.recommendedTiers) {
        expect(tier.name.length).toBeGreaterThan(0);
        expect(tier.tier).toBeDefined();
        expect(tier.purpose.length).toBeGreaterThan(0);
        expect(tier.modes.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // SECTION 5: STATE MANAGEMENT TESTS
  // ==========================================================================

  describe('state management', () => {
    it('reset() clears all state', () => {
      const learner = new DesignSystemLearner();
      learner.study(dtcgJsonString(), { sourceName: 'A', formatHint: 'dtcg-json' });
      learner.study(cssString(), { sourceName: 'B', formatHint: 'css-variables' });
      learner.learn();

      learner.reset();

      expect(learner.getStudiedCount()).toBe(0);
      expect(learner.getFingerprints().length).toBe(0);
      expect(learner.getExtractionResults().length).toBe(0);
      expect(learner.learn()).toBeNull();
    });

    it('tracks failed extractions in results', () => {
      const learner = new DesignSystemLearner();
      learner.study('invalid', { sourceName: 'Bad', formatHint: 'dtcg-json' });

      expect(learner.getStudiedCount()).toBe(0); // failed → not counted
      expect(learner.getExtractionResults().length).toBe(1); // but tracked
      expect(learner.getExtractionResults()[0]!.ok).toBe(false);
    });

    it('registerExtractor() adds custom extractor', () => {
      const learner = new DesignSystemLearner();
      const mockExtractor = {
        extract: () => ({
          ok: true,
          fingerprint: {
            collections: [],
            namingConventions: {
              separator: '/' as const,
              grouping: 'flat' as const,
              shadeNaming: 'custom' as const,
              casing: 'camelCase' as const,
              examples: [],
            },
            aliasTopology: {
              maxDepth: 0,
              averageDepth: 0,
              typicalChain: [],
              crossCollectionAliases: false,
              aliasPercentage: 0,
              circularCount: 0,
            },
            scalePatterns: {
              colorShades: 0,
              colorPalettes: [],
              spacingMultipliers: [],
              typographySizes: 0,
              breakpointCount: 0,
              breakpointNames: [],
            },
            styleStrategy: {
              colorStyleCount: 0,
              textStyleCount: 0,
              effectStyleCount: 0,
              gridStyleCount: 0,
              textStyleNaming: '',
              effectStyleNaming: '',
              stylesBindToVariables: false,
            },
            source: {
              name: 'Custom',
              sourceFormat: 'tokens-studio' as const,
              totalVariables: 0,
              totalStyles: 0,
              totalPages: 0,
              extractedAt: new Date().toISOString(),
            },
          },
          warnings: [],
          durationMs: 1,
        }),
      };

      learner.registerExtractor('tokens-studio', mockExtractor as any);
      const result = learner.study('{}', {
        sourceName: 'Custom',
        formatHint: 'tokens-studio',
      });

      expect(result.ok).toBe(true);
      expect(learner.getStudiedCount()).toBe(1);
    });
  });
});
