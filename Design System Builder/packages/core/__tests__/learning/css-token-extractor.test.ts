/**
 * Tests for CssTokenExtractor — CSS custom properties format.
 *
 * Tests cover:
 *   - Basic extraction from :root CSS custom properties
 *   - Multi-scope parsing (light/dark via @media, .dark selector)
 *   - Variable type inference (color, dimension, number, string, unknown)
 *   - Collection inference from prefix grouping
 *   - Alias detection via var(--name) references
 *   - Naming convention detection (separator, casing)
 *   - Scale patterns (color palettes, typography, breakpoints)
 *   - Error handling (invalid input, empty CSS, no custom properties)
 */

import { describe, it, expect } from 'vitest';
import { CssTokenExtractor } from '../../src/learning/extractors/css-token-extractor';
import type { ExtractorConfig } from '../../src/learning/types';

// ============================================================================
// SECTION 1: TEST FIXTURES
// ============================================================================

/** Minimal CSS with a few custom properties in :root. */
function minimalCss(): string {
  return `
:root {
  --color-primary-500: #6366F1;
  --color-primary-600: #4F46E5;
  --color-primary-700: #4338CA;
  --spacing-1: 4px;
  --spacing-2: 8px;
  --font-size-base: 16px;
}
`;
}

/** CSS with aliases via var() references. */
function aliasedCss(): string {
  return `
:root {
  --color-blue-500: #3B82F6;
  --color-blue-600: #2563EB;
  --color-red-500: #EF4444;
  --bg-primary: var(--color-blue-500);
  --bg-danger: var(--color-red-500);
  --text-primary: var(--color-blue-600);
}
`;
}

/** CSS with multiple scopes — light/dark via @media. */
function multiScopeCss(): string {
  return `
:root {
  --color-blue-500: #3B82F6;
  --bg-primary: var(--color-blue-500);
  --text-color: #1F2937;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1E293B;
    --text-color: #F9FAFB;
  }
}
`;
}

/** CSS with .dark class selector for dark mode. */
function classScopeCss(): string {
  return `
:root {
  --color-primary: #6366F1;
  --bg-surface: #FFFFFF;
}

.dark {
  --color-primary: #818CF8;
  --bg-surface: #1E1E1E;
}
`;
}

/** CSS with diverse value types. */
function diverseTypesCss(): string {
  return `
:root {
  --color-brand: #FF6B6B;
  --color-text: rgb(31, 41, 55);
  --color-transparent: transparent;
  --spacing-sm: 8px;
  --spacing-md: 1.5rem;
  --border-radius: 4px;
  --opacity: 0.5;
  --z-index: 100;
  --font-family: "Inter", sans-serif;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
}
`;
}

/** CSS with color palettes (multiple shades). */
function paletteCss(): string {
  return `
:root {
  --blue-50: #EFF6FF;
  --blue-100: #DBEAFE;
  --blue-200: #BFDBFE;
  --blue-300: #93C5FD;
  --blue-400: #60A5FA;
  --blue-500: #3B82F6;
  --blue-600: #2563EB;
  --blue-700: #1D4ED8;
  --blue-800: #1E40AF;
  --blue-900: #1E3A8A;
  --red-50: #FEF2F2;
  --red-100: #FEE2E2;
  --red-200: #FECACA;
  --red-300: #FCA5A5;
  --red-400: #F87171;
  --red-500: #EF4444;
  --red-600: #DC2626;
  --red-700: #B91C1C;
  --red-800: #991B1B;
  --red-900: #7F1D1D;
  --green-500: #22C55E;
  --green-600: #16A34A;
  --green-700: #15803D;
}
`;
}

/** CSS with responsive breakpoint media queries. */
function breakpointCss(): string {
  return `
:root {
  --font-size-heading: 48px;
  --spacing-page: 80px;
}

@media (max-width: 768) {
  :root {
    --font-size-heading: 36px;
    --spacing-page: 48px;
  }
}

@media (max-width: 375) {
  :root {
    --font-size-heading: 28px;
    --spacing-page: 24px;
  }
}
`;
}

// ============================================================================
// SECTION 2: BASIC EXTRACTION TESTS
// ============================================================================

describe('CssTokenExtractor', () => {
  const config: ExtractorConfig = {
    sourceName: 'Test CSS',
    formatHint: 'css-variables',
  };

  describe('basic extraction', () => {
    it('should extract custom properties from :root', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(minimalCss());

      expect(result.ok).toBe(true);
      expect(result.fingerprint).toBeDefined();

      const fp = result.fingerprint!;
      expect(fp.source.totalVariables).toBe(6);
      expect(fp.source.sourceFormat).toBe('css-variables');
    });

    it('should create collections from common prefixes', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(minimalCss());

      const fp = result.fingerprint!;
      const collNames = fp.collections.map(c => c.name);
      // Should have groups like "color", "spacing", "font"
      expect(collNames.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect - as the separator for CSS conventions', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(minimalCss());

      const fp = result.fingerprint!;
      expect(fp.namingConventions.separator).toBe('-');
    });

    it('should set source name from config', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(minimalCss());

      const fp = result.fingerprint!;
      expect(fp.source.name).toBe('Test CSS');
    });
  });

  // ============================================================================
  // SECTION 3: VALUE TYPE INFERENCE
  // ============================================================================

  describe('value type inference', () => {
    it('should detect hex colors', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(diverseTypesCss());

      expect(result.ok).toBe(true);
      const fp = result.fingerprint!;
      // Should have some color-typed variables
      const colorCounts = fp.collections.reduce((sum, c) => {
        return sum + (c.typeDistribution['color'] ?? 0);
      }, 0);
      expect(colorCounts).toBeGreaterThanOrEqual(2);
    });

    it('should detect dimension values (px, rem)', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(diverseTypesCss());

      const fp = result.fingerprint!;
      const dimCounts = fp.collections.reduce((sum, c) => {
        return sum + (c.typeDistribution['dimension'] ?? 0);
      }, 0);
      expect(dimCounts).toBeGreaterThanOrEqual(2);
    });

    it('should detect plain number values', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(diverseTypesCss());

      const fp = result.fingerprint!;
      const numCounts = fp.collections.reduce((sum, c) => {
        return sum + (c.typeDistribution['number'] ?? 0);
      }, 0);
      expect(numCounts).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // SECTION 4: ALIAS DETECTION
  // ============================================================================

  describe('alias detection', () => {
    it('should detect var() references as aliases', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(aliasedCss());

      const fp = result.fingerprint!;
      expect(fp.aliasTopology.aliasPercentage).toBeGreaterThan(0);
    });

    it('should detect cross-group aliases (bg → color)', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(aliasedCss());

      const fp = result.fingerprint!;
      expect(fp.aliasTopology.crossCollectionAliases).toBe(true);
    });

    it('should calculate alias depth >= 1', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(aliasedCss());

      const fp = result.fingerprint!;
      expect(fp.aliasTopology.maxDepth).toBeGreaterThanOrEqual(1);
    });

    it('should report zero circular aliases in well-formed input', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(aliasedCss());

      const fp = result.fingerprint!;
      expect(fp.aliasTopology.circularCount).toBe(0);
    });
  });

  // ============================================================================
  // SECTION 5: MULTI-SCOPE (DARK/LIGHT MODE)
  // ============================================================================

  describe('multi-scope detection', () => {
    it('should detect Dark mode from @media prefers-color-scheme', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(multiScopeCss());

      const fp = result.fingerprint!;
      // Collections should have modes that include Dark
      const allModes = fp.collections.flatMap(c => c.modes);
      expect(allModes).toContain('Dark');
    });

    it('should detect Dark mode from .dark class selector', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(classScopeCss());

      const fp = result.fingerprint!;
      const allModes = fp.collections.flatMap(c => c.modes);
      expect(allModes).toContain('Dark');
    });

    it('should detect Light mode from :root', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(multiScopeCss());

      const fp = result.fingerprint!;
      const allModes = fp.collections.flatMap(c => c.modes);
      expect(allModes).toContain('Light');
    });
  });

  // ============================================================================
  // SECTION 6: SCALE PATTERNS
  // ============================================================================

  describe('scale patterns', () => {
    it('should detect color palettes from shade sequences', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(paletteCss());

      const fp = result.fingerprint!;
      expect(fp.scalePatterns.colorPalettes.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect dominant shade count', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(paletteCss());

      const fp = result.fingerprint!;
      // blue has 10 shades, red has 10 shades — dominant is 10
      expect(fp.scalePatterns.colorShades).toBeGreaterThanOrEqual(3);
    });

    it('should detect breakpoint modes from @media width queries', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(breakpointCss());

      const fp = result.fingerprint!;
      expect(fp.scalePatterns.breakpointCount).toBeGreaterThanOrEqual(1);
    });

    it('should detect typography sizes', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(breakpointCss());

      const fp = result.fingerprint!;
      expect(fp.scalePatterns.typographySizes).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // SECTION 7: COLLECTION INFERENCE & TIER CLASSIFICATION
  // ============================================================================

  describe('collection inference', () => {
    it('should group variables by first prefix segment', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(aliasedCss());

      const fp = result.fingerprint!;
      const collNames = fp.collections.map(c => c.name);
      // --color-* → "color", --bg-* → "bg", --text-* → "text"
      expect(collNames).toContain('color');
      expect(collNames).toContain('bg');
      expect(collNames).toContain('text');
    });

    it('should classify pure-value collections as primitive', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(aliasedCss());

      const fp = result.fingerprint!;
      const colorColl = fp.collections.find(c => c.name === 'color');
      expect(colorColl).toBeDefined();
      expect(colorColl!.tier).toBe('primitive');
    });

    it('should classify alias-heavy collections as semantic or mapped', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(aliasedCss());

      const fp = result.fingerprint!;
      const bgColl = fp.collections.find(c => c.name === 'bg');
      expect(bgColl).toBeDefined();
      expect(['semantic', 'mapped', 'component']).toContain(bgColl!.tier);
    });

    it('should track dependency relationships between groups', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(aliasedCss());

      const fp = result.fingerprint!;
      const bgColl = fp.collections.find(c => c.name === 'bg');
      expect(bgColl!.dependsOn).toContain('color');
    });
  });

  // ============================================================================
  // SECTION 8: STYLE STRATEGY (CSS has no styles)
  // ============================================================================

  describe('style strategy', () => {
    it('should report zero styles (CSS has no Figma-style styles)', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(minimalCss());

      const fp = result.fingerprint!;
      expect(fp.styleStrategy.colorStyleCount).toBe(0);
      expect(fp.styleStrategy.textStyleCount).toBe(0);
      expect(fp.styleStrategy.effectStyleCount).toBe(0);
      expect(fp.styleStrategy.gridStyleCount).toBe(0);
      expect(fp.styleStrategy.stylesBindToVariables).toBe(false);
    });
  });

  // ============================================================================
  // SECTION 9: ERROR HANDLING
  // ============================================================================

  describe('error handling', () => {
    it('should fail on non-string input', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract({ not: 'a string' });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should fail on empty string', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract('');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Empty');
    });

    it('should fail on whitespace-only string', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract('   \n\n   ');

      expect(result.ok).toBe(false);
    });

    it('should fail on CSS with no custom properties', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract('body { color: red; font-size: 16px; }');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('custom properties');
    });

    it('should fail on null input', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(null);

      expect(result.ok).toBe(false);
    });

    it('should fail on number input', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(42);

      expect(result.ok).toBe(false);
    });

    it('should accept config override per call', () => {
      const extractor = new CssTokenExtractor();
      const overrideConfig: ExtractorConfig = {
        sourceName: 'Override CSS',
        formatHint: 'css-variables',
      };
      const result = extractor.extract(minimalCss(), overrideConfig);

      expect(result.ok).toBe(true);
      expect(result.fingerprint!.source.name).toBe('Override CSS');
    });
  });

  // ============================================================================
  // SECTION 10: NAMING CONVENTIONS
  // ============================================================================

  describe('naming conventions', () => {
    it('should provide example names', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(minimalCss());

      const fp = result.fingerprint!;
      expect(fp.namingConventions.examples.length).toBeGreaterThan(0);
    });

    it('should detect kebab-case casing', () => {
      const extractor = new CssTokenExtractor(config);
      const result = extractor.extract(minimalCss());

      const fp = result.fingerprint!;
      expect(fp.namingConventions.casing).toBe('kebab-case');
    });
  });
});
