/**
 * Styles API — Wrappers for Figma Style operations.
 *
 * Creates and manages Color, Text, Effect, and Grid styles.
 * ES2017-compatible (Figma QuickJS sandbox).
 *
 * @module figma-api/styles
 */

import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: COLOR STYLES
// ============================================================================

/**
 * Create a color style with the given name and RGBA value.
 *
 * @param name - Style name (e.g., "primary/500" or "bg/surface").
 * @param color - Figma RGBA (0-1 range).
 */
export function createColorStyle(
  name: string,
  color: RGBA
): Result<PaintStyle, string> {
  try {
    var style = figma.createPaintStyle();
    style.name = name;
    style.paints = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: color.a }];
    return R.ok(style);
  } catch (e) {
    return R.err('Failed to create color style "' + name + '": ' + String(e));
  }
}

/**
 * Update an existing color style's paint.
 */
export function updateColorStyle(
  style: PaintStyle,
  color: RGBA
): Result<void, string> {
  try {
    style.paints = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: color.a }];
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to update color style "' + style.name + '": ' + String(e));
  }
}

// ============================================================================
// SECTION 2: TEXT STYLES
// ============================================================================

export interface TextStyleConfig {
  readonly name: string;
  readonly fontFamily: string;
  readonly fontStyle?: string;
  readonly fontSize: number;
  readonly lineHeight?: number | { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  readonly letterSpacing?: number;
  readonly fontWeight?: number;
}

/**
 * Create a text style. Requires the font to be loaded first.
 */
export async function createTextStyle(
  config: TextStyleConfig
): Promise<Result<TextStyle, string>> {
  try {
    var fontName: FontName = {
      family: config.fontFamily,
      style: config.fontStyle || 'Regular',
    };

    await figma.loadFontAsync(fontName);

    var style = figma.createTextStyle();
    style.name = config.name;
    style.fontName = fontName;
    style.fontSize = config.fontSize;

    if (config.lineHeight !== undefined) {
      if (typeof config.lineHeight === 'number') {
        // Interpret as a multiplier (e.g., 1.5 → 150%)
        style.lineHeight = { value: config.lineHeight * 100, unit: 'PERCENT' };
      } else {
        style.lineHeight = config.lineHeight;
      }
    }

    if (config.letterSpacing !== undefined) {
      style.letterSpacing = { value: config.letterSpacing, unit: 'PIXELS' };
    }

    return R.ok(style);
  } catch (e) {
    return R.err('Failed to create text style "' + config.name + '": ' + String(e));
  }
}

// ============================================================================
// SECTION 3: EFFECT STYLES
// ============================================================================

export interface ShadowConfig {
  readonly name: string;
  readonly shadows: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly blur: number;
    readonly spread: number;
    readonly color: RGBA;
  }>;
}

/**
 * Create an effect style (drop shadows).
 */
export function createEffectStyle(
  config: ShadowConfig
): Result<EffectStyle, string> {
  try {
    var style = figma.createEffectStyle();
    style.name = config.name;
    style.effects = config.shadows.map(function(s) {
      return {
        type: 'DROP_SHADOW' as const,
        visible: true,
        blendMode: 'NORMAL' as const,
        offset: { x: s.x, y: s.y },
        radius: s.blur,
        spread: s.spread,
        color: s.color,
      };
    });
    return R.ok(style);
  } catch (e) {
    return R.err('Failed to create effect style "' + config.name + '": ' + String(e));
  }
}

// ============================================================================
// SECTION 4: GRID STYLES
// ============================================================================

export interface GridConfig {
  readonly name: string;
  readonly columns: number;
  readonly gutterSize: number;
  readonly margin: number;
  readonly alignment: 'MIN' | 'MAX' | 'CENTER' | 'STRETCH';
}

/**
 * Create a grid style.
 */
export function createGridStyle(
  config: GridConfig
): Result<GridStyle, string> {
  try {
    var style = figma.createGridStyle();
    style.name = config.name;
    style.layoutGrids = [{
      pattern: 'COLUMNS',
      alignment: config.alignment,
      count: config.columns,
      gutterSize: config.gutterSize,
      offset: config.margin,
      sectionSize: 0,
      visible: true,
      color: { r: 1, g: 0, b: 0, a: 0.1 },
    }];
    return R.ok(style);
  } catch (e) {
    return R.err('Failed to create grid style "' + config.name + '": ' + String(e));
  }
}

// ============================================================================
// SECTION 5: STYLE QUERIES
// ============================================================================

/**
 * Get all local paint styles.
 */
export async function getColorStyles(): Promise<Result<PaintStyle[], string>> {
  try {
    var styles = await figma.getLocalPaintStylesAsync();
    return R.ok(styles);
  } catch (e) {
    return R.err('Failed to get color styles: ' + String(e));
  }
}

/**
 * Get all local text styles.
 */
export async function getTextStyles(): Promise<Result<TextStyle[], string>> {
  try {
    var styles = await figma.getLocalTextStylesAsync();
    return R.ok(styles);
  } catch (e) {
    return R.err('Failed to get text styles: ' + String(e));
  }
}

/**
 * Get all local effect styles.
 */
export async function getEffectStyles(): Promise<Result<EffectStyle[], string>> {
  try {
    var styles = await figma.getLocalEffectStylesAsync();
    return R.ok(styles);
  } catch (e) {
    return R.err('Failed to get effect styles: ' + String(e));
  }
}

/**
 * Delete a style by removing it.
 */
export function deleteStyle(style: BaseStyle): Result<void, string> {
  try {
    style.remove();
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to delete style "' + style.name + '": ' + String(e));
  }
}
