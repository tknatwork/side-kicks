import { describe, it, expect } from 'vitest';
import { validateTokens, getPlanLimits } from '../src/validation/token-validator';
import { generateAllTokens } from '../src/tokens/three-tier-engine';
import type { DesignSystemSpec, VariableDefinition, AliasReference } from '../src/tokens/schema';

function makeSpec(): DesignSystemSpec {
  return {
    name: 'Test DS',
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

describe('token-validator', () => {
  describe('validateTokens', () => {
    it('validates a correctly generated token set as valid', () => {
      const spec = makeSpec();
      const result = generateAllTokens(spec);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const allVars = [
        ...result.value.primitives,
        ...result.value.semantic,
        ...result.value.component,
      ];

      const report = validateTokens(allVars, spec);
      expect(report.valid).toBe(true);

      // Should have stats
      expect(report.stats.totalVariables).toBeGreaterThan(0);
      expect(report.stats.byTier.primitives).toBeGreaterThan(0);
      expect(report.stats.byTier.semantic).toBeGreaterThan(0);
      expect(report.stats.byTier.component).toBeGreaterThan(0);
    });

    it('detects missing references', () => {
      const spec = makeSpec();
      const badVar: VariableDefinition = {
        name: 'bg/nonexistent',
        type: 'color',
        scopes: ['ALL_FILLS'],
        values: {
          Value: { type: 'alias', target: 'color/does-not-exist', collection: 'Primitives' } as AliasReference,
        },
        tier: 'semantic',
      };

      const report = validateTokens([badVar], spec);
      const missingRef = report.issues.find(i => i.code === 'MISSING_REFERENCE');
      expect(missingRef).toBeDefined();
    });

    it('detects duplicate names within same tier', () => {
      const spec = makeSpec();
      const vars: VariableDefinition[] = [
        {
          name: 'color/blue-500',
          type: 'color',
          scopes: ['ALL_FILLS'],
          values: { Value: '#0000FF' },
          tier: 'primitives',
        },
        {
          name: 'color/blue-500',
          type: 'color',
          scopes: ['ALL_FILLS'],
          values: { Value: '#0000EE' },
          tier: 'primitives',
        },
      ];

      const report = validateTokens(vars, spec);
      const dup = report.issues.find(i => i.code === 'DUPLICATE_NAME');
      expect(dup).toBeDefined();
    });

    it('detects empty values', () => {
      const spec = makeSpec();
      const vars: VariableDefinition[] = [{
        name: 'color/empty',
        type: 'color',
        scopes: ['ALL_FILLS'],
        values: {},
        tier: 'primitives',
      }];

      const report = validateTokens(vars, spec);
      const empty = report.issues.find(i => i.code === 'EMPTY_VALUES');
      expect(empty).toBeDefined();
    });

    it('warns about naming convention violations', () => {
      const spec = makeSpec();
      const vars: VariableDefinition[] = [{
        name: 'BadCamelCase',
        type: 'color',
        scopes: ['ALL_FILLS'],
        values: { Value: '#FF0000' },
        tier: 'primitives',
      }];

      const report = validateTokens(vars, spec);
      const naming = report.issues.find(i => i.code === 'NAMING_CONVENTION');
      expect(naming).toBeDefined();
      expect(naming!.severity).toBe('warning'); // warning, not error
    });
  });

  describe('getPlanLimits', () => {
    it('returns starter limits', () => {
      const limits = getPlanLimits('starter');
      expect(limits.maxVariablesPerCollection).toBe(500);
      expect(limits.maxModesPerCollection).toBe(1);
    });

    it('returns professional limits', () => {
      const limits = getPlanLimits('professional');
      expect(limits.maxVariablesPerCollection).toBe(5000);
      expect(limits.maxModesPerCollection).toBe(4);
    });

    it('defaults to professional for unknown plans', () => {
      const limits = getPlanLimits('unknown-plan');
      expect(limits.maxVariablesPerCollection).toBe(5000);
    });
  });

  describe('plan limit violations', () => {
    it('detects starter plan mode limit violations', () => {
      const spec = makeSpec();
      const result = generateAllTokens(spec);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const allVars = [
        ...result.value.primitives,
        ...result.value.semantic,
        ...result.value.component,
      ];

      // Starter plan only allows 1 mode — our spec has Light/Dark (2 modes)
      const report = validateTokens(allVars, spec, 'starter');
      const planIssue = report.issues.find(i => i.code === 'PLAN_LIMIT_MODES');
      expect(planIssue).toBeDefined();
    });
  });
});
