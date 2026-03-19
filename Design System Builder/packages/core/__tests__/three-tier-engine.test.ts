import { describe, it, expect } from 'vitest';
import {
  isAlias,
  validateAliasChain,
  validateCrossTierAliases,
  detectCircularAliases,
  buildTierMapping,
  generatePrimitives,
  generateSemanticTokens,
  generateComponentTokens,
  generateAllTokens,
} from '../src/tokens/three-tier-engine';
import type {
  VariableDefinition,
  AliasReference,
  DesignSystemSpec,
  TierLevel,
} from '../src/tokens/schema';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeSpec(overrides?: Partial<DesignSystemSpec>): DesignSystemSpec {
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
    components: ['Button', 'Card', 'Input'],
    ...overrides,
  };
}

function makeVariable(overrides: Partial<VariableDefinition> & Pick<VariableDefinition, 'name' | 'tier'>): VariableDefinition {
  return {
    type: 'color',
    scopes: ['ALL_FILLS'],
    values: { Value: '#FF0000' },
    ...overrides,
  };
}

function makeAlias(target: string, collection: string): AliasReference {
  return { type: 'alias', target, collection };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('three-tier-engine', () => {
  describe('isAlias', () => {
    it('identifies alias references', () => {
      expect(isAlias(makeAlias('color/blue-500', 'Primitives'))).toBe(true);
    });

    it('rejects primitive values', () => {
      expect(isAlias('#FF0000')).toBe(false);
      expect(isAlias(42)).toBe(false);
      expect(isAlias(true)).toBe(false);
    });

    it('rejects ColorValue objects', () => {
      const color = { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 }, css: 'rgb(255,0,0)', hsl: { h: 0, s: 100, l: 50 }, hsb: { h: 0, s: 100, b: 100 } };
      expect(isAlias(color)).toBe(false);
    });
  });

  describe('validateAliasChain', () => {
    it('allows primitives with raw values', () => {
      const v = makeVariable({ name: 'color/blue-500', tier: 'primitives' });
      expect(validateAliasChain(v).ok).toBe(true);
    });

    it('rejects primitives with aliases', () => {
      const v = makeVariable({
        name: 'color/blue-500',
        tier: 'primitives',
        values: { Value: makeAlias('color/red-500', 'Primitives') },
      });
      const result = validateAliasChain(v);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Primitives must hold raw values only');
      }
    });

    it('allows semantic variables with aliases', () => {
      const v = makeVariable({
        name: 'bg/primary',
        tier: 'semantic',
        values: { Value: makeAlias('color/blue-500', 'Primitives') },
      });
      expect(validateAliasChain(v).ok).toBe(true);
    });

    it('rejects aliases with empty target', () => {
      const v = makeVariable({
        name: 'bg/primary',
        tier: 'semantic',
        values: { Value: { type: 'alias', target: '', collection: 'Primitives' } as AliasReference },
      });
      const result = validateAliasChain(v);
      expect(result.ok).toBe(false);
    });
  });

  describe('validateCrossTierAliases', () => {
    it('allows semantic → primitives alias', () => {
      const vars: VariableDefinition[] = [
        makeVariable({ name: 'color/blue-500', tier: 'primitives' }),
        makeVariable({
          name: 'bg/primary',
          tier: 'semantic',
          values: { Value: makeAlias('color/blue-500', 'Primitives') },
        }),
      ];
      const mapping: Record<string, TierLevel> = {
        Primitives: 'primitives',
        Semantic: 'semantic',
      };
      expect(validateCrossTierAliases(vars, mapping).ok).toBe(true);
    });

    it('rejects component → primitives alias (must go through semantic)', () => {
      const vars: VariableDefinition[] = [
        makeVariable({
          name: 'button/bg',
          tier: 'component',
          values: { Light: makeAlias('color/blue-500', 'Primitives') },
        }),
      ];
      const mapping: Record<string, TierLevel> = {
        Primitives: 'primitives',
        Semantic: 'semantic',
        Mapped: 'component',
      };
      const result = validateCrossTierAliases(vars, mapping);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('can only alias');
      }
    });

    it('allows component → semantic alias', () => {
      const vars: VariableDefinition[] = [
        makeVariable({
          name: 'button/bg',
          tier: 'component',
          values: { Light: makeAlias('bg/primary', 'Semantic') },
        }),
      ];
      const mapping: Record<string, TierLevel> = {
        Semantic: 'semantic',
        Mapped: 'component',
      };
      expect(validateCrossTierAliases(vars, mapping).ok).toBe(true);
    });
  });

  describe('detectCircularAliases', () => {
    it('passes for acyclic alias chains', () => {
      const vars: VariableDefinition[] = [
        makeVariable({
          name: 'bg/primary',
          tier: 'semantic',
          values: { Value: makeAlias('color/blue-500', 'Primitives') },
        }),
        makeVariable({
          name: 'color/blue-500',
          tier: 'primitives',
        }),
      ];
      expect(detectCircularAliases(vars).ok).toBe(true);
    });

    it('detects direct circular reference', () => {
      const vars: VariableDefinition[] = [
        makeVariable({
          name: 'a',
          tier: 'semantic',
          values: { Value: makeAlias('b', 'Semantic') },
        }),
        makeVariable({
          name: 'b',
          tier: 'semantic',
          values: { Value: makeAlias('a', 'Semantic') },
        }),
      ];
      const result = detectCircularAliases(vars);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Circular alias detected');
      }
    });

    it('detects indirect circular reference (A → B → C → A)', () => {
      const vars: VariableDefinition[] = [
        makeVariable({
          name: 'a',
          tier: 'semantic',
          values: { Value: makeAlias('b', 'Semantic') },
        }),
        makeVariable({
          name: 'b',
          tier: 'semantic',
          values: { Value: makeAlias('c', 'Semantic') },
        }),
        makeVariable({
          name: 'c',
          tier: 'semantic',
          values: { Value: makeAlias('a', 'Semantic') },
        }),
      ];
      const result = detectCircularAliases(vars);
      expect(result.ok).toBe(false);
    });
  });

  describe('generatePrimitives', () => {
    it('generates color, spacing, and typography primitives', () => {
      const spec = makeSpec();
      const primitives = generatePrimitives(spec);
      expect(primitives.length).toBeGreaterThan(0);

      // Should have color primitives
      const colorVars = primitives.filter(v => v.name.startsWith('color/'));
      expect(colorVars.length).toBeGreaterThan(10); // primary scale + neutral + white/black

      // Should have spacing primitives
      const spacingVars = primitives.filter(v => v.name.startsWith('spacing/'));
      expect(spacingVars.length).toBe(13); // 13 items in scale

      // Should have font primitives
      const fontVars = primitives.filter(v => v.name.startsWith('font/'));
      expect(fontVars.length).toBeGreaterThanOrEqual(2); // heading + body

      // All should be tier: primitives
      expect(primitives.every(v => v.tier === 'primitives')).toBe(true);
    });
  });

  describe('generateSemanticTokens', () => {
    it('generates alias-only semantic tokens', () => {
      const spec = makeSpec();
      const semantic = generateSemanticTokens(spec);
      expect(semantic.length).toBeGreaterThan(0);

      // All values should be aliases
      for (const v of semantic) {
        expect(v.tier).toBe('semantic');
        for (const value of Object.values(v.values)) {
          expect(isAlias(value)).toBe(true);
        }
      }
    });
  });

  describe('generateComponentTokens', () => {
    it('generates theme-aware component tokens', () => {
      const spec = makeSpec();
      const component = generateComponentTokens(spec);
      expect(component.length).toBeGreaterThan(0);

      // All should be tier: component
      expect(component.every(v => v.tier === 'component')).toBe(true);

      // Should have values for both Light and Dark modes
      for (const v of component) {
        expect(Object.keys(v.values)).toContain('Light');
        expect(Object.keys(v.values)).toContain('Dark');
      }
    });
  });

  describe('generateAllTokens', () => {
    it('generates and validates a complete token set', () => {
      const spec = makeSpec();
      const result = generateAllTokens(spec);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.primitives.length).toBeGreaterThan(0);
        expect(result.value.semantic.length).toBeGreaterThan(0);
        expect(result.value.component.length).toBeGreaterThan(0);
      }
    });
  });

  describe('buildTierMapping', () => {
    it('maps collection names to tier levels', () => {
      const spec = makeSpec();
      const mapping = buildTierMapping(spec.tiers);
      expect(mapping).toEqual({
        Primitives: 'primitives',
        Semantic: 'semantic',
        Mapped: 'component',
      });
    });
  });
});
