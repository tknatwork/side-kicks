import { describe, it, expect } from 'vitest';
import { exportCurrentFormat, importCurrentFormat } from '../src/export/current-format';
import { exportDtcgFormat, exportDtcgMultiMode } from '../src/export/dtcg-format';
import { generateAllTokens } from '../src/tokens/three-tier-engine';
import type { DesignSystemSpec, TierLevel, VariableDefinition, TierArchitecture } from '../src/tokens/schema';

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

describe('export/current-format', () => {
  describe('exportCurrentFormat', () => {
    it('exports variables in nested JSON structure', () => {
      const spec = makeSpec();
      const tokensResult = generateAllTokens(spec);
      expect(tokensResult.ok).toBe(true);
      if (!tokensResult.ok) return;

      const allVars = [
        ...tokensResult.value.primitives,
        ...tokensResult.value.semantic,
        ...tokensResult.value.component,
      ];

      const result = exportCurrentFormat(allVars, spec.tiers);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const exported = result.value;

      // Should have all three collections
      expect('Primitives' in exported).toBe(true);
      expect('Semantic' in exported).toBe(true);
      expect('Mapped' in exported).toBe(true);

      // Primitives should have 'Value' mode
      const primitives = exported['Primitives'];
      expect('Value' in primitives.modes).toBe(true);

      // Color variables should be nested: { color: { "primary-500": { $type: ... } } }
      const valueMode = primitives.modes['Value'];
      expect('color' in valueMode).toBe(true);
    });
  });

  describe('importCurrentFormat → exportCurrentFormat round-trip', () => {
    it('import reconstructs the original variables', () => {
      const spec = makeSpec();
      const tokensResult = generateAllTokens(spec);
      expect(tokensResult.ok).toBe(true);
      if (!tokensResult.ok) return;

      const allVars = [
        ...tokensResult.value.primitives,
        ...tokensResult.value.semantic,
        ...tokensResult.value.component,
      ];

      // Export
      const exportResult = exportCurrentFormat(allVars, spec.tiers);
      expect(exportResult.ok).toBe(true);
      if (!exportResult.ok) return;

      // Import back
      const tierMapping: Record<string, TierLevel> = {
        Primitives: 'primitives',
        Semantic: 'semantic',
        Mapped: 'component',
      };
      const importResult = importCurrentFormat(exportResult.value, tierMapping);
      expect(importResult.ok).toBe(true);
      if (!importResult.ok) return;

      // Should have the same number of variables
      expect(importResult.value.length).toBe(allVars.length);

      // Spot-check: find a known variable
      const primary500 = importResult.value.find(v => v.name === 'color/primary-500');
      expect(primary500).toBeDefined();
      expect(primary500!.type).toBe('color');
      expect(primary500!.tier).toBe('primitives');
    });
  });
});

describe('export/dtcg-format', () => {
  describe('exportDtcgFormat', () => {
    it('exports tokens in DTCG structure', () => {
      const spec = makeSpec();
      const tokensResult = generateAllTokens(spec);
      expect(tokensResult.ok).toBe(true);
      if (!tokensResult.ok) return;

      const allVars = [
        ...tokensResult.value.primitives,
        ...tokensResult.value.semantic,
        ...tokensResult.value.component,
      ];

      const result = exportDtcgFormat(allVars, spec.tiers);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const doc = result.value;

      // Should have $schema
      expect(doc.$schema).toBeDefined();

      // Should have nested color group
      expect('color' in doc).toBe(true);

      // Color tokens should have $type and $value
      const colorGroup = doc['color'] as Record<string, unknown>;
      expect(colorGroup).toBeDefined();

      // Find a specific token
      const primary500 = colorGroup['primary-500'] as { $type: string; $value: unknown };
      expect(primary500).toBeDefined();
      expect(primary500.$type).toBe('color');
      // DTCG color values are hex strings
      expect(typeof primary500.$value).toBe('string');
    });

    it('exports only specified tiers', () => {
      const spec = makeSpec();
      const tokensResult = generateAllTokens(spec);
      expect(tokensResult.ok).toBe(true);
      if (!tokensResult.ok) return;

      const allVars = [
        ...tokensResult.value.primitives,
        ...tokensResult.value.semantic,
        ...tokensResult.value.component,
      ];

      const result = exportDtcgFormat(allVars, spec.tiers, { tiers: ['primitives'] });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Should have color (primitives) but not bg (semantic) or surface (component)
      expect('color' in result.value).toBe(true);
      expect('bg' in result.value).toBe(false);
      expect('surface' in result.value).toBe(false);
    });

    it('converts aliases to DTCG reference syntax', () => {
      const spec = makeSpec();
      const tokensResult = generateAllTokens(spec);
      expect(tokensResult.ok).toBe(true);
      if (!tokensResult.ok) return;

      // Export semantic tokens only (which are all aliases)
      const result = exportDtcgFormat(tokensResult.value.semantic, spec.tiers, {
        tiers: ['semantic'],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // bg/primary should reference color.primary-500 with DTCG syntax
      const bgGroup = result.value['bg'] as Record<string, unknown>;
      expect(bgGroup).toBeDefined();
      const bgPrimary = bgGroup['primary'] as { $value: string };
      expect(bgPrimary.$value).toMatch(/^\{.+\}$/); // Wrapped in braces
    });
  });

  describe('exportDtcgMultiMode', () => {
    it('produces separate documents per mode', () => {
      const spec = makeSpec();
      const tokensResult = generateAllTokens(spec);
      expect(tokensResult.ok).toBe(true);
      if (!tokensResult.ok) return;

      const allVars = [
        ...tokensResult.value.primitives,
        ...tokensResult.value.semantic,
        ...tokensResult.value.component,
      ];

      const result = exportDtcgMultiMode(allVars, spec.tiers);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Should have documents for Value, Light, and Dark modes
      expect('Value' in result.value).toBe(true);
      expect('Light' in result.value).toBe(true);
      expect('Dark' in result.value).toBe(true);
    });
  });
});
