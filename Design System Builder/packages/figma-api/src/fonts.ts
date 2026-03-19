/**
 * Fonts API — Font loading and availability checking.
 *
 * ES2017-compatible (Figma QuickJS sandbox).
 *
 * @module figma-api/fonts
 */

import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: FONT LOADING
// ============================================================================

/**
 * Load a font for use in text operations.
 *
 * @param family - Font family name (e.g., "Inter", "Roboto").
 * @param style - Font style (e.g., "Regular", "Bold", "Medium"). Default: "Regular".
 */
export async function loadFont(
  family: string,
  style?: string
): Promise<Result<void, string>> {
  var fontName: FontName = { family: family, style: style || 'Regular' };
  try {
    await figma.loadFontAsync(fontName);
    return R.ok(undefined);
  } catch (e) {
    return R.err(
      'Failed to load font "' + family + ' ' + (style || 'Regular') + '". ' +
      'Make sure it is installed on your machine or available in Figma.'
    );
  }
}

/**
 * Load multiple fonts at once.
 *
 * @param fonts - Array of { family, style } to load.
 * @returns Ok if all fonts loaded, Err with the first failure.
 */
export async function loadFonts(
  fonts: ReadonlyArray<{ family: string; style?: string }>
): Promise<Result<void, string>> {
  for (var i = 0; i < fonts.length; i++) {
    var result = await loadFont(fonts[i]!.family, fonts[i]!.style);
    if (!result.ok) return result;
  }
  return R.ok(undefined);
}

// ============================================================================
// SECTION 2: FONT AVAILABILITY CHECK
// ============================================================================

export interface FontCheckResult {
  readonly family: string;
  readonly style: string;
  readonly available: boolean;
  readonly error?: string;
}

/**
 * Check if a font is available by attempting to load it.
 *
 * Note: Figma doesn't have a "check availability" API — we have to
 * attempt to load and see if it succeeds.
 */
export async function checkFontAvailability(
  family: string,
  style?: string
): Promise<FontCheckResult> {
  var fontStyle = style || 'Regular';
  var result = await loadFont(family, fontStyle);
  return {
    family: family,
    style: fontStyle,
    available: result.ok,
    error: result.ok ? undefined : result.error,
  };
}

/**
 * Check availability of multiple fonts.
 */
export async function checkFontsAvailability(
  fonts: ReadonlyArray<{ family: string; style?: string }>
): Promise<FontCheckResult[]> {
  var results: FontCheckResult[] = [];
  for (var i = 0; i < fonts.length; i++) {
    var result = await checkFontAvailability(fonts[i]!.family, fonts[i]!.style);
    results.push(result);
  }
  return results;
}

/**
 * Get a list of all missing fonts from the given list.
 */
export async function getMissingFonts(
  fonts: ReadonlyArray<{ family: string; style?: string }>
): Promise<FontCheckResult[]> {
  var results = await checkFontsAvailability(fonts);
  return results.filter(function(r) { return !r.available; });
}
