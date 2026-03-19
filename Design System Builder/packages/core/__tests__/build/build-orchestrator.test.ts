/**
 * Tests for Build Orchestrator — planBuild() and execution plan generation.
 *
 * Tests cover:
 *   - Plan generation from a valid spec
 *   - Plan with learning engine recommendation
 *   - Step plan structure (commands, expectations)
 *   - Plan summary statistics
 *   - Validation error detection
 *   - Plan text formatting
 */

import { describe, it, expect } from 'vitest';
import { planBuild } from '../../src/build/build-orchestrator';
import type { BuildExecutionPlan, StepPlan } from '../../src/build/build-orchestrator';
import type { DesignSystemSpec } from '../../src/tokens/schema';
import { DesignSystemLearner } from '../../src/learning/learner';

// ============================================================================
// SECTION 1: TEST FIXTURES
// ============================================================================

/** Standard DesignSystemSpec matching existing test patterns. */
function makeSpec(): DesignSystemSpec {
  return {
    name: 'Test Design System',
    version: '1.0.0',
    createdAt: '2026-02-18',
    framework: 'react',
    tiers: {
      primitives: { collectionName: 'Primitives', modes: ['Value'], tier: 'primitives' },
      semantic: { collectionName: 'Semantic', modes: ['Value'], tier: 'semantic' },
      component: { collectionName: 'Mapped', modes: ['Light', 'Dark'], tier: 'component' },
    },
    palette: { primary: '#3B82F6' },
    typography: { headingFont: 'Inter', bodyFont: 'Inter', baseFontSize: 16 },
    spacing: { baseUnit: 4, scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] },
    components: ['Button', 'Card'],
  };
}

/** Spec with breakpoints. */
function makeSpecWithBreakpoints(): DesignSystemSpec {
  return {
    ...makeSpec(),
    tiers: {
      primitives: { collectionName: 'Primitives', modes: ['Value'], tier: 'primitives' },
      semantic: { collectionName: 'Semantic', modes: ['Value'], tier: 'semantic' },
      component: { collectionName: 'Mapped', modes: ['Light', 'Dark'], tier: 'component' },
      breakpoints: { collectionName: 'Breakpoints', modes: ['Desktop', 'Tablet', 'Mobile'], tier: 'breakpoints' },
    },
    breakpoints: {
      modes: ['Desktop', 'Tablet', 'Mobile'],
      values: {
        'Desktop': 1440,
        'Tablet': 768,
        'Mobile': 375,
      },
    },
  };
}

/** Generate a recommendation from DTCG data for testing. */
function makeRecommendation() {
  const learner = new DesignSystemLearner();
  learner.study(JSON.stringify({
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
      bg: { primary: { $type: 'color', $value: '{color.blue.500}' } },
    },
  }), { sourceName: 'Test DTCG', formatHint: 'dtcg-json' });

  return learner.recommend();
}

// ============================================================================
// SECTION 2: BASIC PLAN GENERATION
// ============================================================================

describe('Build Orchestrator — planBuild()', () => {
  describe('basic plan generation', () => {
    it('generates a plan from a valid spec', () => {
      const spec = makeSpec();
      const result = planBuild(spec);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const plan = result.value;
      expect(plan.spec).toBeDefined();
      expect(plan.tokenSystem).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.planText.length).toBeGreaterThan(0);
    });

    it('includes all expected pipeline steps', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const stepNames = result.value.steps.map(s => s.step);
      expect(stepNames).toContain('tier1');
      expect(stepNames).toContain('tier2');
      expect(stepNames).toContain('tier3');
    });

    it('generates non-empty commands for tier steps', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const tier1 = result.value.steps.find(s => s.step === 'tier1');
      expect(tier1).toBeDefined();
      expect(tier1!.commands.length).toBeGreaterThan(0);
    });

    it('produces a non-empty plan text', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.planText).toContain('Primitives');
    });
  });

  // ==========================================================================
  // SECTION 3: PLAN WITH RECOMMENDATION
  // ==========================================================================

  describe('plan with recommendation', () => {
    it('accepts a learning engine recommendation', () => {
      const spec = makeSpec();
      const rec = makeRecommendation();
      const result = planBuild(spec, rec);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.recommendation).toBeDefined();
      expect(result.value.summary.hasRecommendation).toBe(true);
    });

    it('records adaptations when recommendation is applied', () => {
      const spec = makeSpec();
      const rec = makeRecommendation();
      const result = planBuild(spec, rec);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // tokenSystem.adaptations may or may not be empty depending on
      // how much the recommendation diverges from the spec
      expect(result.value.tokenSystem.adaptations).toBeDefined();
    });
  });

  // ==========================================================================
  // SECTION 4: PLAN SUMMARY
  // ==========================================================================

  describe('plan summary', () => {
    it('reports correct total variables', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const summary = result.value.summary;
      expect(summary.totalVariables).toBeGreaterThan(0);
      // Should match the token system's allVariables count
      expect(summary.totalVariables).toBe(result.value.tokenSystem.allVariables.length);
    });

    it('reports correct total collections', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // At least: Primitives, Semantic, Mapped
      expect(result.value.summary.totalCollections).toBeGreaterThanOrEqual(3);
    });

    it('reports total commands > 0', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.summary.totalCommands).toBeGreaterThan(0);
    });

    it('includes per-tier variable counts', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const perTier = result.value.summary.variablesPerTier;
      expect(Object.keys(perTier).length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SECTION 5: STEP COMMAND STRUCTURE
  // ==========================================================================

  describe('step command structure', () => {
    it('commands have type, payload, and description', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      for (const step of result.value.steps) {
        for (const cmd of step.commands) {
          expect(typeof cmd.type).toBe('string');
          expect(cmd.type.length).toBeGreaterThan(0);
          expect(typeof cmd.payload).toBe('object');
          expect(typeof cmd.description).toBe('string');
          expect(cmd.description.length).toBeGreaterThan(0);
          expect(cmd.expectation).toBeDefined();
          expect(typeof cmd.expectation.critical).toBe('boolean');
          expect(typeof cmd.expectation.successDescription).toBe('string');
        }
      }
    });

    it('tier1 commands include collection creation', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const tier1 = result.value.steps.find(s => s.step === 'tier1');
      expect(tier1).toBeDefined();

      // First command should create the collection
      const firstCmd = tier1!.commands[0];
      expect(firstCmd).toBeDefined();
      expect(firstCmd!.type).toBe('create_collection');
    });

    it('step expectedOutput includes collection metadata', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const tier1 = result.value.steps.find(s => s.step === 'tier1');
      expect(tier1).toBeDefined();
      expect(tier1!.expectedOutput.variableCount).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SECTION 6: BREAKPOINTS HANDLING
  // ==========================================================================

  describe('breakpoints handling', () => {
    it('includes breakpoints step when spec has breakpoints', () => {
      const result = planBuild(makeSpecWithBreakpoints());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const bpStep = result.value.steps.find(s => s.step === 'breakpoints');
      expect(bpStep).toBeDefined();
    });

    it('breakpoints step is empty when spec has no breakpoints', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const bpStep = result.value.steps.find(s => s.step === 'breakpoints');
      expect(bpStep).toBeDefined();
      expect(bpStep!.commands.length).toBe(0);
    });
  });

  // ==========================================================================
  // SECTION 7: VALIDATION INTEGRATION
  // ==========================================================================

  describe('validation integration', () => {
    it('includes a validation report in the plan', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.validationReport).toBeDefined();
      expect(result.value.validationReport.valid).toBeDefined();
    });

    it('valid spec produces valid validation report', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // A correctly generated token set should validate
      expect(result.value.validationReport.valid).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 8: TOKEN SYSTEM INTEGRITY
  // ==========================================================================

  describe('token system integrity', () => {
    it('allVariables matches sum of tier variables', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const ts = result.value.tokenSystem;
      const sumFromTiers = ts.tiers.reduce(
        (sum, t) => sum + t.variables.length,
        0,
      );
      expect(ts.allVariables.length).toBe(sumFromTiers);
    });

    it('generated spec is preserved in the plan', () => {
      const inputSpec = makeSpec();
      const result = planBuild(inputSpec);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Spec name should match (possibly adapted)
      expect(result.value.spec.name).toBe('Test Design System');
    });

    it('token system includes generation summary', () => {
      const result = planBuild(makeSpec());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const summary = result.value.tokenSystem.summary;
      expect(summary).toBeDefined();
    });
  });
});
