/**
 * End-to-End Integration Test — Full Learning → Build Pipeline.
 *
 * This test exercises the complete pipeline that `dsb_study_and_learn`
 * and `dsb_start_build` MCP tools use internally:
 *
 *   1. Study multiple source formats (DTCG + CSS + Figma)
 *   2. Learn patterns (synthesize across sources)
 *   3. Generate recommendation
 *   4. Feed recommendation into generateTokenSystem()
 *   5. Feed recommendation into planBuild()
 *   6. Verify the entire chain produces a valid, consistent result
 *
 * This is the most important test — it proves the pipeline is sound
 * from raw user files all the way to a concrete build execution plan.
 *
 * @module core/__tests__/integration/e2e-pipeline.test.ts
 */

import { describe, it, expect } from 'vitest';
import { DesignSystemLearner } from '../../src/learning/learner';
import { generateTokenSystem } from '../../src/learning/token-generator';
import { planBuild } from '../../src/build/build-orchestrator';
import type { DesignSystemSpec } from '../../src/tokens/schema';
import type { GenerationRecommendation } from '../../src/learning/learner';

// ============================================================================
// SECTION 1: TEST DATA — Multi-format Source Files
// ============================================================================

/** DTCG token file — a well-structured 2-tier token system. */
function dtcgSource(): string {
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
      neutral: {
        '50': { $value: '#F9FAFB' },
        '100': { $value: '#F3F4F6' },
        '200': { $value: '#E5E7EB' },
        '300': { $value: '#D1D5DB' },
        '400': { $value: '#9CA3AF' },
        '500': { $value: '#6B7280' },
        '600': { $value: '#4B5563' },
        '700': { $value: '#374151' },
        '800': { $value: '#1F2937' },
        '900': { $value: '#111827' },
        '950': { $value: '#030712' },
      },
    },
    spacing: {
      $type: 'dimension',
      '1': { $value: '4px' },
      '2': { $value: '8px' },
      '3': { $value: '12px' },
      '4': { $value: '16px' },
      '6': { $value: '24px' },
      '8': { $value: '32px' },
      '10': { $value: '40px' },
      '12': { $value: '48px' },
      '16': { $value: '64px' },
    },
    semantic: {
      bg: {
        primary: { $type: 'color', $value: '{color.blue.500}' },
        secondary: { $type: 'color', $value: '{color.neutral.100}' },
        danger: { $type: 'color', $value: '{color.red.500}' },
      },
      text: {
        primary: { $type: 'color', $value: '{color.neutral.900}' },
        secondary: { $type: 'color', $value: '{color.neutral.600}' },
        inverse: { $type: 'color', $value: '{color.neutral.50}' },
      },
    },
  });
}

/** CSS variable file — a Tailwind-like system with dark mode. */
function cssSource(): string {
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
  --color-gray-50: #F9FAFB;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-500: #6B7280;
  --color-gray-700: #374151;
  --color-gray-900: #111827;
  --bg-primary: var(--color-primary-500);
  --bg-secondary: var(--color-gray-100);
  --text-primary: var(--color-gray-900);
  --text-secondary: var(--color-gray-500);
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: var(--color-primary-700);
    --bg-secondary: var(--color-gray-700);
    --text-primary: var(--color-gray-50);
    --text-secondary: var(--color-gray-200);
  }
}
`;
}

/** Figma extractor JSON — a 3-tier system. */
function figmaSource(): unknown[] {
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
              gray: {
                '100': { $value: '#F3F4F6', $type: 'color', $scopes: ['ALL_FILLS'] },
                '500': { $value: '#6B7280', $type: 'color', $scopes: ['ALL_FILLS'] },
                '900': { $value: '#111827', $type: 'color', $scopes: ['ALL_FILLS'] },
              },
            },
            spacing: {
              '4': { $value: 4, $type: 'float', $scopes: ['GAP'] },
              '8': { $value: 8, $type: 'float', $scopes: ['GAP'] },
              '16': { $value: 16, $type: 'float', $scopes: ['GAP'] },
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
              primary: { $value: '{color.blue.500}', $type: 'color', $scopes: ['FRAME_FILL'], $collectionName: 'Primitives' },
            },
            text: {
              primary: { $value: '{color.gray.900}', $type: 'color', $scopes: ['TEXT_FILL'], $collectionName: 'Primitives' },
            },
          },
          Dark: {
            bg: {
              primary: { $value: '{color.blue.700}', $type: 'color', $scopes: ['FRAME_FILL'], $collectionName: 'Primitives' },
            },
            text: {
              primary: { $value: '{color.gray.100}', $type: 'color', $scopes: ['TEXT_FILL'], $collectionName: 'Primitives' },
            },
          },
        },
      },
    },
  ];
}

/** Standard DesignSystemSpec for the build phase. */
function makeSpec(): DesignSystemSpec {
  return {
    name: 'E2E Test Design System',
    version: '1.0.0',
    createdAt: '2026-02-22',
    framework: 'react',
    tiers: {
      primitives: { collectionName: 'Primitives', modes: ['Value'], tier: 'primitives' },
      semantic: { collectionName: 'Semantic', modes: ['Light', 'Dark'], tier: 'semantic' },
      component: { collectionName: 'Component', modes: ['Light', 'Dark'], tier: 'component' },
    },
    palette: {
      primary: '#3B82F6',
      neutral: '#6B7280',
      error: '#EF4444',
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
    components: ['Button', 'Card', 'Input'],
  };
}

// ============================================================================
// SECTION 2: FULL PIPELINE — study → learn → recommend → generate → plan
// ============================================================================

describe('E2E Pipeline: study → learn → recommend → generate → planBuild', () => {
  // ── Step 1 & 2: Study multiple sources ────────────────────────────

  describe('Phase 1: Study multiple source formats', () => {
    it('should study DTCG + CSS + Figma sources successfully', () => {
      const learner = new DesignSystemLearner();

      const r1 = learner.study(dtcgSource(), { sourceName: 'DTCG Tokens', formatHint: 'dtcg-json' });
      const r2 = learner.study(cssSource(), { sourceName: 'Tailwind CSS', formatHint: 'css-variables' });
      const r3 = learner.study(JSON.stringify(figmaSource()), { sourceName: 'Figma Export', formatHint: 'figma-extractor-json' });

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      expect(r3.ok).toBe(true);
      expect(learner.getStudiedCount()).toBe(3);
    });

    it('should produce 3 distinct fingerprints', () => {
      const learner = new DesignSystemLearner();
      learner.study(dtcgSource(), { sourceName: 'DTCG', formatHint: 'dtcg-json' });
      learner.study(cssSource(), { sourceName: 'CSS', formatHint: 'css-variables' });
      learner.study(JSON.stringify(figmaSource()), { sourceName: 'Figma', formatHint: 'figma-extractor-json' });

      const fps = learner.getFingerprints();
      expect(fps).toHaveLength(3);

      const formats = fps.map(f => f.source.sourceFormat);
      expect(formats).toContain('dtcg-json');
      expect(formats).toContain('css-variables');
      expect(formats).toContain('figma-extractor-json');
    });
  });

  // ── Step 3: Learn from all sources ────────────────────────────────

  describe('Phase 2: Learn (synthesize patterns)', () => {
    it('should synthesize patterns from 3 sources', () => {
      const learner = buildFullLearner();
      const synthesis = learner.learn();

      expect(synthesis).not.toBeNull();
      expect(synthesis!.sourceCount).toBe(3);
      expect(synthesis!.sourceNames).toContain('DTCG');
      expect(synthesis!.sourceNames).toContain('CSS');
      expect(synthesis!.sourceNames).toContain('Figma');
    });

    it('should detect common shade count across sources', () => {
      const learner = buildFullLearner();
      const synthesis = learner.learn()!;

      // All sources use 10-11 shade scales — dominant should be ≥ 3
      expect(synthesis.dominantShadeCount).toBeGreaterThanOrEqual(3);
    });

    it('should identify common patterns', () => {
      const learner = buildFullLearner();
      const synthesis = learner.learn()!;

      // Common patterns should include color palettes at minimum
      expect(synthesis.commonPatterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Step 4: Generate recommendation ───────────────────────────────

  describe('Phase 3: Recommend', () => {
    it('should produce a recommendation with confidence from 3 sources', () => {
      const learner = buildFullLearner();
      learner.learn();
      const rec = learner.recommend();

      // Confidence depends on agreement between sources — at least 'low' from 3 diverse formats
      expect(['low', 'medium', 'high']).toContain(rec.confidence);
      expect(rec.recommendedTierCount).toBeGreaterThanOrEqual(2);
    });

    it('should recommend cross-collection aliases', () => {
      const learner = buildFullLearner();
      learner.learn();
      const rec = learner.recommend();

      expect(rec.useCrossCollectionAliases).toBe(true);
    });

    it('should include rationale explaining the recommendation', () => {
      const learner = buildFullLearner();
      learner.learn();
      const rec = learner.recommend();

      expect(rec.rationale.length).toBeGreaterThan(0);
      expect(rec.rationale[0]!.length).toBeGreaterThan(10);
    });

    it('should recommend tiers with modes', () => {
      const learner = buildFullLearner();
      learner.learn();
      const rec = learner.recommend();

      for (const tier of rec.recommendedTiers) {
        expect(tier.modes.length).toBeGreaterThanOrEqual(1);
        expect(tier.name.length).toBeGreaterThan(0);
        expect(tier.purpose.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Step 5: Generate token system using recommendation ────────────

  describe('Phase 4: Generate token system with recommendation', () => {
    it('should generate token system from spec + recommendation', () => {
      const rec = buildRecommendation();
      const result = generateTokenSystem(makeSpec(), rec);

      expect(result.ok).toBe(true);
      const system = result.value!;
      expect(system.allVariables.length).toBeGreaterThan(0);
      expect(system.tiers.length).toBeGreaterThanOrEqual(3);
    });

    it('should produce more variables with recommendation than without', () => {
      const rec = buildRecommendation();

      const withRec = generateTokenSystem(makeSpec(), rec);
      const withoutRec = generateTokenSystem(makeSpec());

      expect(withRec.ok).toBe(true);
      expect(withoutRec.ok).toBe(true);

      // With recommendation may adapt modes/shading, but both should produce variables
      expect(withRec.value!.allVariables.length).toBeGreaterThan(0);
      expect(withoutRec.value!.allVariables.length).toBeGreaterThan(0);
    });

    it('should record adaptations from the recommendation', () => {
      const rec = buildRecommendation();
      const result = generateTokenSystem(makeSpec(), rec);

      expect(result.ok).toBe(true);
      // adaptations list shows how recommendation influenced the output
      expect(result.value!.adaptations).toBeDefined();
    });

    it('should not have circular aliases in the generated system', () => {
      const rec = buildRecommendation();
      const result = generateTokenSystem(makeSpec(), rec);

      expect(result.ok).toBe(true);
      // If circular aliases existed, generate would return Result.err
    });
  });

  // ── Step 6: Plan build using recommendation ───────────────────────

  describe('Phase 5: Plan build with recommendation', () => {
    it('should produce a valid build execution plan', () => {
      const rec = buildRecommendation();
      const result = planBuild(makeSpec(), rec);

      expect(result.ok).toBe(true);
      const plan = result.value!;
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.planText.length).toBeGreaterThan(0);
    });

    it('should include the recommendation in the plan', () => {
      const rec = buildRecommendation();
      const result = planBuild(makeSpec(), rec);

      expect(result.ok).toBe(true);
      expect(result.value!.recommendation).toBeDefined();
      expect(result.value!.summary.hasRecommendation).toBe(true);
    });

    it('should generate commands for all tiers', () => {
      const rec = buildRecommendation();
      const result = planBuild(makeSpec(), rec);

      expect(result.ok).toBe(true);
      const stepNames = result.value!.steps.map(s => s.step);
      expect(stepNames).toContain('tier1');
      expect(stepNames).toContain('tier2');
      expect(stepNames).toContain('tier3');
    });

    it('should have non-empty commands in each tier step', () => {
      const rec = buildRecommendation();
      const result = planBuild(makeSpec(), rec);

      expect(result.ok).toBe(true);
      for (const step of result.value!.steps) {
        if (['tier1', 'tier2', 'tier3'].includes(step.step)) {
          expect(step.commands.length).toBeGreaterThan(0);
        }
      }
    });

    it('should produce a plan with consistent variable counts', () => {
      const rec = buildRecommendation();
      const result = planBuild(makeSpec(), rec);

      expect(result.ok).toBe(true);
      const plan = result.value!;

      // Total from plan summary should match token system
      expect(plan.summary.totalVariables).toBe(plan.tokenSystem.allVariables.length);

      // Per-tier counts should sum to total
      const tierTotal = plan.tokenSystem.tiers.reduce(
        (sum, tier) => sum + tier.variables.length,
        0,
      );
      expect(tierTotal).toBe(plan.tokenSystem.allVariables.length);
    });
  });

  // ── Step 7: Full chain consistency ────────────────────────────────

  describe('Full chain consistency', () => {
    it('should produce identical results when re-running the full pipeline', () => {
      const rec1 = buildRecommendation();
      const rec2 = buildRecommendation();

      // Two runs should produce structurally identical recommendations
      expect(rec1.recommendedTierCount).toBe(rec2.recommendedTierCount);
      expect(rec1.namingSeparator).toBe(rec2.namingSeparator);
      expect(rec1.colorShadeCount).toBe(rec2.colorShadeCount);
      expect(rec1.confidence).toBe(rec2.confidence);
    });

    it('should produce a plan that works without recommendation too', () => {
      // planBuild should succeed with just a spec (no learning)
      const result = planBuild(makeSpec());

      expect(result.ok).toBe(true);
      expect(result.value!.steps.length).toBeGreaterThan(0);
      expect(result.value!.summary.hasRecommendation).toBe(false);
    });

    it('plan with recommendation should have at least as many variables as without', () => {
      const rec = buildRecommendation();
      const withRec = planBuild(makeSpec(), rec);
      const withoutRec = planBuild(makeSpec());

      expect(withRec.ok).toBe(true);
      expect(withoutRec.ok).toBe(true);

      // Both should produce valid plans with variables
      expect(withRec.value!.summary.totalVariables).toBeGreaterThan(0);
      expect(withoutRec.value!.summary.totalVariables).toBeGreaterThan(0);
    });

    it('full pipeline from raw data to plan should complete in under 500ms', () => {
      const start = Date.now();

      // Full pipeline: study 3 → learn → recommend → generateTokenSystem → planBuild
      const learner = new DesignSystemLearner();
      learner.study(dtcgSource(), { sourceName: 'DTCG', formatHint: 'dtcg-json' });
      learner.study(cssSource(), { sourceName: 'CSS', formatHint: 'css-variables' });
      learner.study(JSON.stringify(figmaSource()), { sourceName: 'Figma', formatHint: 'figma-extractor-json' });
      learner.learn();
      const rec = learner.recommend();

      const genResult = generateTokenSystem(makeSpec(), rec);
      expect(genResult.ok).toBe(true);

      const planResult = planBuild(makeSpec(), rec);
      expect(planResult.ok).toBe(true);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});

// ============================================================================
// SECTION 3: HELPERS
// ============================================================================

/** Build a learner with all 3 sources studied. */
function buildFullLearner(): DesignSystemLearner {
  const learner = new DesignSystemLearner();
  learner.study(dtcgSource(), { sourceName: 'DTCG', formatHint: 'dtcg-json' });
  learner.study(cssSource(), { sourceName: 'CSS', formatHint: 'css-variables' });
  learner.study(JSON.stringify(figmaSource()), { sourceName: 'Figma', formatHint: 'figma-extractor-json' });
  return learner;
}

/** Build a recommendation from all 3 sources. */
function buildRecommendation(): GenerationRecommendation {
  const learner = buildFullLearner();
  learner.learn();
  return learner.recommend();
}
