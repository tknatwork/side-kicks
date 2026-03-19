/**
 * Style Generator — Generates Figma style definitions from resolved
 * variable collections.
 *
 * This is a pure computation module: it takes variable data (resolved values)
 * and produces style definitions. It does NOT call the Figma API directly —
 * the builder plugin's handlers consume the output and create actual styles.
 *
 * @module core/styles/style-generator
 */

import { Result } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface ResolvedVariable {
  readonly name: string;
  readonly type: 'color' | 'float' | 'string' | 'boolean';
  readonly values: Record<string, unknown>;
  /** Resolved concrete values per mode (after chasing aliases) */
  readonly resolvedValues: Record<string, unknown>;
  readonly collectionName: string;
}

export interface ColorStyleDef {
  readonly kind: 'color';
  readonly name: string;
  readonly color: { r: number; g: number; b: number; a: number };
  readonly mode: string;
  readonly sourceVariable: string;
}

export interface TextStyleDef {
  readonly kind: 'text';
  readonly name: string;
  readonly fontFamily: string;
  readonly fontStyle: string;
  readonly fontSize: number;
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
  readonly mode: string;
  readonly sourceVariable: string;
}

export interface EffectStyleDef {
  readonly kind: 'effect';
  readonly name: string;
  readonly shadows: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly blur: number;
    readonly spread: number;
    readonly color: { r: number; g: number; b: number; a: number };
  }>;
  readonly mode: string;
  readonly sourceVariable: string;
}

export interface GridStyleDef {
  readonly kind: 'grid';
  readonly name: string;
  readonly columns: number;
  readonly gutterSize: number;
  readonly margin: number;
  readonly alignment: 'MIN' | 'CENTER' | 'STRETCH';
  readonly mode: string;
  readonly sourceVariable: string;
}

export type StyleDef = ColorStyleDef | TextStyleDef | EffectStyleDef | GridStyleDef;

export interface FontRequirement {
  readonly family: string;
  readonly style: string;
}

export interface StyleGenerationPlan {
  readonly collectionName: string;
  readonly modes: string[];
  readonly styles: StyleDef[];
  readonly requiredFonts: FontRequirement[];
  readonly stats: {
    readonly colorStyles: number;
    readonly textStyles: number;
    readonly effectStyles: number;
    readonly gridStyles: number;
    readonly total: number;
  };
}

export interface StyleGenerationConfig {
  /** Only generate for these modes. If empty, generates for all. */
  readonly modes?: string[];
  /** Style name prefix (e.g. "DS/") */
  readonly prefix?: string;
  /** Include mode name in style name (default: true when >1 mode) */
  readonly includeModeInName?: boolean;
  /** Default font family for text styles when no companion variable found */
  readonly defaultFontFamily?: string;
  /** Default font style (weight) */
  readonly defaultFontStyle?: string;
  /** Skip categories */
  readonly skipColors?: boolean;
  readonly skipText?: boolean;
  readonly skipEffects?: boolean;
  readonly skipGrids?: boolean;
}

// ============================================================================
// SECTION 2: CATEGORY DETECTION
// ============================================================================

/**
 * Infer what style kind a variable should produce based on type and name.
 */
function detectCategory(
  name: string,
  type: string
): 'color' | 'text' | 'effect' | 'grid' | 'skip' {
  var lower = name.toLowerCase();

  if (type === 'color' || type === 'COLOR') {
    return 'color';
  }

  if (type === 'float' || type === 'FLOAT') {
    if (lower.indexOf('font') !== -1 && lower.indexOf('size') !== -1) return 'text';
    if (lower.indexOf('type') !== -1 && lower.indexOf('size') !== -1) return 'text';
    if (lower.indexOf('shadow') !== -1) return 'effect';
    if (lower.indexOf('elevation') !== -1) return 'effect';
    if (lower.indexOf('grid') !== -1) return 'grid';
    if (lower.indexOf('column') !== -1) return 'grid';
    return 'skip';
  }

  if (type === 'string' || type === 'STRING') {
    if (lower.indexOf('font') !== -1 && lower.indexOf('family') !== -1) return 'text';
    return 'skip';
  }

  return 'skip';
}

// ============================================================================
// SECTION 3: PLAN BUILDER
// ============================================================================

/**
 * Build a style generation plan from resolved variable data.
 *
 * This is a pure function — no Figma API calls. The builder plugin resolves
 * variables and passes the resolved data here.
 *
 * @param variables - Resolved variables from a single collection.
 * @param modes - Mode names available in the collection.
 * @param collectionName - Name of the source collection.
 * @param config - Generation configuration.
 */
export function buildStylePlan(
  variables: ReadonlyArray<ResolvedVariable>,
  modes: ReadonlyArray<string>,
  collectionName: string,
  config?: StyleGenerationConfig
): Result<StyleGenerationPlan, string> {
  var cfg = config || {};
  var prefix = cfg.prefix || '';
  var defaultFont = cfg.defaultFontFamily || 'Inter';
  var defaultFontStyle = cfg.defaultFontStyle || 'Regular';

  // Filter modes
  var targetModes = cfg.modes && cfg.modes.length > 0
    ? modes.filter(function(m) { return cfg.modes!.indexOf(m) !== -1; })
    : modes.slice();

  if (targetModes.length === 0) {
    return Result.err(
      'No matching modes found. Available: ' + modes.join(', ')
    );
  }

  var includeMode = cfg.includeModeInName !== undefined
    ? cfg.includeModeInName
    : targetModes.length > 1;

  var styles: StyleDef[] = [];
  var fontSet: Record<string, FontRequirement> = {};
  var colorCount = 0;
  var textCount = 0;
  var effectCount = 0;
  var gridCount = 0;

  // Build a lookup for companion font-family variables
  var fontFamilyLookup: Record<string, ResolvedVariable> = {};
  for (var fli = 0; fli < variables.length; fli++) {
    var flVar = variables[fli]!;
    var flLower = flVar.name.toLowerCase();
    if (flLower.indexOf('font') !== -1 && flLower.indexOf('family') !== -1) {
      fontFamilyLookup[flVar.name] = flVar;
    }
  }

  for (var vi = 0; vi < variables.length; vi++) {
    var variable = variables[vi]!;
    var category = detectCategory(variable.name, variable.type);

    if (category === 'skip') continue;
    if (category === 'color' && cfg.skipColors) continue;
    if (category === 'text' && cfg.skipText) continue;
    if (category === 'effect' && cfg.skipEffects) continue;
    if (category === 'grid' && cfg.skipGrids) continue;

    for (var mi = 0; mi < targetModes.length; mi++) {
      var modeName = targetModes[mi]!;
      var resolved = variable.resolvedValues[modeName];
      if (resolved === undefined || resolved === null) continue;

      var styleName = prefix;
      if (includeMode) {
        styleName += modeName + '/';
      }
      styleName += variable.name;

      if (category === 'color') {
        var c = resolved as { r: number; g: number; b: number; a?: number };
        styles.push({
          kind: 'color',
          name: styleName,
          color: { r: c.r, g: c.g, b: c.b, a: c.a !== undefined ? c.a : 1 },
          mode: modeName,
          sourceVariable: variable.name,
        });
        colorCount++;
      }

      if (category === 'text') {
        var fontSize = resolved as number;
        var fontFamily = defaultFont;

        // Try companion font-family variable
        var companionName = variable.name
          .replace(/size/i, 'family')
          .replace(/Size/, 'Family');
        var companion = fontFamilyLookup[companionName];
        if (companion && companion.resolvedValues[modeName]) {
          var familyVal = companion.resolvedValues[modeName];
          if (typeof familyVal === 'string') {
            fontFamily = familyVal;
          }
        }

        var fontKey = fontFamily + '/' + defaultFontStyle;
        if (!fontSet[fontKey]) {
          fontSet[fontKey] = { family: fontFamily, style: defaultFontStyle };
        }

        styles.push({
          kind: 'text',
          name: styleName,
          fontFamily: fontFamily,
          fontStyle: defaultFontStyle,
          fontSize: fontSize,
          mode: modeName,
          sourceVariable: variable.name,
        });
        textCount++;
      }

      if (category === 'effect') {
        var shadowVal = resolved as number;
        styles.push({
          kind: 'effect',
          name: styleName,
          shadows: [{
            x: 0,
            y: Math.round(shadowVal * 0.5),
            blur: shadowVal,
            spread: 0,
            color: { r: 0, g: 0, b: 0, a: 0.15 },
          }],
          mode: modeName,
          sourceVariable: variable.name,
        });
        effectCount++;
      }

      if (category === 'grid') {
        var gridVal = resolved as number;
        styles.push({
          kind: 'grid',
          name: styleName,
          columns: 12,
          gutterSize: gridVal,
          margin: Math.round(gridVal * 1.5),
          alignment: 'STRETCH',
          mode: modeName,
          sourceVariable: variable.name,
        });
        gridCount++;
      }
    }
  }

  var requiredFonts: FontRequirement[] = [];
  var fontKeys = Object.keys(fontSet);
  for (var fi = 0; fi < fontKeys.length; fi++) {
    requiredFonts.push(fontSet[fontKeys[fi]!]!);
  }

  return Result.ok({
    collectionName: collectionName,
    modes: targetModes,
    styles: styles,
    requiredFonts: requiredFonts,
    stats: {
      colorStyles: colorCount,
      textStyles: textCount,
      effectStyles: effectCount,
      gridStyles: gridCount,
      total: colorCount + textCount + effectCount + gridCount,
    },
  });
}
