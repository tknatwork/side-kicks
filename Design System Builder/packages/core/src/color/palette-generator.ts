/**
 * Palette Generator — Generate complete color scales from a single base color.
 *
 * Given a base hex color, generates a full 100-900 scale suitable for
 * Tier 1 (Primitives) color variables. Supports various color scheme types.
 *
 * @module color/palette-generator
 */

import type { ColorValue } from '../tokens/schema';
import { hexToFigma, figmaToHsl, hslToFigma, figmaToAllFormats } from './converter';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type ColorScheme = 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'split-complementary';

export interface PaletteStep {
  readonly shade: number;    // 50, 100, 200, ..., 900, 950
  readonly color: ColorValue;
}

export interface GeneratedPalette {
  readonly baseName: string;
  readonly baseHex: string;
  readonly steps: readonly PaletteStep[];
}

// ============================================================================
// SECTION 2: SCALE GENERATION
// ============================================================================

/** Standard shade stops for a color scale (Tailwind-style). */
const SHADE_STOPS: readonly number[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * Lightness targets for each shade stop.
 * 50 = very light (95%), 500 = base, 950 = very dark (10%).
 * These approximate Tailwind CSS's color generation approach.
 */
const LIGHTNESS_TARGETS: Readonly<Record<number, number>> = {
  50: 97,
  100: 94,
  200: 86,
  300: 77,
  400: 66,
  500: 50,
  600: 42,
  700: 35,
  800: 27,
  900: 20,
  950: 10,
};

/**
 * Generate a complete color scale from a single base hex color.
 *
 * @param baseHex - The base color (used as the 500 shade).
 * @param name - Name for this palette (e.g., "primary", "blue").
 * @returns A full 50-950 color scale.
 */
export function generateColorScale(baseHex: string, name: string): GeneratedPalette {
  const figma = hexToFigma(baseHex);
  const hsl = figmaToHsl(figma);

  const steps: PaletteStep[] = SHADE_STOPS.map(shade => {
    const targetLightness = LIGHTNESS_TARGETS[shade]!;

    // Adjust saturation: lighter shades are slightly less saturated,
    // darker shades are slightly more saturated
    let adjustedSaturation = hsl.s;
    if (shade <= 100) {
      adjustedSaturation = Math.max(0, hsl.s - 15); // Desaturate lights
    } else if (shade >= 800) {
      adjustedSaturation = Math.min(100, hsl.s + 5); // Slightly boost darks
    }

    const figmaColor = hslToFigma(hsl.h, adjustedSaturation, targetLightness);
    return {
      shade,
      color: figmaToAllFormats(figmaColor),
    };
  });

  return {
    baseName: name,
    baseHex,
    steps,
  };
}

// ============================================================================
// SECTION 3: COLOR SCHEME GENERATION
// ============================================================================

/**
 * Generate color palettes based on a color scheme.
 *
 * @param baseHex - The primary color.
 * @param scheme - The type of color scheme.
 * @returns Array of palettes (primary + accent colors based on scheme).
 */
export function generateColorScheme(
  baseHex: string,
  scheme: ColorScheme
): readonly GeneratedPalette[] {
  const figma = hexToFigma(baseHex);
  const hsl = figmaToHsl(figma);

  const hues = getSchemeHues(hsl.h, scheme);

  return hues.map((hue, index) => {
    const name = index === 0 ? 'primary' : `accent-${index}`;
    const shiftedFigma = hslToFigma(hue, hsl.s, hsl.l);
    const shiftedHex = figmaToAllFormats(shiftedFigma).hex;
    return generateColorScale(shiftedHex, name);
  });
}

/**
 * Get hue values for a given color scheme.
 */
function getSchemeHues(baseHue: number, scheme: ColorScheme): readonly number[] {
  switch (scheme) {
    case 'monochromatic':
      return [baseHue];

    case 'analogous':
      return [baseHue, normalizeHue(baseHue + 30), normalizeHue(baseHue - 30)];

    case 'complementary':
      return [baseHue, normalizeHue(baseHue + 180)];

    case 'triadic':
      return [baseHue, normalizeHue(baseHue + 120), normalizeHue(baseHue + 240)];

    case 'split-complementary':
      return [baseHue, normalizeHue(baseHue + 150), normalizeHue(baseHue + 210)];
  }
}

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

// ============================================================================
// SECTION 4: NEUTRAL PALETTE
// ============================================================================

/**
 * Generate a neutral/gray palette with a slight tint from the primary color.
 *
 * @param primaryHex - The primary color to tint the neutrals.
 * @param name - Palette name (default: "neutral").
 */
export function generateNeutralPalette(
  primaryHex: string,
  name: string = 'neutral'
): GeneratedPalette {
  const figma = hexToFigma(primaryHex);
  const hsl = figmaToHsl(figma);

  // Neutral uses the primary's hue but with very low saturation (4-8%)
  const steps: PaletteStep[] = SHADE_STOPS.map(shade => {
    const targetLightness = LIGHTNESS_TARGETS[shade]!;
    const saturation = shade <= 100 ? 4 : shade >= 800 ? 8 : 6;
    const figmaColor = hslToFigma(hsl.h, saturation, targetLightness);
    return {
      shade,
      color: figmaToAllFormats(figmaColor),
    };
  });

  return {
    baseName: name,
    baseHex: primaryHex,
    steps,
  };
}
