/**
 * Color Converter — Conversions between color formats.
 *
 * Supports: hex, RGB (0-255), HSL, HSB/HSV, CSS string, Figma RGBA (0-1).
 * Extracted and evolved from Variables & Styles Extractor ColorConverter.
 *
 * @module color/converter
 */

import type { RgbColor, HslColor, HsbColor, FigmaRgba, ColorValue } from '../tokens/schema';

// ============================================================================
// SECTION 1: MATH UTILITIES
// ============================================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toHexByte(value01: number): string {
  return Math.round(value01 * 255).toString(16).padStart(2, '0').toUpperCase();
}

function fromHexByte(hex: string): number {
  return parseInt(hex, 16) / 255;
}

/**
 * Shared hue calculation for HSL and HSB conversions.
 * Input RGB values are in 0-1 range.
 */
function calculateHue(r: number, g: number, b: number, max: number, min: number): number {
  if (max === min) return 0;

  const d = max - min;
  let h = 0;

  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }

  return Math.round(h * 360);
}

// ============================================================================
// SECTION 2: FROM FIGMA RGBA (0-1) TO OTHER FORMATS
// ============================================================================

/**
 * Figma RGBA (0-1 channels) → hex string.
 *
 * @param color - Figma color with r, g, b in 0-1 range.
 * @returns Hex string like "#EC4899" or "#EC489980" (with alpha).
 */
export function figmaToHex(color: FigmaRgba): string {
  const hex = '#' + toHexByte(color.r) + toHexByte(color.g) + toHexByte(color.b);
  if (color.a < 1) {
    return hex + toHexByte(color.a);
  }
  return hex;
}

/**
 * Figma RGBA (0-1) → RGB (0-255).
 */
export function figmaToRgb(color: FigmaRgba): RgbColor {
  const result: RgbColor = {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255),
  };
  if (color.a < 1) {
    return { ...result, a: round2(color.a) };
  }
  return result;
}

/**
 * Figma RGBA (0-1) → CSS color string.
 */
export function figmaToCss(color: FigmaRgba): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = round2(color.a);
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
}

/**
 * Figma RGBA (0-1) → HSL.
 */
export function figmaToHsl(color: FigmaRgba): HslColor {
  const { r, g, b } = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }

  const result: HslColor = {
    h: calculateHue(r, g, b, max, min),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };

  if (color.a < 1) {
    return { ...result, a: round2(color.a) };
  }
  return result;
}

/**
 * Figma RGBA (0-1) → HSB/HSV.
 */
export function figmaToHsb(color: FigmaRgba): HsbColor {
  const { r, g, b } = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const s = max === 0 ? 0 : (max - min) / max;

  const result: HsbColor = {
    h: calculateHue(r, g, b, max, min),
    s: Math.round(s * 100),
    b: Math.round(max * 100),
  };

  if (color.a < 1) {
    return { ...result, a: round2(color.a) };
  }
  return result;
}

/**
 * Figma RGBA (0-1) → all color formats.
 */
export function figmaToAllFormats(color: FigmaRgba): ColorValue {
  return {
    hex: figmaToHex(color),
    rgb: figmaToRgb(color),
    css: figmaToCss(color),
    hsl: figmaToHsl(color),
    hsb: figmaToHsb(color),
  };
}

// ============================================================================
// SECTION 3: FROM HEX TO OTHER FORMATS
// ============================================================================

/**
 * Parse a hex color string to Figma RGBA (0-1).
 *
 * @param hex - Hex string like "#ec4899", "#ec489980", "ec4899".
 * @returns Figma RGBA color.
 */
export function hexToFigma(hex: string): FigmaRgba {
  const clean = hex.replace('#', '');

  if (clean.length === 8) {
    return {
      r: fromHexByte(clean.substring(0, 2)),
      g: fromHexByte(clean.substring(2, 4)),
      b: fromHexByte(clean.substring(4, 6)),
      a: fromHexByte(clean.substring(6, 8)),
    };
  }

  if (clean.length === 6) {
    return {
      r: fromHexByte(clean.substring(0, 2)),
      g: fromHexByte(clean.substring(2, 4)),
      b: fromHexByte(clean.substring(4, 6)),
      a: 1,
    };
  }

  // 3-character shorthand (e.g., #f0f → #ff00ff)
  if (clean.length === 3) {
    return {
      r: fromHexByte(clean[0]! + clean[0]!),
      g: fromHexByte(clean[1]! + clean[1]!),
      b: fromHexByte(clean[2]! + clean[2]!),
      a: 1,
    };
  }

  // Fallback: black
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Hex → all color formats (convenience).
 */
export function hexToAllFormats(hex: string): ColorValue {
  return figmaToAllFormats(hexToFigma(hex));
}

// ============================================================================
// SECTION 4: FROM HSL TO FIGMA RGBA
// ============================================================================

/**
 * HSL → Figma RGBA (0-1).
 *
 * @param h - Hue (0-360).
 * @param s - Saturation (0-100).
 * @param l - Lightness (0-100).
 * @param a - Alpha (0-1, default 1).
 */
export function hslToFigma(h: number, s: number, l: number, a: number = 1): FigmaRgba {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return {
    r: clamp(r + m, 0, 1),
    g: clamp(g + m, 0, 1),
    b: clamp(b + m, 0, 1),
    a: clamp(a, 0, 1),
  };
}
