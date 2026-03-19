/**
 * Tests for TokenGenerator — Phase 3 of the Learning Engine.
 *
 * Tests cover:
 *   - Basic generation without recommendation (pure three-tier engine)
 *   - Generation with recommendation (spec adaptation)
 *   - Tier structure (primitives, semantic, component)
 *   - Naming separator adaptation (/ → .)
 *   - Mode adaptation from recommendations
 *   - Breakpoint tier generation
 *   - Validation (circular alias detection, cross-tier alias checks)
 *   - Summary statistics
 *   - Convenience function (generateTokenSystem)
 */

import { describe, it, expect } from 'vitest';
import {
  TokenGenerator,
  generateTokenSystem,
} from '../../src/learning/token-generator';
import type { GeneratedTokenSystem } from '../../src/learning/token-generator';
import type { DesignSystemSpec } from '../../src/tokens/schema';
import type { GenerationRecommendation } from '../../src/learning/learner';
import type { PatternSynthesis } from '../../src/learning/types';

// ============================================================================
// SECTION 1: TEST FIXTURES
// ============================================================================

/** Minimal valid DesignSystemSpec for testing. */
function minimalSpec(): DesignSystemSpec {
  return {
    name: 'Test DS',
    version: '1.0.0',
    createdAt: '2025-01-01T00:00:00Z',
    framework: 'react',
    tiers: {
      primitives: {
        collectionName: 'Primitives',
        modes: ['Value'],
        tier: 'primitives',
      },
      semantic: {
        collectionName: 'Semantic',
        modes: ['Light', 'Dark'],
        tier: 'semantic',
      },
      component: {
        collectionName: 'Component',
        modes: ['Light', 'Dark'],
        tier: 'component',
      },
    },
    palette: {
      primary: '#3B82F6',
      neutral: '#6B7280',
    },
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseFontSize: 16,
      scaleRatio: 1.25,
    },
    spacing: {
      baseUnit: 4,
      scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24],
    },
    components: ['button', 'card', 'input'],
  };
}

/** Spec with breakpoints tier. */
function specWithBreakpoints(): DesignSystemSpec {
  return {
    ...minimalSpec(),
    tiers: {
      ...minimalSpec().tiers,
      breakpoints: {
        collectionName: 'Breakpoints',
        modes: ['Desktop', 'Tablet', 'Mobile'],
        tier: 'breakpoints',
      },
    },
    breakpoints: {
      modes: ['Desktop', 'Tablet', 'Mobile'],
      widths: { Desktop: 1440, Tablet: 768, Mobile: 375 },
    },
  };
}

/** Minimal pattern synthesis for building recommendations. */
function stubSynthesis(): PatternSynthesis {
  return {
    sourceCount: 1,
    sourceNames: ['Test Source'],
    dominantSeparator: '/',
    dominantShadeCount: 11,
    tierCountRange: { min: 3, max: 3 },
    commonPatterns: [],
    divergences: [],
  };
}

/** A recommendation that keeps defaults (slash separator, 3 tiers). */
function defaultRecommendation(): GenerationRecommendation {
  return {
    recommendedTierCount: 3,
    recommendedTiers: [
      { name: 'Primitives', tier: 'primitive', modes: ['Value'], purpose: 'Raw values' },
      { name: 'Semantic', tier: 'semantic', modes: ['Light', 'Dark'], purpose: 'Purpose aliases' },
      { name: 'Component', tier: 'component', modes: ['Light', 'Dark'], purpose: 'Component tokens' },
    ],
    namingSeparator: '/',
    colorShadeCount: 11,
    useCrossCollectionAliases: true,
    maxAliasDepth: 3,
    bindStylesToVariables: true,
    confidence: 'high',
    rationale: ['Test recommendation'],
    synthesis: stubSynthesis(),
  };
}

/** A recommendation with dot separator and extra modes. */
function dotSeparatorRecommendation(): GenerationRecommendation {
  return {
    ...defaultRecommendation(),
    namingSeparator: '.',
    recommendedTiers: [
      { name: 'Primitives', tier: 'primitive', modes: ['Value'], purpose: 'Raw values' },
      { name: 'Semantic', tier: 'semantic', modes: ['Light', 'Dark', 'High Contrast'], purpose: 'Theme tokens' },
      { name: 'Component', tier: 'component', modes: ['Light', 'Dark', 'High Contrast'], purpose: 'Component tokens' },
    ],
  };
}

/** A recommendation with responsive tier. */
function responsiveRecommendation(): GenerationRecommendation {
  return {
    ...defaultRecommendation(),
    recommendedTiers: [
      ...defaultRecommendation().recommendedTiers,
      { name: 'Responsive', tier: 'responsive', modes: ['Desktop', 'Tablet', 'Mobile'], purpose: 'Breakpoints' },
    ],
    recommendedTierCount: 4,
  };
}

// ============================================================================
// SECTION 2: BASIC GENERATION (NO RECOMMENDATION)
// ============================================================================

describe('TokenGenerator', () => {
  describe('basic generation without recommendation', () => {
    it('should generate a token system from a minimal spec', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      expect(result.ok).toBe(true);
      const system = result.value!;
      expect(system.tiers.length).toBe(3);
      expect(system.allVariables.length).toBeGreaterThan(0);
    });

    it('should create primitives, semantic, and component tiers', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      const system = result.value!;
      const tierNames = system.tiers.map(t => t.tier);
      expect(tierNames).toContain('primitives');
      expect(tierNames).toContain('semantic');
      expect(tierNames).toContain('component');
    });

    it('should set correct collection names from spec', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      const system = result.value!;
      const collNames = system.tiers.map(t => t.collectionName);
      expect(collNames).toContain('Primitives');
      expect(collNames).toContain('Semantic');
      expect(collNames).toContain('Component');
    });

    it('should set correct modes from spec', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      const system = result.value!;
      const primitivesTier = system.tiers.find(t => t.tier === 'primitives');
      expect(primitivesTier!.modes).toContain('Value');

      const semanticTier = system.tiers.find(t => t.tier === 'semantic');
      expect(semanticTier!.modes).toContain('Light');
      expect(semanticTier!.modes).toContain('Dark');
    });

    it('should use / as default separator', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      const system = result.value!;
      expect(system.summary.separator).toBe('/');
    });

    it('should have no adaptations when no recommendation provided', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      const system = result.value!;
      expect(system.adaptations).toHaveLength(0);
    });

    it('should produce a correct summary', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      const system = result.value!;
      expect(system.summary.totalVariables).toBe(system.allVariables.length);
      expect(system.summary.totalCollections).toBe(3);
      expect(system.summary.totalModes).toBeGreaterThanOrEqual(4); // 1 + 2 + 2
      expect(system.summary.hasBreakpoints).toBe(false);
    });
  });

  // ============================================================================
  // SECTION 3: GENERATION WITH RECOMMENDATION
  // ============================================================================

  describe('generation with recommendation', () => {
    it('should generate successfully with a default recommendation', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec(), defaultRecommendation());

      expect(result.ok).toBe(true);
      const system = result.value!;
      expect(system.tiers.length).toBe(3);
      expect(system.allVariables.length).toBeGreaterThan(0);
    });

    it('should use recommendation separator for variable naming', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec(), dotSeparatorRecommendation());

      const system = result.value!;
      expect(system.summary.separator).toBe('.');

      // Check that variable names contain dots instead of slashes
      const hasDotsInNames = system.allVariables.some(v => v.name.includes('.'));
      expect(hasDotsInNames).toBe(true);
    });

    it('should expand modes from recommendation when richer', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec(), dotSeparatorRecommendation());

      const system = result.value!;
      const semanticTier = system.tiers.find(t => t.tier === 'semantic');
      // dotSeparatorRecommendation adds "High Contrast" mode
      expect(semanticTier!.modes).toContain('High Contrast');
    });

    it('should record adaptations made by the recommendation', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec(), dotSeparatorRecommendation());

      const system = result.value!;
      expect(system.adaptations.length).toBeGreaterThan(0);
    });

    it('should preserve the adapted spec in the output', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec(), defaultRecommendation());

      const system = result.value!;
      expect(system.spec).toBeDefined();
      expect(system.spec.name).toBe('Test DS');
    });
  });

  // ============================================================================
  // SECTION 4: BREAKPOINT GENERATION
  // ============================================================================

  describe('breakpoint generation', () => {
    it('should create a breakpoints tier when spec has breakpoints', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(specWithBreakpoints());

      expect(result.ok).toBe(true);
      const system = result.value!;
      expect(system.tiers.length).toBe(4);
      const bpTier = system.tiers.find(t => t.tier === 'breakpoints');
      expect(bpTier).toBeDefined();
      expect(bpTier!.collectionName).toBe('Breakpoints');
    });

    it('should set breakpoint modes on the tier', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(specWithBreakpoints());

      const system = result.value!;
      const bpTier = system.tiers.find(t => t.tier === 'breakpoints');
      expect(bpTier!.modes).toContain('Desktop');
      expect(bpTier!.modes).toContain('Tablet');
      expect(bpTier!.modes).toContain('Mobile');
    });

    it('should generate responsive font size tokens', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(specWithBreakpoints());

      const system = result.value!;
      const bpTier = system.tiers.find(t => t.tier === 'breakpoints');
      const fontSizeVars = bpTier!.variables.filter(v =>
        v.name.includes('fontSize') || v.name.includes('font')
      );
      expect(fontSizeVars.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate responsive spacing tokens', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(specWithBreakpoints());

      const system = result.value!;
      const bpTier = system.tiers.find(t => t.tier === 'breakpoints');
      const spacingVars = bpTier!.variables.filter(v =>
        v.name.includes('spacing')
      );
      expect(spacingVars.length).toBeGreaterThanOrEqual(1);
    });

    it('should set hasBreakpoints in summary', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(specWithBreakpoints());

      const system = result.value!;
      expect(system.summary.hasBreakpoints).toBe(true);
    });

    it('should add responsive tier from recommendation when spec lacks breakpoints', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec(), responsiveRecommendation());

      expect(result.ok).toBe(true);
      const system = result.value!;
      // The recommendation adds a responsive tier + adaptBreakpoints creates BreakpointSpec
      expect(system.summary.hasBreakpoints).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 5: NAMING ADAPTATION
  // ============================================================================

  describe('naming adaptation', () => {
    it('should not rename when separator matches (/ → /)', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec(), defaultRecommendation());

      const system = result.value!;
      // Names should use slash
      const allWithSlash = system.allVariables.filter(v => v.name.includes('/'));
      expect(allWithSlash.length).toBeGreaterThan(0);
    });

    it('should rename alias targets when changing separator', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec(), dotSeparatorRecommendation());

      const system = result.value!;
      // Find a variable with an alias value
      const aliasVars = system.allVariables.filter(v => {
        const values = Object.values(v.values);
        return values.some(val =>
          typeof val === 'object' && val !== null && 'type' in val &&
          (val as Record<string, unknown>)['type'] === 'alias'
        );
      });

      if (aliasVars.length > 0) {
        // Alias targets should also use dot separator
        const firstAlias = aliasVars[0]!;
        const aliasValue = Object.values(firstAlias.values).find(val =>
          typeof val === 'object' && val !== null && 'type' in val &&
          (val as Record<string, unknown>)['type'] === 'alias'
        ) as Record<string, unknown> | undefined;

        if (aliasValue) {
          const target = aliasValue['target'] as string;
          // Target should contain . not /
          expect(target.includes('.')).toBe(true);
        }
      }
    });
  });

  // ============================================================================
  // SECTION 6: VALIDATION
  // ============================================================================

  describe('validation', () => {
    it('should pass circular alias check for valid systems', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      expect(result.ok).toBe(true);
    });

    it('should pass cross-tier alias check for valid systems', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec(), defaultRecommendation());

      expect(result.ok).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 7: SUMMARY STATISTICS
  // ============================================================================

  describe('summary statistics', () => {
    it('should count total variables across all tiers', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      const system = result.value!;
      const manualTotal = system.tiers.reduce((sum, t) => sum + t.variables.length, 0);
      expect(system.summary.totalVariables).toBe(manualTotal);
    });

    it('should track variables per tier', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      const system = result.value!;
      for (const tier of system.tiers) {
        expect(system.summary.variablesPerTier[tier.collectionName]).toBe(tier.variables.length);
      }
    });

    it('should count palettes', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      const system = result.value!;
      // minimalSpec has primary + neutral = 2 palettes
      expect(system.summary.paletteCount).toBe(2);
    });

    it('should set shade count from recommendation', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec(), defaultRecommendation());

      const system = result.value!;
      expect(system.summary.shadeCount).toBe(11);
    });
  });

  // ============================================================================
  // SECTION 8: CONVENIENCE FUNCTION
  // ============================================================================

  describe('generateTokenSystem convenience function', () => {
    it('should produce the same result as TokenGenerator.generate()', () => {
      const spec = minimalSpec();
      const recommendation = defaultRecommendation();

      const generator = new TokenGenerator();
      const directResult = generator.generate(spec, recommendation);
      const convenienceResult = generateTokenSystem(spec, recommendation);

      expect(directResult.ok).toBe(convenienceResult.ok);

      if (directResult.ok && convenienceResult.ok) {
        expect(directResult.value!.summary.totalVariables)
          .toBe(convenienceResult.value!.summary.totalVariables);
        expect(directResult.value!.tiers.length)
          .toBe(convenienceResult.value!.tiers.length);
      }
    });

    it('should work without recommendation', () => {
      const result = generateTokenSystem(minimalSpec());
      expect(result.ok).toBe(true);
      expect(result.value!.allVariables.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SECTION 9: TIER PURPOSES
  // ============================================================================

  describe('tier purposes', () => {
    it('should set purpose strings on each tier', () => {
      const generator = new TokenGenerator();
      const result = generator.generate(minimalSpec());

      const system = result.value!;
      for (const tier of system.tiers) {
        expect(tier.purpose).toBeTruthy();
        expect(tier.purpose.length).toBeGreaterThan(5);
      }
    });
  });
});
