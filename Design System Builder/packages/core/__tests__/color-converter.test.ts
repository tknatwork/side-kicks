import { describe, it, expect } from 'vitest';
import {
  figmaToHex,
  figmaToRgb,
  figmaToCss,
  figmaToHsl,
  figmaToHsb,
  figmaToAllFormats,
  hexToFigma,
  hexToAllFormats,
  hslToFigma,
} from '../src/color/converter';
import type { FigmaRgba } from '../src/tokens/schema';

describe('color/converter', () => {
  // Pure red in Figma (0-1) format
  const RED_FIGMA: FigmaRgba = { r: 1, g: 0, b: 0, a: 1 };
  // Pure white
  const WHITE_FIGMA: FigmaRgba = { r: 1, g: 1, b: 1, a: 1 };
  // Mid gray
  const GRAY_FIGMA: FigmaRgba = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

  describe('figmaToHex', () => {
    it('converts pure red', () => {
      expect(figmaToHex(RED_FIGMA)).toBe('#FF0000');
    });

    it('converts pure white', () => {
      expect(figmaToHex(WHITE_FIGMA)).toBe('#FFFFFF');
    });

    it('converts black', () => {
      expect(figmaToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
    });
  });

  describe('figmaToRgb', () => {
    it('converts to 0-255 range', () => {
      const rgb = figmaToRgb(RED_FIGMA);
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });
  });

  describe('figmaToCss', () => {
    it('produces CSS rgb() string', () => {
      expect(figmaToCss(RED_FIGMA)).toBe('rgb(255, 0, 0)');
    });

    it('uses rgba() when alpha < 1', () => {
      const semiRed = { r: 1, g: 0, b: 0, a: 0.5 };
      expect(figmaToCss(semiRed)).toBe('rgba(255, 0, 0, 0.5)');
    });
  });

  describe('figmaToHsl', () => {
    it('converts pure red to HSL(0, 100, 50)', () => {
      const hsl = figmaToHsl(RED_FIGMA);
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it('converts pure white to HSL(0, 0, 100)', () => {
      const hsl = figmaToHsl(WHITE_FIGMA);
      expect(hsl.s).toBe(0);
      expect(hsl.l).toBe(100);
    });

    it('converts gray to HSL(0, 0, ~50)', () => {
      const hsl = figmaToHsl(GRAY_FIGMA);
      expect(hsl.s).toBe(0);
      expect(Math.round(hsl.l)).toBeCloseTo(50, 0);
    });
  });

  describe('figmaToHsb', () => {
    it('converts pure red to HSB(0, 100, 100)', () => {
      const hsb = figmaToHsb(RED_FIGMA);
      expect(hsb.h).toBe(0);
      expect(hsb.s).toBe(100);
      expect(hsb.b).toBe(100);
    });
  });

  describe('hexToFigma', () => {
    it('converts #FF0000 to Figma (1, 0, 0, 1)', () => {
      const figma = hexToFigma('#FF0000');
      expect(figma.r).toBeCloseTo(1, 2);
      expect(figma.g).toBeCloseTo(0, 2);
      expect(figma.b).toBeCloseTo(0, 2);
      expect(figma.a).toBe(1);
    });

    it('handles lowercase hex', () => {
      const figma = hexToFigma('#ff0000');
      expect(figma.r).toBeCloseTo(1, 2);
    });

    it('handles 3-char hex (#F00)', () => {
      const figma = hexToFigma('#F00');
      expect(figma.r).toBeCloseTo(1, 2);
      expect(figma.g).toBeCloseTo(0, 2);
      expect(figma.b).toBeCloseTo(0, 2);
    });
  });

  describe('hslToFigma', () => {
    it('converts HSL(0, 100, 50) back to red', () => {
      const figma = hslToFigma(0, 100, 50);
      expect(figma.r).toBeCloseTo(1, 2);
      expect(figma.g).toBeCloseTo(0, 2);
      expect(figma.b).toBeCloseTo(0, 2);
    });

    it('converts HSL(120, 100, 50) to green', () => {
      const figma = hslToFigma(120, 100, 50);
      expect(figma.r).toBeCloseTo(0, 2);
      expect(figma.g).toBeCloseTo(1, 2);
      expect(figma.b).toBeCloseTo(0, 2);
    });

    it('converts HSL(240, 100, 50) to blue', () => {
      const figma = hslToFigma(240, 100, 50);
      expect(figma.r).toBeCloseTo(0, 2);
      expect(figma.g).toBeCloseTo(0, 2);
      expect(figma.b).toBeCloseTo(1, 2);
    });
  });

  describe('round-trip conversion', () => {
    it('hex → Figma → allFormats → hex matches', () => {
      const testColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
      for (const hex of testColors) {
        const allFormats = hexToAllFormats(hex);
        expect(allFormats.hex.toUpperCase()).toBe(hex.toUpperCase());
      }
    });

    it('Figma → HSL → Figma round-trips with acceptable tolerance', () => {
      const original = { r: 0.231, g: 0.510, b: 0.965, a: 1 };
      const hsl = figmaToHsl(original);
      const roundTripped = hslToFigma(hsl.h, hsl.s, hsl.l);
      expect(roundTripped.r).toBeCloseTo(original.r, 1);
      expect(roundTripped.g).toBeCloseTo(original.g, 1);
      expect(roundTripped.b).toBeCloseTo(original.b, 1);
    });
  });
});
