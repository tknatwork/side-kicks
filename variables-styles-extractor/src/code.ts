/**
 * ☕️ Variables & Styles Extractor - Figma Plugin
 * Export and import Figma variables and styles with full fidelity
 * 
 * @copyright 2025 Tushar Kant Naik / The Keep Collective
 * @license MIT - See LICENSE file
 * @version 2.0.0
 * @author Tushar Kant Naik <hi@tusharkantnaik.com>
 * @website https://tusharkantnaik.com
 */

// JSF-AV Compliant Architecture
// v2.0.0: Wide 4-column layout (1200x628px content area, 680px with Figma title bar)
figma.showUI(__html__, { 
  width: 1200, 
  height: 628,
  themeColors: true,
  title: '☕️ Variables & Styles Extractor v2.0.0'
});

// ============================================================================
// SECTION 1: RESULT TYPE PATTERN (JSF Rule 4.13 - Explicit Error Handling)
// ============================================================================

interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

interface Failure<E> {
  readonly ok: false;
  readonly error: E;
}

type Result<T, E = string> = Success<T> | Failure<E>;

const Result = {
  ok: <T>(value: T): Success<T> => ({ ok: true, value }),
  err: <E>(error: E): Failure<E> => ({ ok: false, error }),
} as const;

// ============================================================================
// SECTION 2: TYPE DEFINITIONS (JSF Rule 4.9 - Strong Typing)
// ============================================================================

// Color format discriminated union
interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a?: number;
}

interface HslColor {
  readonly h: number;
  readonly s: number;
  readonly l: number;
  readonly a?: number;
}

interface HsbColor {
  readonly h: number;
  readonly s: number;
  readonly b: number;
  readonly a?: number;
}

interface ExportColorValue {
  readonly hex: string;
  readonly rgb: RgbColor;
  readonly css: string;
  readonly hsl: HslColor;
  readonly hsb: HsbColor;
}

// Variable value types
type VariableValueType = 'color' | 'float' | 'string' | 'boolean';

interface ExportVariableValue {
  readonly $scopes: readonly string[];
  readonly $type: VariableValueType;
  readonly $description?: string;
  readonly $value: string | number | boolean | ExportColorValue;
  readonly $libraryName?: string;
  readonly $collectionName?: string;
  readonly $libraryRef?: string;
  readonly $localValue?: string | number | boolean | ExportColorValue;
}

interface NestedVariables {
  [key: string]: ExportVariableValue | NestedVariables;
}

interface ModeVariables {
  [modeName: string]: NestedVariables;
}

interface CollectionExport {
  [collectionName: string]: {
    modes: ModeVariables;
    $originalName?: string;  // For round-trip: stores original Figma name when naming convention is applied
  };
}

// Variable binding
interface VariableBinding {
  readonly id?: string;
  readonly name?: string;
  readonly collection?: string;
}

// Style export interfaces

// Gradient stop for linear/radial/angular/diamond gradients
interface ExportGradientStop {
  readonly position: number;
  readonly color: ExportColorValue;
}

// Gradient paint data
interface ExportGradientPaint {
  readonly type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND';
  readonly gradientStops: readonly ExportGradientStop[];
  readonly gradientTransform?: readonly [readonly [number, number, number], readonly [number, number, number]];
  readonly opacity?: number;
}

// Image paint data
interface ExportImagePaint {
  readonly type: 'IMAGE';
  readonly scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE';
  readonly imageHash?: string;
  readonly imageBase64?: string; // Base64 encoded image data
  readonly opacity?: number;
  readonly rotation?: number;
  readonly filters?: Readonly<{
    exposure?: number;
    contrast?: number;
    saturation?: number;
    temperature?: number;
    tint?: number;
    highlights?: number;
    shadows?: number;
  }>;
}

// Solid paint data
interface ExportSolidPaint {
  readonly type: 'SOLID';
  readonly color: ExportColorValue;
  readonly opacity?: number;
}

// Union type for all paint types
type ExportPaintData = ExportSolidPaint | ExportGradientPaint | ExportImagePaint;

interface ExportColorStyle {
  readonly name: string;
  readonly description?: string;
  readonly paints: readonly ExportPaintData[];
  // Legacy fields for backward compatibility with single solid color styles
  readonly color?: ExportColorValue;
  readonly opacity?: number;
  readonly boundVariables?: Readonly<Record<string, VariableBinding>>;
}

interface ExportTextStyle {
  readonly name: string;
  readonly description?: string;
  readonly fontFamily: string;
  readonly fontStyle: string;
  readonly fontSize: number;
  readonly fontWeight?: number;
  readonly lineHeight: LineHeight;
  readonly letterSpacing: LetterSpacing;
  readonly textCase?: string;
  readonly textDecoration?: string;
  readonly boundVariables?: Readonly<Record<string, VariableBinding>>;
}

interface ExportEffectData {
  readonly type: string;
  readonly color?: ExportColorValue;
  readonly offset?: Readonly<{ x: number; y: number }>;
  readonly radius?: number;
  readonly spread?: number;
  readonly visible?: boolean;
  readonly blendMode?: string;
  readonly showShadowBehindNode?: boolean;
  readonly boundVariables?: Readonly<Record<string, VariableBinding>>;
}

interface ExportEffectStyle {
  readonly name: string;
  readonly description?: string;
  readonly effects: readonly ExportEffectData[];
  readonly boundVariables?: Readonly<Record<string, VariableBinding>>;
}

interface ExportGridData {
  readonly pattern: string;
  readonly sectionSize?: number;
  readonly gutterSize?: number;
  readonly count?: number;
  readonly offset?: number;
  readonly alignment?: string;
  readonly color?: ExportColorValue;
  readonly visible?: boolean;
  readonly boundVariables?: Readonly<Record<string, VariableBinding>>;
}

interface ExportGridStyle {
  readonly name: string;
  readonly description?: string;
  readonly layoutGrids: readonly ExportGridData[];
}

interface StylesExport {
  colorStyles?: ExportColorStyle[];
  textStyles?: ExportTextStyle[];
  effectStyles?: ExportEffectStyle[];
  gridStyles?: ExportGridStyle[];
}

interface StyleOptions {
  readonly colorStyles: boolean;
  readonly textStyles: boolean;
  readonly effectStyles: boolean;
  readonly gridStyles: boolean;
}

type ExportFormat = (CollectionExport | { _styles: StylesExport })[];

// Naming conventions for code-friendly export
type NamingConvention = 'original' | 'camelCase' | 'kebab-case' | 'snake_case';

// Export format types
type ExportFormatType = 'figma' | 'w3c';

// Import options
interface ImportOptions {
  readonly merge: boolean;
  readonly overwrite: boolean;
  readonly importStyles?: boolean;
  readonly useLibraryRefs?: boolean;
  readonly clearFirst?: boolean;  // Clean Import: clear existing before import
  readonly customMerge?: {  // Custom Merge: selectively clear variables and/or styles
    readonly clearVariables: boolean;
    readonly clearStyles: boolean;
  } | null;
  readonly collectionBehaviors?: Record<string, 'merge' | 'replace'> | null;  // Per-collection behavior (Advanced mode)
}

// Undo snapshot for restoring file state
interface UndoSnapshot {
  readonly timestamp: number;
  readonly collections: string;  // JSON stringified export data
  readonly styles: string;       // JSON stringified styles data
}

// Stats
interface ExportStats {
  readonly collections: number;
  readonly variables: number;
  readonly styles: {
    readonly color: number;
    readonly text: number;
    readonly effect: number;
    readonly grid: number;
  } | null;
}

interface ImportStats {
  readonly collectionsCreated: number;
  readonly variablesCreated: number;
  readonly variablesUpdated: number;
  readonly variablesSkipped: number;
  readonly stylesCreated: number;
  readonly stylesUpdated: number;
}

// Plan limits detection
type FigmaPlan = 'starter' | 'professional' | 'organization' | 'enterprise';

interface PlanLimits {
  readonly plan: FigmaPlan;
  readonly maxModesPerCollection: number;
  readonly canPublishLibraries: boolean;
  readonly hasVariableRestApi: boolean;
}

interface PlanValidation {
  readonly currentPlan: PlanLimits;
  readonly existing: {
    readonly collections: number;
    readonly maxModesInAnyCollection: number;
    readonly totalVariables: number;
  };
  readonly importing: {
    readonly collections: number;
    readonly maxModesInAnyCollection: number;
    readonly totalVariables: number;
    readonly collectionsExceedingModeLimit: string[];
  };
  readonly warnings: string[];
  readonly errors: string[];
  readonly canImport: boolean;
  readonly libraryDependencies?: {
    readonly variableCount: number;
    readonly collections: string[];
  };
  readonly fontDependencies?: {
    readonly styleCount: number;
    readonly fonts: Array<{ family: string; style: string }>;
  };
}

// ============================================================================
// SECTION 3: UTILITY FUNCTIONS (JSF Rule 4.15 - DRY)
// ============================================================================

const Logger = {
  log(message: string, data?: unknown): void {
    console.log(`[Variables Extractor] ${message}`, data || '');
    figma.ui.postMessage({ type: 'log', message, data });
  },
  
  send(type: string, data: unknown): void {
    figma.ui.postMessage({ type, data });
  }
} as const;

// Plan limits by Figma subscription tier (verified from Figma documentation)
const PLAN_LIMITS: Record<FigmaPlan, Omit<PlanLimits, 'plan'>> = {
  starter: {
    maxModesPerCollection: 1,
    canPublishLibraries: false,
    hasVariableRestApi: false
  },
  professional: {
    maxModesPerCollection: 10,
    canPublishLibraries: true,
    hasVariableRestApi: false
  },
  organization: {
    maxModesPerCollection: 20,
    canPublishLibraries: true,
    hasVariableRestApi: false
  },
  enterprise: {
    maxModesPerCollection: Infinity,
    canPublishLibraries: true,
    hasVariableRestApi: true
  }
} as const;

// Maximum variables per collection (all plans)
const MAX_VARIABLES_PER_COLLECTION = 5000;

// Plan detection: Figma API doesn't expose plan directly, so we infer from existing modes
async function detectCurrentPlan(): Promise<PlanLimits> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  let maxModesFound = 1;
  
  for (const collection of collections) {
    if (collection.modes.length > maxModesFound) {
      maxModesFound = collection.modes.length;
    }
  }
  
  // Infer plan based on highest mode count found
  let inferredPlan: FigmaPlan;
  if (maxModesFound > 20) {
    inferredPlan = 'enterprise';
  } else if (maxModesFound > 10) {
    inferredPlan = 'organization';
  } else if (maxModesFound > 1) {
    inferredPlan = 'professional';
  } else {
    // Can't distinguish starter from others with 1 mode, assume professional
    // User can override in UI
    inferredPlan = 'professional';
  }
  
  return {
    plan: inferredPlan,
    ...PLAN_LIMITS[inferredPlan]
  };
}

// Validate import data against plan limits
async function validateImportAgainstPlan(
  importData: ExportFormat,
  planOverride?: FigmaPlan
): Promise<PlanValidation> {
  const currentPlan = planOverride 
    ? { plan: planOverride, ...PLAN_LIMITS[planOverride] }
    : await detectCurrentPlan();
  
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const existingMaxModes = collections.reduce(
    (max, col) => Math.max(max, col.modes.length), 
    0
  );
  const existingTotalVars = (await figma.variables.getLocalVariablesAsync()).length;
  
  // Analyze import data - it's an array of collection exports and possibly _styles
  const importCollections: CollectionExport[] = [];
  
  for (const item of importData) {
    // Skip _styles entries
    if ('_styles' in item) continue;
    importCollections.push(item as CollectionExport);
  }
  
  let importingMaxModes = 0;
  let importingTotalVars = 0;
  const collectionsExceedingModeLimit: string[] = [];
  
  for (const colExport of importCollections) {
    // Each collection export is { "CollectionName": { modes: {...} } }
    const colName = Object.keys(colExport)[0];
    const colData = colExport[colName];
    
    if (!colData || !colData.modes) continue;
    
    const modeCount = Object.keys(colData.modes).length;
    if (modeCount > importingMaxModes) {
      importingMaxModes = modeCount;
    }
    
    if (modeCount > currentPlan.maxModesPerCollection) {
      collectionsExceedingModeLimit.push(
        `"${colName}" (${modeCount} modes, limit: ${currentPlan.maxModesPerCollection === Infinity ? '∞' : currentPlan.maxModesPerCollection})`
      );
    }
    
    // Count variables in first mode (they're the same across modes)
    const firstMode = Object.values(colData.modes)[0];
    if (firstMode) {
      importingTotalVars += countNestedVariables(firstMode);
    }
  }
  
  // Generate warnings and errors
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Mode limits - not a hard error, UI will show mode selection
  // Only warn, don't block - user can select which modes to import
  if (collectionsExceedingModeLimit.length > 0) {
    // This is handled by the UI with mode selection
    // Don't add to errors, just track in collectionsExceedingModeLimit
  }
  
  // Check variable count per collection - this IS a hard limit
  for (const colExport of importCollections) {
    const colName = Object.keys(colExport)[0];
    const colData = colExport[colName];
    
    if (!colData || !colData.modes) continue;
    
    const firstMode = Object.values(colData.modes)[0];
    const varCount = firstMode ? countNestedVariables(firstMode) : 0;
    
    if (varCount > MAX_VARIABLES_PER_COLLECTION) {
      errors.push(
        `Collection "${colName}" has ${varCount} variables, exceeds limit of ${MAX_VARIABLES_PER_COLLECTION}`
      );
    }
  }
  
  // Warnings for large imports
  if (importingTotalVars > 1000) {
    warnings.push(`Large import: ${importingTotalVars} variables. This may take a moment.`);
  }
  
  if (importCollections.length > 10) {
    warnings.push(`Importing ${importCollections.length} collections. Consider importing in batches.`);
  }
  
  // Detect library dependencies (variables that reference external collections)
  const libraryCollections = new Set<string>();
  let libraryVarCount = 0;
  
  for (const colExport of importCollections) {
    const colName = Object.keys(colExport)[0];
    const colData = colExport[colName];
    
    if (!colData || !colData.modes) continue;
    
    for (const modeName of Object.keys(colData.modes)) {
      const modeData = colData.modes[modeName];
      const variables = flattenVariables(modeData, '');
      
      for (const { value } of variables) {
        if (value.$libraryRef && value.$collectionName) {
          libraryCollections.add(value.$collectionName);
          libraryVarCount++;
        }
      }
    }
  }
  
  // Detect font dependencies from text styles
  const fontDeps: Array<{ family: string; style: string }> = [];
  let fontStyleCount = 0;
  
  // Check for _styles in import data
  for (const item of importData) {
    if ('_styles' in item) {
      const stylesData = (item as { _styles: StylesExport })._styles;
      if (stylesData.textStyles) {
        for (const textStyle of stylesData.textStyles) {
          fontStyleCount++;
          const fontKey = `${textStyle.fontFamily}|${textStyle.fontStyle}`;
          if (!fontDeps.some(f => `${f.family}|${f.style}` === fontKey)) {
            fontDeps.push({ family: textStyle.fontFamily, style: textStyle.fontStyle });
          }
        }
      }
    }
  }
  
  // canImport is true if no hard errors (variable count)
  // Mode limit exceedance is handled by UI with mode selection
  return {
    currentPlan,
    existing: {
      collections: collections.length,
      maxModesInAnyCollection: existingMaxModes,
      totalVariables: existingTotalVars
    },
    importing: {
      collections: importCollections.length,
      maxModesInAnyCollection: importingMaxModes,
      totalVariables: importingTotalVars,
      collectionsExceedingModeLimit
    },
    warnings,
    errors,
    canImport: errors.length === 0,
    ...(libraryCollections.size > 0 && {
      libraryDependencies: {
        variableCount: libraryVarCount,
        collections: Array.from(libraryCollections)
      }
    }),
    ...(fontDeps.length > 0 && {
      fontDependencies: {
        styleCount: fontStyleCount,
        fonts: fontDeps
      }
    })
  };
}

// Helper to count nested variables in a mode object
function countNestedVariables(obj: NestedVariables, count = 0): number {
  for (const [, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') {
      if ('$type' in value && '$value' in value) {
        // This is a variable
        count++;
      } else {
        // Nested group
        count = countNestedVariables(value as NestedVariables, count);
      }
    }
  }
  
  return count;
}

const MathUtils = {
  round2(value: number): number {
    return Math.round(value * 100) / 100;
  },
  
  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  },
  
  toHexByte(value: number): string {
    return Math.round(value * 255).toString(16).padStart(2, '0');
  },
  
  fromHexByte(hex: string): number {
    return parseInt(hex, 16) / 255;
  }
} as const;

// ============================================================================
// SECTION 4: COLOR CONVERSION MODULE (JSF Rule 4.7 - Single Responsibility)
// ============================================================================

// Shared hue calculation - eliminates duplication between HSL/HSB
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

const ColorConverter = {
  // Figma RGB (0-1) → Hex
  toHex(color: RGB | RGBA): string {
    const hex = '#' + 
      MathUtils.toHexByte(color.r) + 
      MathUtils.toHexByte(color.g) + 
      MathUtils.toHexByte(color.b);
    
    const alpha = (color as RGBA).a;
    if (alpha !== undefined && alpha < 1) {
      return hex + MathUtils.toHexByte(alpha);
    }
    return hex;
  },

  // Figma RGB (0-1) → RGB (0-255)
  toRgb255(color: RGB | RGBA): RgbColor {
    const result: RgbColor = {
      r: Math.round(color.r * 255),
      g: Math.round(color.g * 255),
      b: Math.round(color.b * 255)
    };
    
    const alpha = (color as RGBA).a;
    if (alpha !== undefined && alpha < 1) {
      return { ...result, a: MathUtils.round2(alpha) };
    }
    return result;
  },

  // Figma RGB (0-1) → CSS string
  toCss(color: RGB | RGBA): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const alpha = (color as RGBA).a;
    const a = alpha !== undefined ? MathUtils.round2(alpha) : 1;
    
    return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
  },

  // Figma RGB (0-1) → HSL
  toHsl(color: RGB | RGBA): HslColor {
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
      l: Math.round(l * 100)
    };
    
    const alpha = (color as RGBA).a;
    if (alpha !== undefined && alpha < 1) {
      return { ...result, a: MathUtils.round2(alpha) };
    }
    return result;
  },

  // Figma RGB (0-1) → HSB/HSV
  toHsb(color: RGB | RGBA): HsbColor {
    const { r, g, b } = color;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const s = max === 0 ? 0 : (max - min) / max;
    
    const result: HsbColor = {
      h: calculateHue(r, g, b, max, min),
      s: Math.round(s * 100),
      b: Math.round(max * 100)
    };
    
    const alpha = (color as RGBA).a;
    if (alpha !== undefined && alpha < 1) {
      return { ...result, a: MathUtils.round2(alpha) };
    }
    return result;
  },

  // Master export function - all formats
  toAllFormats(color: RGB | RGBA): ExportColorValue {
    return {
      hex: this.toHex(color),
      rgb: this.toRgb255(color),
      css: this.toCss(color),
      hsl: this.toHsl(color),
      hsb: this.toHsb(color)
    };
  }
} as const;

// ============================================================================
// SECTION 4B: NAMING CONVENTION CONVERTER
// ============================================================================

const NamingConverter = {
  // Convert name to specified convention
  convert(name: string, convention: NamingConvention): string {
    if (convention === 'original') return name;
    
    // Split by common separators (space, /, -, _)
    const words = name
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // Split camelCase
      .split(/[\s\/\-_]+/)
      .filter(w => w.length > 0)
      .map(w => w.toLowerCase());
    
    if (words.length === 0) return name;
    
    switch (convention) {
      case 'camelCase':
        return words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      
      case 'kebab-case':
        return words.join('-');
      
      case 'snake_case':
        return words.join('_');
      
      default:
        return name;
    }
  },
  
  // Convert a variable path (e.g., "Colors/Primary/Base" → "colors/primary/base" or "colors.primary.base")
  convertPath(path: string, convention: NamingConvention): string {
    if (convention === 'original') return path;
    
    return path
      .split('/')
      .map(part => this.convert(part, convention))
      .join('/');
  },
  
  // Convert collection name
  convertCollectionName(name: string, convention: NamingConvention): string {
    return this.convert(name, convention);
  },
  
  // Convert mode name
  convertModeName(name: string, convention: NamingConvention): string {
    return this.convert(name, convention);
  },
  
  // Store original names for round-trip - adds $originalName field
  addOriginalName(name: string, convention: NamingConvention): { converted: string; original?: string } {
    if (convention === 'original') {
      return { converted: name };
    }
    const converted = this.convert(name, convention);
    if (converted === name) {
      return { converted: name };
    }
    return { converted, original: name };
  }
} as const;

// Helper function to resolve alias value recursively
async function resolveAliasValue(variable: Variable, preferredModeId: string, maxDepth: number = 10): Promise<string | number | boolean | RGBA> {
  if (maxDepth <= 0) {
    Logger.log(`⚠️ Max alias resolution depth reached for ${variable.name}`);
    return '';
  }
  
  // Try to get value for preferred mode, fallback to first available mode
  let value = variable.valuesByMode[preferredModeId];
  if (value === undefined) {
    const modeIds = Object.keys(variable.valuesByMode);
    if (modeIds.length > 0) {
      value = variable.valuesByMode[modeIds[0]];
    }
  }
  
  if (value === undefined) {
    return '';
  }
  
  // If it's another alias, resolve recursively
  if (isVariableAlias(value)) {
    const nextVar = await figma.variables.getVariableByIdAsync(value.id);
    if (nextVar) {
      return resolveAliasValue(nextVar, preferredModeId, maxDepth - 1);
    }
    return '';
  }
  
  // Return the raw value
  return value as string | number | boolean | RGBA;
}

// ============================================================================
// SECTION 4C: W3C DESIGN TOKENS CONVERTER
// ============================================================================

// W3C Design Tokens type mapping
// https://design-tokens.github.io/community-group/format/
const W3C_TYPE_MAP: Record<string, string> = {
  'color': 'color',
  'float': 'number',
  'string': 'string',
  'boolean': 'boolean'
};

// W3C Design Token value interface
interface W3CToken {
  $value: string | number | boolean | Record<string, unknown>;
  $type: string;
  $description?: string;
  $extensions?: {
    'com.figma'?: {
      scopes?: string[];
      originalName?: string;
      collectionName?: string;
      hiddenFromPublishing?: boolean;
    };
  };
}

interface W3CTokenGroup {
  [key: string]: W3CToken | W3CTokenGroup | string | undefined;
}

const W3CConverter = {
  // Convert Figma color to W3C format (hex with alpha)
  colorToW3C(color: ExportColorValue): string {
    // W3C uses hex format, including alpha
    return color.hex;
  },
  
  // Convert Figma type to W3C type
  typeToW3C(figmaType: string): string {
    return W3C_TYPE_MAP[figmaType] || 'string';
  },
  
  // Convert export value to W3C format
  valueToW3C(value: ExportVariableValue, isAlias: boolean = false): W3CToken {
    const token: W3CToken = {
      $value: '',
      $type: this.typeToW3C(value.$type)
    };
    
    // Handle alias references - W3C uses {path.to.token} format
    if (isAlias && typeof value.$value === 'string' && value.$value.startsWith('{')) {
      token.$value = value.$value;
    } else if (value.$type === 'color' && typeof value.$value === 'object') {
      // Color value - use hex
      token.$value = (value.$value as ExportColorValue).hex;
    } else {
      token.$value = value.$value as string | number | boolean;
    }
    
    // Add description if present
    if (value.$description) {
      token.$description = value.$description;
    }
    
    // Add Figma-specific metadata in extensions
    if (value.$scopes && value.$scopes.length > 0 && !value.$scopes.includes('ALL_SCOPES')) {
      token.$extensions = {
        'com.figma': {
          scopes: value.$scopes as string[]
        }
      };
    }
    
    return token;
  },
  
  // Convert collection export to W3C format
  collectionToW3C(
    collectionName: string, 
    modes: ModeVariables, 
    namingConvention: NamingConvention,
    originalName?: string
  ): W3CTokenGroup {
    const group: W3CTokenGroup = {};
    
    // Add metadata as $description
    if (originalName && originalName !== collectionName) {
      group.$description = `Figma collection: ${originalName}`;
    }
    
    // For W3C, we typically flatten modes or use first mode
    // If multiple modes, create mode groups
    const modeNames = Object.keys(modes);
    
    if (modeNames.length === 1) {
      // Single mode - flatten directly
      this.addTokensToGroup(group, modes[modeNames[0]], namingConvention);
    } else {
      // Multiple modes - create mode subgroups
      for (const modeName of modeNames) {
        const convertedModeName = NamingConverter.convertModeName(modeName, namingConvention);
        group[convertedModeName] = {};
        this.addTokensToGroup(group[convertedModeName] as W3CTokenGroup, modes[modeName], namingConvention);
      }
    }
    
    return group;
  },
  
  // Recursively add tokens to a group
  addTokensToGroup(group: W3CTokenGroup, variables: NestedVariables, namingConvention: NamingConvention): void {
    for (const [key, value] of Object.entries(variables)) {
      const convertedKey = NamingConverter.convert(key, namingConvention);
      
      if (isExportVariableValue(value)) {
        // It's a token value
        const isAlias = typeof value.$value === 'string' && value.$value.startsWith('{');
        group[convertedKey] = this.valueToW3C(value, isAlias);
      } else {
        // It's a nested group
        group[convertedKey] = {};
        this.addTokensToGroup(group[convertedKey] as W3CTokenGroup, value as NestedVariables, namingConvention);
      }
    }
  },
  
  // Parse W3C token to Figma-compatible format
  parseW3CToken(token: W3CToken): ExportVariableValue {
    const figmaType = this.w3cTypeToFigma(token.$type);
    const scopes = token.$extensions?.['com.figma']?.scopes || ['ALL_SCOPES'];
    
    // Handle color values - convert hex to full color object
    let finalValue: string | number | boolean | ExportColorValue;
    if (figmaType === 'color' && typeof token.$value === 'string') {
      const rgba = ColorParser.parse(token.$value);
      finalValue = ColorConverter.toAllFormats(rgba);
    } else if (typeof token.$value === 'string' || typeof token.$value === 'number' || typeof token.$value === 'boolean') {
      finalValue = token.$value;
    } else {
      // For complex objects, stringify them
      finalValue = JSON.stringify(token.$value);
    }
    
    // Build result object with all properties at once (readonly-friendly)
    const result: ExportVariableValue = token.$description
      ? {
          $type: figmaType,
          $value: finalValue,
          $scopes: scopes,
          $description: token.$description
        }
      : {
          $type: figmaType,
          $value: finalValue,
          $scopes: scopes
        };
    
    return result;
  },
  
  // Convert W3C type back to Figma type
  w3cTypeToFigma(w3cType: string): VariableValueType {
    const map: Record<string, VariableValueType> = {
      'color': 'color',
      'number': 'float',
      'dimension': 'float',
      'string': 'string',
      'boolean': 'boolean',
      'fontFamily': 'string',
      'fontWeight': 'float',
      'duration': 'string',
      'cubicBezier': 'string'
    };
    return map[w3cType] || 'string';
  },
  
  // Detect if JSON is W3C format
  isW3CFormat(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) return false;
    
    // Check for W3C indicators:
    // 1. Root level $type or $value
    // 2. Nested objects with $value and $type
    const obj = data as Record<string, unknown>;
    
    // Check if any top-level key has $value (W3C token)
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        if ('$value' in value && '$type' in value) {
          return true;
        }
        // Check one level deeper
        for (const subKey of Object.keys(value as Record<string, unknown>)) {
          const subValue = (value as Record<string, unknown>)[subKey];
          if (typeof subValue === 'object' && subValue !== null && '$value' in subValue) {
            return true;
          }
        }
      }
    }
    
    // Check if it's our Figma format (array with collection objects)
    if (Array.isArray(data)) {
      return false; // Figma format is array
    }
    
    return false;
  },
  
  // Convert W3C format to Figma format for import
  w3cToFigmaFormat(w3cData: Record<string, W3CTokenGroup>): CollectionDataFormat[] {
    const result: CollectionDataFormat[] = [];
    
    for (const [collectionName, collectionGroup] of Object.entries(w3cData)) {
      // Skip $ prefixed metadata keys
      if (collectionName.startsWith('$')) continue;
      
      const collectionExport: CollectionDataFormat = {
        [collectionName]: {
          modes: {
            'Default': this.w3cGroupToNestedVars(collectionGroup)
          }
        }
      };
      
      result.push(collectionExport);
    }
    
    return result;
  },
  
  // Convert W3C group to nested variables
  w3cGroupToNestedVars(group: W3CTokenGroup): NestedVariables {
    const result: NestedVariables = {};
    
    for (const [key, value] of Object.entries(group)) {
      // Skip $ prefixed metadata
      if (key.startsWith('$')) continue;
      
      if (this.isW3CToken(value)) {
        // It's a token
        result[key] = this.parseW3CToken(value as W3CToken);
      } else if (typeof value === 'object' && value !== null) {
        // It's a group
        result[key] = this.w3cGroupToNestedVars(value as W3CTokenGroup);
      }
    }
    
    return result;
  },
  
  // Check if object is a W3C token
  isW3CToken(obj: unknown): boolean {
    return typeof obj === 'object' && obj !== null && '$value' in obj;
  }
} as const;

// Type for import compatibility
type CollectionDataFormat = {
  [collectionName: string]: {
    modes: ModeVariables;
    $originalName?: string;
  };
};

// ============================================================================
// SECTION 5: COLOR PARSING MODULE (JSF Rule 4.7)
// ============================================================================

const HEX_REGEX_8 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
const HEX_REGEX_6 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
const RGBA_REGEX = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i;
const HSLA_REGEX = /hsla?\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*(?:,\s*([\d.]+))?\s*\)/i;

const ColorParser = {
  // Hex → Figma RGBA
  fromHex(hex: string): RGBA {
    const match8 = HEX_REGEX_8.exec(hex);
    if (match8) {
      return {
        r: MathUtils.fromHexByte(match8[1]),
        g: MathUtils.fromHexByte(match8[2]),
        b: MathUtils.fromHexByte(match8[3]),
        a: MathUtils.fromHexByte(match8[4])
      };
    }
    
    const match6 = HEX_REGEX_6.exec(hex);
    if (match6) {
      return {
        r: MathUtils.fromHexByte(match6[1]),
        g: MathUtils.fromHexByte(match6[2]),
        b: MathUtils.fromHexByte(match6[3]),
        a: 1
      };
    }
    
    return { r: 0, g: 0, b: 0, a: 1 };
  },

  // RGB (0-255) → Figma RGBA
  fromRgb255(rgb: RgbColor): RGBA {
    return {
      r: rgb.r / 255,
      g: rgb.g / 255,
      b: rgb.b / 255,
      a: rgb.a ?? 1
    };
  },

  // CSS string → Figma RGBA
  fromCss(css: string): RGBA {
    const rgbaMatch = RGBA_REGEX.exec(css);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1], 10) / 255,
        g: parseInt(rgbaMatch[2], 10) / 255,
        b: parseInt(rgbaMatch[3], 10) / 255,
        a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
      };
    }
    
    const hslaMatch = HSLA_REGEX.exec(css);
    if (hslaMatch) {
      return this.fromHsl({
        h: parseInt(hslaMatch[1], 10),
        s: parseInt(hslaMatch[2], 10),
        l: parseInt(hslaMatch[3], 10),
        a: hslaMatch[4] !== undefined ? parseFloat(hslaMatch[4]) : 1
      });
    }
    
    return { r: 0, g: 0, b: 0, a: 1 };
  },

  // HSL → Figma RGBA
  fromHsl(hsl: HslColor): RGBA {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;
    
    if (s === 0) {
      return { r: l, g: l, b: l, a: hsl.a ?? 1 };
    }
    
    const hue2rgb = (p: number, q: number, t: number): number => {
      const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      if (tt < 1/6) return p + (q - p) * 6 * tt;
      if (tt < 1/2) return q;
      if (tt < 2/3) return p + (q - p) * (2/3 - tt) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    return {
      r: hue2rgb(p, q, h + 1/3),
      g: hue2rgb(p, q, h),
      b: hue2rgb(p, q, h - 1/3),
      a: hsl.a ?? 1
    };
  },

  // HSB → Figma RGBA
  fromHsb(hsb: HsbColor): RGBA {
    const h = hsb.h / 360;
    const s = hsb.s / 100;
    const v = hsb.b / 100;
    
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    
    const rgbMap: [number, number, number][] = [
      [v, t, p], [q, v, p], [p, v, t],
      [p, q, v], [t, p, v], [v, p, q]
    ];
    
    const [r, g, b] = rgbMap[i % 6];
    return { r, g, b, a: hsb.a ?? 1 };
  },

  // Universal parser - accepts any format
  parse(color: unknown): RGBA {
    // ExportColorValue object
    if (typeof color === 'object' && color !== null && 'hex' in color && 'rgb' in color) {
      return this.fromHex((color as ExportColorValue).hex);
    }
    
    // RGB object
    if (typeof color === 'object' && color !== null && 'r' in color && 'g' in color && 'b' in color) {
      const rgb = color as RgbColor;
      // Check if Figma native (0-1) or standard (0-255)
      if (rgb.r <= 1 && rgb.g <= 1 && rgb.b <= 1) {
        return { r: rgb.r, g: rgb.g, b: rgb.b, a: rgb.a ?? 1 };
      }
      return this.fromRgb255(rgb);
    }
    
    // HSL object
    if (typeof color === 'object' && color !== null && 'h' in color && 's' in color && 'l' in color) {
      return this.fromHsl(color as HslColor);
    }
    
    // HSB object
    if (typeof color === 'object' && color !== null && 'h' in color && 's' in color && 'b' in color) {
      return this.fromHsb(color as HsbColor);
    }
    
    // String formats
    if (typeof color === 'string') {
      if (color.startsWith('rgb') || color.startsWith('hsl')) {
        return this.fromCss(color);
      }
      return this.fromHex(color);
    }
    
    return { r: 0, g: 0, b: 0, a: 1 };
  }
} as const;

// ============================================================================
// SECTION 6: VARIABLE CACHE (JSF Rule 4.18 - Resource Management)
// ============================================================================

class VariableCache {
  private collectionMap = new Map<string, VariableCollection>();
  private variableMap = new Map<string, Variable>();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.rebuild();
    this.initialized = true;
  }

  async rebuild(): Promise<void> {
    this.collectionMap.clear();
    this.variableMap.clear();
    
    for (const col of await figma.variables.getLocalVariableCollectionsAsync()) {
      this.collectionMap.set(col.name, col);
      for (const varId of col.variableIds) {
        const v = await figma.variables.getVariableByIdAsync(varId);
        if (v) {
          this.variableMap.set(`${col.name}/${v.name}`, v);
        }
      }
    }
  }

  getCollection(name: string): VariableCollection | undefined {
    return this.collectionMap.get(name);
  }

  getVariable(key: string): Variable | undefined {
    return this.variableMap.get(key);
  }

  setVariable(key: string, variable: Variable): void {
    this.variableMap.set(key, variable);
  }

  setCollection(name: string, collection: VariableCollection): void {
    this.collectionMap.set(name, collection);
  }

  removeCollection(name: string): void {
    // Remove collection from map
    this.collectionMap.delete(name);
    // Remove all variables belonging to this collection
    const keysToRemove: string[] = [];
    for (const key of this.variableMap.keys()) {
      if (key.startsWith(`${name}/`)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.variableMap.delete(key);
    }
  }

  get size(): number {
    return this.variableMap.size;
  }

  get collections(): IterableIterator<VariableCollection> {
    return this.collectionMap.values();
  }

  getVariableKeys(): string[] {
    return Array.from(this.variableMap.keys());
  }
}

const variableCache = new VariableCache();

// ============================================================================
// SECTION 7: TYPE GUARDS & MAPPERS (JSF Rule 4.9)
// ============================================================================

function isExportVariableValue(obj: unknown): obj is ExportVariableValue {
  return typeof obj === 'object' && obj !== null && '$type' in obj;
}

function isVariableAlias(value: unknown): value is { type: 'VARIABLE_ALIAS'; id: string } {
  return typeof value === 'object' && value !== null && 
         (value as Record<string, unknown>).type === 'VARIABLE_ALIAS';
}

const TypeMapper = {
  toExportType(type: VariableResolvedDataType): VariableValueType {
    const map: Record<VariableResolvedDataType, VariableValueType> = {
      'COLOR': 'color',
      'FLOAT': 'float',
      'STRING': 'string',
      'BOOLEAN': 'boolean'
    };
    return map[type] ?? 'string';
  },

  toFigmaType(type: string): VariableResolvedDataType {
    const map: Record<string, VariableResolvedDataType> = {
      'color': 'COLOR',
      'float': 'FLOAT',
      'string': 'STRING',
      'boolean': 'BOOLEAN'
    };
    return map[type] ?? 'STRING';
  },

  scopesToArray(scopes: VariableScope[]): string[] {
    if (scopes.length === 0 || scopes.includes('ALL_SCOPES')) {
      return ['ALL_SCOPES'];
    }
    return [...scopes];
  },

  arrayToScopes(arr: string[]): VariableScope[] {
    if (arr.includes('ALL_SCOPES')) {
      return ['ALL_SCOPES'];
    }
    return arr as VariableScope[];
  }
} as const;

// ============================================================================
// SECTION 8: BINDING UTILITIES
// ============================================================================

async function getVariableBindingInfo(
  boundVariables: Record<string, VariableAlias | undefined> | undefined, 
  key: string
): Promise<VariableBinding> {
  if (!boundVariables?.[key]) return {};
  
  const alias = boundVariables[key];
  if (!alias) return {};
  
  const variable = await figma.variables.getVariableByIdAsync(alias.id);
  if (!variable) return { id: alias.id };
  
  const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
  return {
    id: alias.id,
    name: variable.name,
    collection: collection?.name
  };
}

async function extractBindings(
  boundVariables: Record<string, VariableAlias | undefined> | undefined,
  keys: string[]
): Promise<Record<string, VariableBinding> | undefined> {
  if (!boundVariables) return undefined;
  
  const bindings: Record<string, VariableBinding> = {};
  for (const key of keys) {
    const binding = await getVariableBindingInfo(boundVariables, key);
    if (binding.name) {
      bindings[key] = binding;
    }
  }
  
  return Object.keys(bindings).length > 0 ? bindings : undefined;
}

// ============================================================================
// SECTION 9: VARIABLE FLATTENING UTILITIES
// ============================================================================

interface FlatVariable {
  readonly path: string;
  readonly value: ExportVariableValue;
}

function flattenVariables(obj: NestedVariables, prefix: string): FlatVariable[] {
  const results: FlatVariable[] = [];
  
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const path = prefix ? `${prefix}/${key}` : key;
    
    if (isExportVariableValue(val)) {
      results.push({ path, value: val });
    } else {
      results.push(...flattenVariables(val as NestedVariables, path));
    }
  }
  
  return results;
}

function getValueAtPath(obj: NestedVariables, path: string): ExportVariableValue | null {
  const parts = path.split('/');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return null;
    if (isExportVariableValue(current)) return null;
    current = (current as NestedVariables)[part];
  }
  
  return isExportVariableValue(current) ? current : null;
}

// ============================================================================
// SECTION 10: STYLE PROCESSORS (JSF Rule 4.7 - Single Responsibility)
// ============================================================================

interface StyleProcessor<TExport, TFigma> {
  export(options?: { includeImages?: boolean }): Promise<TExport[]>;
  importStyles(styles: TExport[], variables: VariableCache): Promise<{ created: number; updated: number }>;
}

// Color Style Processor - supports SOLID, GRADIENT, and IMAGE paint styles
const ColorStyleProcessor: StyleProcessor<ExportColorStyle, PaintStyle> = {
  async export(options?: { includeImages?: boolean }): Promise<ExportColorStyle[]> {
    const includeImages = options?.includeImages ?? false;
    const styles: ExportColorStyle[] = [];
    
    for (const style of await figma.getLocalPaintStylesAsync()) {
      if (style.paints.length === 0) continue;
      
      const exportPaints: ExportPaintData[] = [];
      let primaryColor: ExportColorValue | undefined;
      let primaryOpacity: number | undefined;
      let boundVars: Record<string, VariableBinding> | undefined;
      
      for (const paint of style.paints) {
        if (paint.type === 'SOLID') {
          const colorAsRgba = paint.color as RGBA;
          let effectiveOpacity = paint.opacity ?? 1;
          
          if (colorAsRgba.a !== undefined && colorAsRgba.a < 1 && effectiveOpacity === 1) {
            effectiveOpacity = colorAsRgba.a;
          }
          
          const colorWithAlpha: RGBA = {
            r: paint.color.r,
            g: paint.color.g,
            b: paint.color.b,
            a: effectiveOpacity
          };
          
          const solidPaint: ExportSolidPaint = {
            type: 'SOLID',
            color: ColorConverter.toAllFormats(colorWithAlpha),
            opacity: MathUtils.round2(effectiveOpacity)
          };
          
          exportPaints.push(solidPaint);
          
          // Store first solid color for backward compatibility
          if (!primaryColor) {
            primaryColor = solidPaint.color;
            primaryOpacity = solidPaint.opacity;
            boundVars = await extractBindings((paint as unknown as Record<string, unknown>).boundVariables as Record<string, VariableAlias | undefined>, ['color']);
          }
          
        } else if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL' || 
                   paint.type === 'GRADIENT_ANGULAR' || paint.type === 'GRADIENT_DIAMOND') {
          const gradientStops: ExportGradientStop[] = paint.gradientStops.map(stop => ({
            position: MathUtils.round2(stop.position),
            color: ColorConverter.toAllFormats({
              r: stop.color.r,
              g: stop.color.g,
              b: stop.color.b,
              a: stop.color.a ?? 1
            })
          }));
          
          const gradientPaint: ExportGradientPaint = {
            type: paint.type,
            gradientStops,
            ...(paint.gradientTransform && { 
              gradientTransform: paint.gradientTransform as [[number, number, number], [number, number, number]]
            }),
            opacity: MathUtils.round2(paint.opacity ?? 1)
          };
          
          exportPaints.push(gradientPaint);
          
        } else if (paint.type === 'IMAGE') {
          const imagePaint: ExportImagePaint = {
            type: 'IMAGE',
            scaleMode: paint.scaleMode,
            ...(paint.imageHash && { imageHash: paint.imageHash }),
            opacity: MathUtils.round2(paint.opacity ?? 1),
            ...(paint.rotation !== undefined && { rotation: paint.rotation }),
            ...(paint.filters && {
              filters: {
                ...(paint.filters.exposure !== undefined && { exposure: paint.filters.exposure }),
                ...(paint.filters.contrast !== undefined && { contrast: paint.filters.contrast }),
                ...(paint.filters.saturation !== undefined && { saturation: paint.filters.saturation }),
                ...(paint.filters.temperature !== undefined && { temperature: paint.filters.temperature }),
                ...(paint.filters.tint !== undefined && { tint: paint.filters.tint }),
                ...(paint.filters.highlights !== undefined && { highlights: paint.filters.highlights }),
                ...(paint.filters.shadows !== undefined && { shadows: paint.filters.shadows })
              }
            })
          };
          
          // Try to get image bytes if includeImages is enabled
          if (includeImages && paint.imageHash) {
            try {
              const image = figma.getImageByHash(paint.imageHash);
              if (image) {
                const imageBytes = await image.getBytesAsync();
                if (imageBytes) {
                  // Convert to base64
                  const base64 = figma.base64Encode(imageBytes);
                  (imagePaint as { imageBase64?: string }).imageBase64 = base64;
                }
              }
            } catch (e) {
              Logger.log(`⚠️ Could not export image data for style "${style.name}": ${e}`);
            }
          }
          
          exportPaints.push(imagePaint);
        }
      }
      
      if (exportPaints.length === 0) continue;
      
      const colorStyle: ExportColorStyle = {
        name: style.name,
        paints: exportPaints,
        // Backward compatibility fields for single solid paint styles
        ...(primaryColor && { color: primaryColor }),
        ...(primaryOpacity !== undefined && { opacity: primaryOpacity }),
        ...(style.description && { description: style.description }),
        ...(boundVars && Object.keys(boundVars).length > 0 && { boundVariables: boundVars })
      };
      
      styles.push(colorStyle);
    }
    
    return styles;
  },

  async importStyles(styles: ExportColorStyle[], cache: VariableCache): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    const existing = new Map<string, PaintStyle>();
    for (const s of await figma.getLocalPaintStylesAsync()) {
      existing.set(s.name, s);
    }
    
    for (const colorStyle of styles) {
      let style: PaintStyle;
      
      if (existing.has(colorStyle.name)) {
        style = existing.get(colorStyle.name)!;
        updated++;
      } else {
        style = figma.createPaintStyle();
        style.name = colorStyle.name;
        created++;
      }
      
      if (colorStyle.description) {
        style.description = colorStyle.description;
      }
      
      const paints: Paint[] = [];
      
      // Use new paints array if available, otherwise fall back to legacy color field
      if (colorStyle.paints && colorStyle.paints.length > 0) {
        for (const exportPaint of colorStyle.paints) {
          if (exportPaint.type === 'SOLID') {
            const colorRgba = ColorParser.parse(exportPaint.color);
            let finalOpacity = exportPaint.opacity ?? 1;
            
            if (colorRgba.a < 1 && exportPaint.opacity === undefined) {
              finalOpacity = MathUtils.round2(colorRgba.a);
            }
            
            let paint: SolidPaint = {
              type: 'SOLID',
              color: { r: colorRgba.r, g: colorRgba.g, b: colorRgba.b },
              opacity: MathUtils.round2(finalOpacity)
            };
            
            // Apply variable bindings for first solid paint
            if (colorStyle.boundVariables && paints.length === 0) {
              for (const [key, binding] of Object.entries(colorStyle.boundVariables)) {
                if (binding.name && binding.collection) {
                  const targetVar = cache.getVariable(`${binding.collection}/${binding.name}`);
                  if (targetVar) {
                    try {
                      paint = figma.variables.setBoundVariableForPaint(paint, key as VariableBindablePaintField, targetVar);
                    } catch (e) {
                      Logger.log(`⚠️ Could not bind ${key}: ${e}`);
                    }
                  }
                }
              }
            }
            
            paints.push(paint);
            
          } else if (exportPaint.type === 'GRADIENT_LINEAR' || exportPaint.type === 'GRADIENT_RADIAL' || 
                     exportPaint.type === 'GRADIENT_ANGULAR' || exportPaint.type === 'GRADIENT_DIAMOND') {
            const gradientStops: ColorStop[] = exportPaint.gradientStops.map(stop => {
              const stopColor = ColorParser.parse(stop.color);
              return {
                position: stop.position,
                color: { r: stopColor.r, g: stopColor.g, b: stopColor.b, a: stopColor.a }
              };
            });
            
            // Convert readonly transform to mutable Transform type
            const transform: Transform = exportPaint.gradientTransform 
              ? [[exportPaint.gradientTransform[0][0], exportPaint.gradientTransform[0][1], exportPaint.gradientTransform[0][2]],
                 [exportPaint.gradientTransform[1][0], exportPaint.gradientTransform[1][1], exportPaint.gradientTransform[1][2]]]
              : [[1, 0, 0], [0, 1, 0]];
            
            const gradientPaint: GradientPaint = {
              type: exportPaint.type,
              gradientStops,
              gradientTransform: transform,
              opacity: exportPaint.opacity ?? 1
            };
            
            paints.push(gradientPaint);
            
          } else if (exportPaint.type === 'IMAGE') {
            // Create image paint
            let imageHash: string | null = null;
            
            // First, try to create image from base64 data if available
            // This takes priority because imageHash from another file won't work
            if (exportPaint.imageBase64) {
              try {
                const bytes = figma.base64Decode(exportPaint.imageBase64);
                const image = figma.createImage(bytes);
                imageHash = image.hash;
                Logger.log(`✅ Created image from base64 data for style "${colorStyle.name}"`);
              } catch (e) {
                Logger.log(`⚠️ Could not import image from base64 for style "${colorStyle.name}": ${e}`);
              }
            }
            
            // If no base64 or base64 failed, try using the existing hash (might work if image exists in file)
            if (!imageHash && exportPaint.imageHash) {
              // Check if the image with this hash exists in the file
              const existingImage = figma.getImageByHash(exportPaint.imageHash);
              if (existingImage) {
                imageHash = exportPaint.imageHash;
                Logger.log(`✅ Found existing image with hash for style "${colorStyle.name}"`);
              } else {
                Logger.log(`⚠️ Image hash not found in file for style "${colorStyle.name}", skipping image paint (imageHash cannot be null)`);
              }
            }
            
            // Only add image paint if we have a valid imageHash - Figma API rejects null imageHash
            if (imageHash) {
              const imagePaint: ImagePaint = {
                type: 'IMAGE',
                scaleMode: exportPaint.scaleMode,
                imageHash: imageHash,
                opacity: exportPaint.opacity ?? 1,
                ...(exportPaint.rotation !== undefined && { rotation: exportPaint.rotation }),
                ...(exportPaint.filters && { filters: exportPaint.filters as ImageFilters })
              };
              
              paints.push(imagePaint);
            }
          }
        }
      } else if (colorStyle.color) {
        // Legacy format: single color field
        const colorRgba = ColorParser.parse(colorStyle.color);
        let finalOpacity = colorStyle.opacity ?? 1;
        
        if (colorRgba.a < 1 && colorStyle.opacity === undefined) {
          finalOpacity = MathUtils.round2(colorRgba.a);
        }
        
        let paint: SolidPaint = {
          type: 'SOLID',
          color: { r: colorRgba.r, g: colorRgba.g, b: colorRgba.b },
          opacity: MathUtils.round2(finalOpacity)
        };
        
        if (colorStyle.boundVariables) {
          for (const [key, binding] of Object.entries(colorStyle.boundVariables)) {
            if (binding.name && binding.collection) {
              const targetVar = cache.getVariable(`${binding.collection}/${binding.name}`);
              if (targetVar) {
                try {
                  paint = figma.variables.setBoundVariableForPaint(paint, key as VariableBindablePaintField, targetVar);
                } catch (e) {
                  Logger.log(`⚠️ Could not bind ${key}: ${e}`);
                }
              }
            }
          }
        }
        
        paints.push(paint);
      }
      
      if (paints.length > 0) {
        style.paints = paints;
      }
    }
    
    return { created, updated };
  }
};

// Text Style Processor
const TextStyleProcessor: StyleProcessor<ExportTextStyle, TextStyle> = {
  async export(_options?: { includeImages?: boolean }): Promise<ExportTextStyle[]> {
    const styles: ExportTextStyle[] = [];
    
    for (const style of await figma.getLocalTextStylesAsync()) {
      const textStyle: ExportTextStyle = {
        name: style.name,
        fontFamily: style.fontName.family,
        fontStyle: style.fontName.style,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textCase: style.textCase,
        textDecoration: style.textDecoration,
        ...(style.description && { description: style.description }),
        boundVariables: await extractBindings(style.boundVariables as Record<string, VariableAlias | undefined>, ['fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'paragraphIndent'])
      };
      
      styles.push(textStyle);
    }
    
    return styles;
  },

  async importStyles(styles: ExportTextStyle[], cache: VariableCache): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    const existing = new Map<string, TextStyle>();
    for (const s of await figma.getLocalTextStylesAsync()) {
      existing.set(s.name, s);
    }
    
    for (const textStyle of styles) {
      let style: TextStyle;
      
      if (existing.has(textStyle.name)) {
        style = existing.get(textStyle.name)!;
        updated++;
      } else {
        style = figma.createTextStyle();
        style.name = textStyle.name;
        created++;
      }
      
      if (textStyle.description) {
        style.description = textStyle.description;
      }
      
      try {
        await figma.loadFontAsync({ family: textStyle.fontFamily, style: textStyle.fontStyle });
        style.fontName = { family: textStyle.fontFamily, style: textStyle.fontStyle };
        style.fontSize = textStyle.fontSize;
        style.lineHeight = textStyle.lineHeight;
        style.letterSpacing = textStyle.letterSpacing;
        if (textStyle.textCase) style.textCase = textStyle.textCase as TextCase;
        if (textStyle.textDecoration) style.textDecoration = textStyle.textDecoration as TextDecoration;
        
        if (textStyle.boundVariables) {
          for (const [key, binding] of Object.entries(textStyle.boundVariables)) {
            if (binding.name && binding.collection) {
              const targetVar = cache.getVariable(`${binding.collection}/${binding.name}`);
              if (targetVar) {
                try {
                  style.setBoundVariable(key as VariableBindableTextField, targetVar);
                } catch { /* Skip */ }
              }
            }
          }
        }
      } catch (e) {
        Logger.log(`⚠️ Could not load font for ${textStyle.name}: ${e}`);
      }
    }
    
    return { created, updated };
  }
};

// Effect Style Processor
const EffectStyleProcessor: StyleProcessor<ExportEffectStyle, EffectStyle> = {
  async export(_options?: { includeImages?: boolean }): Promise<ExportEffectStyle[]> {
    const styles: ExportEffectStyle[] = [];
    
    for (const style of await figma.getLocalEffectStylesAsync()) {
      const effects: ExportEffectData[] = [];
      for (const effect of style.effects) {
        const effectData: ExportEffectData = {
          type: effect.type,
          visible: effect.visible,
          ...('radius' in effect && { radius: effect.radius }),
          ...('spread' in effect && { spread: effect.spread }),
          ...('offset' in effect && { offset: effect.offset }),
          ...('color' in effect && { color: ColorConverter.toAllFormats(effect.color as RGBA) }),
          ...('blendMode' in effect && { blendMode: effect.blendMode }),
          ...('showShadowBehindNode' in effect && { showShadowBehindNode: effect.showShadowBehindNode }),
          boundVariables: await extractBindings((effect as unknown as Record<string, unknown>).boundVariables as Record<string, VariableAlias | undefined>, ['color', 'radius', 'spread', 'offsetX', 'offsetY'])
        };
        effects.push(effectData);
      }
      
      const effectStyle: ExportEffectStyle = {
        name: style.name,
        ...(style.description && { description: style.description }),
        effects
      };
      
      styles.push(effectStyle);
    }
    
    return styles;
  },

  async importStyles(styles: ExportEffectStyle[], cache: VariableCache): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    const existing = new Map<string, EffectStyle>();
    for (const s of await figma.getLocalEffectStylesAsync()) {
      existing.set(s.name, s);
    }
    
    for (const effectStyle of styles) {
      let style: EffectStyle;
      
      if (existing.has(effectStyle.name)) {
        style = existing.get(effectStyle.name)!;
        updated++;
      } else {
        style = figma.createEffectStyle();
        style.name = effectStyle.name;
        created++;
      }
      
      if (effectStyle.description) {
        style.description = effectStyle.description;
      }
      
      const newEffects = effectStyle.effects.map(effect => {
        const e: Effect = {
          type: effect.type as Effect['type'],
          visible: effect.visible ?? true,
          ...((effect.radius !== undefined) && { radius: effect.radius }),
          ...((effect.spread !== undefined) && { spread: effect.spread }),
          ...((effect.offset !== undefined) && { offset: effect.offset }),
          ...((effect.color !== undefined) && { 
            color: (() => {
              const c = ColorParser.parse(effect.color);
              return { r: c.r, g: c.g, b: c.b, a: MathUtils.round2(c.a) };
            })()
          }),
          ...((effect.blendMode !== undefined) && { blendMode: effect.blendMode as BlendMode }),
          // showShadowBehindNode: false = unchecked (normal shadow), true = checked (show behind)
          // Default to false (unchecked) unless explicitly set in import data
          ...((effect.showShadowBehindNode !== undefined) && { showShadowBehindNode: effect.showShadowBehindNode })
        } as Effect;
        return e;
      });
      
      style.effects = newEffects;
      
      // Bind variables
      for (let i = 0; i < effectStyle.effects.length; i++) {
        const effectData = effectStyle.effects[i];
        if (effectData.boundVariables) {
          for (const [key, binding] of Object.entries(effectData.boundVariables)) {
            if (binding.name && binding.collection) {
              const targetVar = cache.getVariable(`${binding.collection}/${binding.name}`);
              if (targetVar) {
                try {
                  const effects = [...style.effects];
                  effects[i] = figma.variables.setBoundVariableForEffect(effects[i], key as VariableBindableEffectField, targetVar);
                  style.effects = effects;
                } catch { /* Skip */ }
              }
            }
          }
        }
      }
    }
    
    return { created, updated };
  }
};

// Grid Style Processor
const GridStyleProcessor: StyleProcessor<ExportGridStyle, GridStyle> = {
  async export(_options?: { includeImages?: boolean }): Promise<ExportGridStyle[]> {
    const styles: ExportGridStyle[] = [];
    
    for (const style of await figma.getLocalGridStylesAsync()) {
      const layoutGrids: ExportGridData[] = [];
      for (const grid of style.layoutGrids) {
        const gridColor = grid.color as RGBA;
        const gridData: ExportGridData = {
          pattern: grid.pattern,
          visible: grid.visible,
          color: ColorConverter.toAllFormats(gridColor),
          ...(grid.pattern === 'GRID' && { sectionSize: grid.sectionSize }),
          ...(grid.pattern !== 'GRID' && {
            alignment: (grid as RowsColsLayoutGrid).alignment,
            gutterSize: (grid as RowsColsLayoutGrid).gutterSize,
            count: (grid as RowsColsLayoutGrid).count,
            offset: (grid as RowsColsLayoutGrid).offset,
            ...((grid as RowsColsLayoutGrid).sectionSize !== undefined && { sectionSize: (grid as RowsColsLayoutGrid).sectionSize })
          }),
          boundVariables: await extractBindings((grid as unknown as Record<string, unknown>).boundVariables as Record<string, VariableAlias | undefined>, ['gutterSize', 'count', 'offset', 'sectionSize'])
        };
        layoutGrids.push(gridData);
      }
      
      const gridStyle: ExportGridStyle = {
        name: style.name,
        ...(style.description && { description: style.description }),
        layoutGrids
      };
      
      styles.push(gridStyle);
    }
    
    return styles;
  },

  async importStyles(styles: ExportGridStyle[], cache: VariableCache): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    const existing = new Map<string, GridStyle>();
    for (const s of await figma.getLocalGridStylesAsync()) {
      existing.set(s.name, s);
    }
    
    for (const gridStyle of styles) {
      let style: GridStyle;
      
      if (existing.has(gridStyle.name)) {
        style = existing.get(gridStyle.name)!;
        updated++;
      } else {
        style = figma.createGridStyle();
        style.name = gridStyle.name;
        created++;
      }
      
      if (gridStyle.description) {
        style.description = gridStyle.description;
      }
      
      const newLayoutGrids = gridStyle.layoutGrids.map((grid): LayoutGrid => {
        const gridColor = grid.color 
          ? ColorParser.parse(grid.color)
          : { r: 1, g: 0, b: 0, a: 0.1 };
        
        const color = { 
          r: gridColor.r, 
          g: gridColor.g, 
          b: gridColor.b, 
          a: MathUtils.round2(gridColor.a) 
        };
        
        if (grid.pattern === 'GRID') {
          return {
            pattern: 'GRID' as const,
            sectionSize: grid.sectionSize ?? 10,
            visible: grid.visible !== false,
            color
          };
        }
        
        const alignment = grid.alignment ?? 'STRETCH';
        const base = {
          pattern: grid.pattern as 'ROWS' | 'COLUMNS',
          gutterSize: grid.gutterSize ?? 10,
          count: grid.count ?? 5,
          visible: grid.visible !== false,
          color
        };
        
        if (alignment === 'STRETCH') {
          return { ...base, alignment: 'STRETCH' as const, offset: grid.offset ?? 0 };
        } else if (alignment === 'CENTER') {
          return { ...base, alignment: 'CENTER' as const, sectionSize: grid.sectionSize ?? 100 };
        } else {
          const result: RowsColsLayoutGrid = {
            ...base,
            alignment: alignment as 'MIN' | 'MAX',
            offset: grid.offset ?? 0
          };
          if (grid.sectionSize !== undefined) {
            (result as unknown as { sectionSize: number }).sectionSize = grid.sectionSize;
          }
          return result;
        }
      });
      
      style.layoutGrids = newLayoutGrids;
      
      // Bind variables
      for (let i = 0; i < gridStyle.layoutGrids.length; i++) {
        const gridData = gridStyle.layoutGrids[i];
        if (gridData.boundVariables) {
          for (const [key, binding] of Object.entries(gridData.boundVariables)) {
            if (binding.name && binding.collection) {
              const targetVar = cache.getVariable(`${binding.collection}/${binding.name}`);
              if (targetVar) {
                try {
                  const grids = [...style.layoutGrids];
                  grids[i] = figma.variables.setBoundVariableForLayoutGrid(grids[i], key as VariableBindableLayoutGridField, targetVar);
                  style.layoutGrids = grids;
                } catch { /* Skip */ }
              }
            }
          }
        }
      }
    }
    
    return { created, updated };
  }
};

// ============================================================================
// SECTION 10B: IMPORT DIFF CALCULATOR
// ============================================================================

interface ImportDiffResult {
  newCollections: string[];
  modifiedCollections: string[];
  unchangedCollections: string[];
  newVariables: { collection: string; path: string }[];
  modifiedVariables: { collection: string; path: string; oldValue?: string; newValue?: string }[];
  unchangedVariables: number;
  newStyles: { type: string; name: string }[];
  modifiedStyles: { type: string; name: string }[];
  summary: {
    collectionsNew: number;
    collectionsModified: number;
    collectionsUnchanged: number;
    variablesNew: number;
    variablesModified: number;
    variablesUnchanged: number;
    stylesNew: number;
    stylesModified: number;
  };
}

async function computeImportDiff(importData: ExportFormat): Promise<ImportDiffResult> {
  await variableCache.initialize();
  
  const result: ImportDiffResult = {
    newCollections: [],
    modifiedCollections: [],
    unchangedCollections: [],
    newVariables: [],
    modifiedVariables: [],
    unchangedVariables: 0,
    newStyles: [],
    modifiedStyles: [],
    summary: {
      collectionsNew: 0,
      collectionsModified: 0,
      collectionsUnchanged: 0,
      variablesNew: 0,
      variablesModified: 0,
      variablesUnchanged: 0,
      stylesNew: 0,
      stylesModified: 0
    }
  };
  
  // Process collections from import data
  for (const item of importData) {
    const keys = Object.keys(item);
    if (keys.length === 1 && keys[0] === '_styles') {
      // Handle styles diff
      const stylesData = (item as { _styles: StylesExport })._styles;
      await computeStylesDiff(stylesData, result);
      continue;
    }
    
    // Handle collection
    const collectionObj = item as CollectionExport;
    const jsonCollectionName = Object.keys(collectionObj)[0];
    const collectionContent = collectionObj[jsonCollectionName];
    const collectionName = collectionContent.$originalName || jsonCollectionName;
    
    const existingCollection = variableCache.getCollection(collectionName);
    
    if (!existingCollection) {
      // New collection
      result.newCollections.push(collectionName);
      result.summary.collectionsNew++;
      
      // Count all variables as new
      const varCount = countVariablesInCollection(collectionContent.modes);
      result.summary.variablesNew += varCount;
      continue;
    }
    
    // Existing collection - check for modifications
    let hasModifications = false;
    
    for (const [modeName, modeData] of Object.entries(collectionContent.modes)) {
      const mode = existingCollection.modes.find(m => m.name === modeName);
      if (!mode) {
        hasModifications = true;
        continue;
      }
      
      // Check each variable
      await checkVariablesDiff(
        existingCollection,
        mode.modeId,
        modeData,
        collectionName,
        '',
        result
      );
    }
    
    if (result.modifiedVariables.some(v => v.collection === collectionName) ||
        result.newVariables.some(v => v.collection === collectionName)) {
      result.modifiedCollections.push(collectionName);
      result.summary.collectionsModified++;
    } else {
      result.unchangedCollections.push(collectionName);
      result.summary.collectionsUnchanged++;
    }
  }
  
  return result;
}

function countVariablesInCollection(modes: ModeVariables): number {
  let count = 0;
  const firstMode = Object.values(modes)[0];
  if (firstMode) {
    count = countVarsInNestedObj(firstMode);
  }
  return count;
}

function countVarsInNestedObj(obj: NestedVariables): number {
  let count = 0;
  for (const value of Object.values(obj)) {
    if (isExportVariableValue(value)) {
      count++;
    } else {
      count += countVarsInNestedObj(value as NestedVariables);
    }
  }
  return count;
}

async function checkVariablesDiff(
  collection: VariableCollection,
  modeId: string,
  importData: NestedVariables,
  collectionName: string,
  path: string,
  result: ImportDiffResult
): Promise<void> {
  for (const [key, value] of Object.entries(importData)) {
    const currentPath = path ? `${path}/${key}` : key;
    
    if (isExportVariableValue(value)) {
      // This is a variable value
      const existingVar = variableCache.getVariable(`${collectionName}/${currentPath}`);
      
      if (!existingVar) {
        result.newVariables.push({ collection: collectionName, path: currentPath });
        result.summary.variablesNew++;
      } else {
        // Check if value changed
        const existingValue = existingVar.valuesByMode[modeId];
        const importValue = value.$value;
        
        if (valuesAreDifferent(existingValue, importValue)) {
          result.modifiedVariables.push({
            collection: collectionName,
            path: currentPath,
            oldValue: formatValueForDisplay(existingValue),
            newValue: formatValueForDisplay(importValue)
          });
          result.summary.variablesModified++;
        } else {
          result.unchangedVariables++;
          result.summary.variablesUnchanged++;
        }
      }
    } else {
      // Nested object, recurse
      await checkVariablesDiff(collection, modeId, value as NestedVariables, collectionName, currentPath, result);
    }
  }
}

function valuesAreDifferent(existing: VariableValue | undefined, imported: unknown): boolean {
  if (existing === undefined) return true;
  
  // Handle alias references
  if (isVariableAlias(existing)) {
    // Both are alias refs, compare the string value
    if (typeof imported === 'string' && imported.startsWith('{')) {
      return true; // Can't easily compare alias refs, assume different
    }
    return true;
  }
  
  // Handle colors
  if (typeof existing === 'object' && existing !== null && 'r' in existing) {
    if (typeof imported === 'object' && imported !== null && 'hex' in imported) {
      const existingHex = ColorConverter.toAllFormats(existing as RGBA).hex;
      return existingHex.toLowerCase() !== (imported as ExportColorValue).hex.toLowerCase();
    }
    return true;
  }
  
  // Handle primitives
  return existing !== imported;
}

function formatValueForDisplay(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'object' && value !== null) {
    if ('hex' in value) return (value as ExportColorValue).hex;
    if ('r' in value) return ColorConverter.toAllFormats(value as RGBA).hex;
    if ('id' in value) return '{alias}';
  }
  return String(value);
}

async function computeStylesDiff(stylesData: StylesExport, result: ImportDiffResult): Promise<void> {
  // Check color styles
  if (stylesData.colorStyles) {
    const existingColorStyles = await figma.getLocalPaintStylesAsync();
    const existingNames = new Set(existingColorStyles.map(s => s.name));
    
    for (const style of stylesData.colorStyles) {
      if (existingNames.has(style.name)) {
        result.modifiedStyles.push({ type: 'color', name: style.name });
        result.summary.stylesModified++;
      } else {
        result.newStyles.push({ type: 'color', name: style.name });
        result.summary.stylesNew++;
      }
    }
  }
  
  // Check text styles
  if (stylesData.textStyles) {
    const existingTextStyles = await figma.getLocalTextStylesAsync();
    const existingNames = new Set(existingTextStyles.map(s => s.name));
    
    for (const style of stylesData.textStyles) {
      if (existingNames.has(style.name)) {
        result.modifiedStyles.push({ type: 'text', name: style.name });
        result.summary.stylesModified++;
      } else {
        result.newStyles.push({ type: 'text', name: style.name });
        result.summary.stylesNew++;
      }
    }
  }
  
  // Check effect styles
  if (stylesData.effectStyles) {
    const existingEffectStyles = await figma.getLocalEffectStylesAsync();
    const existingNames = new Set(existingEffectStyles.map(s => s.name));
    
    for (const style of stylesData.effectStyles) {
      if (existingNames.has(style.name)) {
        result.modifiedStyles.push({ type: 'effect', name: style.name });
        result.summary.stylesModified++;
      } else {
        result.newStyles.push({ type: 'effect', name: style.name });
        result.summary.stylesNew++;
      }
    }
  }
  
  // Check grid styles
  if (stylesData.gridStyles) {
    const existingGridStyles = await figma.getLocalGridStylesAsync();
    const existingNames = new Set(existingGridStyles.map(s => s.name));
    
    for (const style of stylesData.gridStyles) {
      if (existingNames.has(style.name)) {
        result.modifiedStyles.push({ type: 'grid', name: style.name });
        result.summary.stylesModified++;
      } else {
        result.newStyles.push({ type: 'grid', name: style.name });
        result.summary.stylesNew++;
      }
    }
  }
}

// ============================================================================
// SECTION 11: EXPORT ORCHESTRATOR
// ============================================================================

interface ExportOptions {
  selectedCollections?: string[];
  selectedModes?: Record<string, string[]>; // { collectionName: ['Mode1', 'Mode2'] }
  styleOptions?: StyleOptions;
  preserveLibraryRefs?: boolean;
  includeImages?: boolean;
  namingConvention?: NamingConvention;
  exportFormat?: ExportFormatType;
  resolveAliases?: boolean; // Resolve alias refs to raw values
}

async function exportVariables(
  selectedCollections?: string[], 
  styleOptions?: StyleOptions,
  preserveLibraryRefs?: boolean,
  includeImages?: boolean,
  namingConvention: NamingConvention = 'original',
  exportFormat: ExportFormatType = 'figma',
  selectedModes?: Record<string, string[]>,
  resolveAliases: boolean = false
): Promise<void> {
  Logger.log('📤 Starting export...');
  Logger.log(`  preserveLibraryRefs: ${preserveLibraryRefs}`);
  Logger.log(`  includeImages: ${includeImages}`);
  Logger.log(`  namingConvention: ${namingConvention}`);
  Logger.log(`  exportFormat: ${exportFormat}`);
  Logger.log(`  resolveAliases: ${resolveAliases}`);
  if (selectedModes) {
    Logger.log(`  selectedModes: ${JSON.stringify(selectedModes)}`);
  }
  
  try {
    let collections = await figma.variables.getLocalVariableCollectionsAsync();
    
    if (selectedCollections?.length) {
      collections = collections.filter(c => selectedCollections.includes(c.name));
      Logger.log(`Filtering to ${collections.length} selected collections`);
    }
    
    const exportData: ExportFormat = [];
    const w3cExportData: Record<string, W3CTokenGroup> = {};
    let totalVariables = 0;
    
    for (const collection of collections) {
      Logger.log(`Processing collection: ${collection.name}`);
      
      // Filter modes if selectedModes specified for this collection
      let modesToExport = collection.modes;
      if (selectedModes && selectedModes[collection.name]) {
        const allowedModes = selectedModes[collection.name];
        modesToExport = collection.modes.filter(m => allowedModes.includes(m.name));
        Logger.log(`  Filtering to ${modesToExport.length} modes: ${modesToExport.map(m => m.name).join(', ')}`);
      }
      
      // Convert collection name based on naming convention
      const exportCollectionName = NamingConverter.convertCollectionName(collection.name, namingConvention);
      
      const collectionExport: CollectionExport = {
        [exportCollectionName]: { 
          modes: {},
          // Store original name for round-trip if naming was changed
          ...(exportCollectionName !== collection.name && { $originalName: collection.name })
        }
      };
      
      // Initialize modes with converted names (only selected modes)
      for (const mode of modesToExport) {
        const exportModeName = NamingConverter.convertModeName(mode.name, namingConvention);
        collectionExport[exportCollectionName].modes[exportModeName] = {};
        // We'll handle original mode names in metadata if needed
      }
      
      // Process variables
      for (const variableId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable) continue;
        
        totalVariables++;
        
        // Convert variable path parts based on naming convention
        const originalParts = variable.name.split('/');
        const nameParts = originalParts.map(part => NamingConverter.convert(part, namingConvention));
        
        // Only process selected modes
        for (const mode of modesToExport) {
          const exportModeName = NamingConverter.convertModeName(mode.name, namingConvention);
          const modeValues = collectionExport[exportCollectionName].modes[exportModeName];
          const value = variable.valuesByMode[mode.modeId];
          
          // Navigate/create nested structure
          let current: NestedVariables = modeValues;
          for (let i = 0; i < nameParts.length - 1; i++) {
            const part = nameParts[i];
            if (!current[part] || isExportVariableValue(current[part])) {
              current[part] = {};
            }
            current = current[part] as NestedVariables;
          }
          
          const leafName = nameParts[nameParts.length - 1];
          
          // Convert value
          let exportValue: string | number | boolean | ExportColorValue;
          let isAlias = false;
          let aliasCollection = '';
          let isLibraryAlias = false;
          let aliasRef = '';
          let localValue: string | number | boolean | ExportColorValue | undefined = undefined;
          
          if (isVariableAlias(value)) {
            const aliasVar = await figma.variables.getVariableByIdAsync(value.id);
            if (aliasVar) {
              const aliasCol = await figma.variables.getVariableCollectionByIdAsync(aliasVar.variableCollectionId);
              isAlias = true;
              aliasCollection = aliasCol?.name ?? '';
              isLibraryAlias = aliasCol?.remote ?? false;
              
              // If resolveAliases is true, resolve to the actual value
              if (resolveAliases) {
                // Resolve the alias to its actual value
                const resolvedValue = await resolveAliasValue(aliasVar, mode.modeId);
                if (typeof resolvedValue === 'object' && resolvedValue !== null && 'r' in resolvedValue) {
                  exportValue = ColorConverter.toAllFormats(resolvedValue as RGBA);
                } else {
                  exportValue = resolvedValue as string | number | boolean;
                }
                // Don't mark as alias since we resolved it
                isAlias = false;
              } else {
                // Keep as alias reference
                // Convert alias reference to match naming convention
                const aliasPath = aliasVar.name.split('/').map(p => NamingConverter.convert(p, namingConvention)).join('.');
                aliasRef = `{${aliasPath}}`;
                exportValue = aliasRef;
                
                // Get the resolved local value for library aliases
                if (isLibraryAlias) {
                  // Get the resolved value from the alias
                  const resolvedValue = aliasVar.valuesByMode[Object.keys(aliasVar.valuesByMode)[0]];
                  if (typeof resolvedValue === 'object' && resolvedValue !== null && 'r' in resolvedValue) {
                    localValue = ColorConverter.toAllFormats(resolvedValue as RGBA);
                  } else if (!isVariableAlias(resolvedValue)) {
                    localValue = resolvedValue as string | number | boolean;
                  }
                }
              }
            } else {
              exportValue = '';
            }
          } else if (typeof value === 'object' && value !== null && 'r' in value) {
            exportValue = ColorConverter.toAllFormats(value as RGBA);
          } else {
            exportValue = value as string | number | boolean;
          }
          
          const varExport: ExportVariableValue = {
            $scopes: TypeMapper.scopesToArray(variable.scopes),
            $type: TypeMapper.toExportType(variable.resolvedType),
            $value: exportValue,
            ...(variable.description && { $description: variable.description }),
            // Always include $collectionName for aliases (needed for cross-collection alias resolution during import)
            ...(isAlias && aliasCollection && { $collectionName: aliasCollection }),
            ...(isAlias && isLibraryAlias && { 
              $libraryRef: aliasRef, 
              ...(localValue !== undefined && { $localValue: localValue })
            })
          };
          
          current[leafName] = varExport;
        }
      }
      
      exportData.push(collectionExport);
      
      // Also build W3C format if needed
      if (exportFormat === 'w3c') {
        w3cExportData[exportCollectionName] = W3CConverter.collectionToW3C(
          exportCollectionName,
          collectionExport[exportCollectionName].modes,
          namingConvention,
          collectionExport[exportCollectionName].$originalName
        );
      }
    }
    
    // Export styles
    let stylesExported: StylesExport | null = null;
    if (styleOptions) {
      stylesExported = {};
      if (styleOptions.colorStyles) stylesExported.colorStyles = await ColorStyleProcessor.export({ includeImages });
      if (styleOptions.textStyles) stylesExported.textStyles = await TextStyleProcessor.export();
      if (styleOptions.effectStyles) stylesExported.effectStyles = await EffectStyleProcessor.export();
      if (styleOptions.gridStyles) stylesExported.gridStyles = await GridStyleProcessor.export();
      
      if (Object.keys(stylesExported).length > 0) {
        exportData.push({ _styles: stylesExported });
      } else {
        stylesExported = null;
      }
    }
    
    const stats: ExportStats = {
      collections: collections.length,
      variables: totalVariables,
      styles: stylesExported ? {
        color: stylesExported.colorStyles?.length ?? 0,
        text: stylesExported.textStyles?.length ?? 0,
        effect: stylesExported.effectStyles?.length ?? 0,
        grid: stylesExported.gridStyles?.length ?? 0
      } : null
    };
    
    // Choose output format
    let outputData: string;
    if (exportFormat === 'w3c') {
      // W3C Design Tokens format
      // Note: Styles are not part of W3C spec, so we add them in extensions
      if (stylesExported && Object.keys(stylesExported).length > 0) {
        w3cExportData['$extensions'] = {
          'com.figma': {
            styles: stylesExported
          }
        } as unknown as W3CTokenGroup;
      }
      outputData = JSON.stringify(w3cExportData, null, 2);
      Logger.log(`✅ Export complete (W3C format): ${stats.collections} collections, ${stats.variables} variables`);
    } else {
      // Figma JSON format
      outputData = JSON.stringify(exportData, null, 2);
      Logger.log(`✅ Export complete: ${stats.collections} collections, ${stats.variables} variables`);
    }
    
    Logger.send('export_complete', {
      data: outputData,
      stats,
      format: exportFormat
    });
    
  } catch (e) {
    Logger.log(`❌ Export error: ${e}`);
    Logger.send('error', { message: `Export failed: ${e}` });
  }
}

// ============================================================================
// SECTION 12: IMPORT ORCHESTRATOR
// ============================================================================

async function importVariables(jsonData: string, options: ImportOptions): Promise<void> {
  Logger.log('📥 Starting import...');
  Logger.log(`📋 Import options: merge=${options.merge}, clearFirst=${options.clearFirst}, importStyles=${options.importStyles}`);
  
  // Create a snapshot BEFORE making any changes for automatic rollback on error
  Logger.log('📸 Creating pre-import snapshot for automatic rollback...');
  let preImportSnapshot: UndoSnapshot | null = null;
  try {
    preImportSnapshot = await createUndoSnapshot();
    Logger.log('✅ Pre-import snapshot created');
  } catch (snapshotError) {
    Logger.log(`⚠️ Could not create pre-import snapshot: ${snapshotError}`);
    // Continue without snapshot - user will be warned if import fails
  }
  
  try {
    let parsedData = JSON.parse(jsonData);
    
    // Detect format and convert if W3C
    let importData: ExportFormat;
    let detectedFormat: 'figma' | 'w3c' = 'figma';
    
    if (!Array.isArray(parsedData) && W3CConverter.isW3CFormat(parsedData)) {
      Logger.log('📄 Detected W3C Design Tokens format, converting...');
      detectedFormat = 'w3c';
      
      // Extract styles from extensions if present
      const w3cData = parsedData as Record<string, W3CTokenGroup>;
      let stylesFromW3C: StylesExport | null = null;
      
      if (w3cData['$extensions'] && (w3cData['$extensions'] as Record<string, unknown>)['com.figma']) {
        const figmaExtensions = (w3cData['$extensions'] as Record<string, unknown>)['com.figma'] as Record<string, unknown>;
        if (figmaExtensions.styles) {
          stylesFromW3C = figmaExtensions.styles as StylesExport;
        }
        // Remove extensions from token data
        delete w3cData['$extensions'];
      }
      
      // Convert W3C to Figma format
      const converted = W3CConverter.w3cToFigmaFormat(w3cData);
      importData = converted as unknown as ExportFormat;
      
      // Add styles if present
      if (stylesFromW3C) {
        importData.push({ _styles: stylesFromW3C });
      }
    } else {
      importData = parsedData as ExportFormat;
    }
    
    // Handle Clean Import: clear everything first
    if (options.clearFirst) {
      Logger.log('🧹 Clean Import: Clearing existing variables and styles...');
      await clearAll();
      Logger.log('✅ Clean Import: Clearing complete, rebuilding cache...');
      // Reinitialize cache after clearing
      await variableCache.rebuild();
      Logger.log('✅ Clean Import: Cache rebuilt, proceeding with import...');
    }
    
    // Handle Custom Merge: selectively clear variables and/or styles
    if (options.customMerge) {
      const { clearVariables: shouldClearVars, clearStyles: shouldClearStyles } = options.customMerge;
      if (shouldClearVars && shouldClearStyles) {
        Logger.log('🎯 Custom Merge: Clearing both variables and styles...');
        await clearAll();
      } else if (shouldClearVars) {
        Logger.log('🎯 Custom Merge: Clearing variables only...');
        await clearVariables();
      } else if (shouldClearStyles) {
        Logger.log('🎯 Custom Merge: Clearing styles only...');
        await clearStyles();
      }
      Logger.log('✅ Custom Merge: Clearing complete, rebuilding cache...');
      await variableCache.rebuild();
    }
    
    await variableCache.initialize();
    
    let createdCollections = 0;
    let createdVariables = 0;
    let updatedVariables = 0;
    let skippedVariables = 0;
    let stylesCreated = 0;
    let stylesUpdated = 0;
    
    // Separate styles from collections
    let stylesData: StylesExport | null = null;
    const collectionData: CollectionExport[] = [];
    
    for (const item of importData) {
      const keys = Object.keys(item);
      if (keys.length === 1 && keys[0] === '_styles') {
        stylesData = (item as { _styles: StylesExport })._styles;
      } else {
        collectionData.push(item as CollectionExport);
      }
    }
    
    // Collect all pending aliases across all collections for pass 2
    const allPendingAliases: Array<{
      variable: Variable;
      modeId: string;
      aliasPath: string;
      aliasCollection: string;
      fallbackValue: ExportVariableValue;
    }> = [];
    
    // Process collections - PASS 1: Create variables with raw values
    Logger.log(`📥 Pass 1: Processing ${collectionData.length} collections...`);
    for (const collectionObj of collectionData) {
      const jsonCollectionName = Object.keys(collectionObj)[0];
      const collectionContent = collectionObj[jsonCollectionName];
      
      // Use $originalName if present (for round-trip with code-friendly naming)
      // This restores original Figma names when importing JSON that was exported with naming conventions
      const collectionName = collectionContent.$originalName || jsonCollectionName;
      
      Logger.log(`Processing collection: ${jsonCollectionName}${collectionContent.$originalName ? ` (original: ${collectionName})` : ''}`);
      
      // Get per-collection behavior (default to merge in simple mode)
      // Check both JSON name and original name for behavior lookup
      const collectionBehavior = options.collectionBehaviors?.[jsonCollectionName] || 
                                  options.collectionBehaviors?.[collectionName] || 'merge';
      
      let collection: VariableCollection;
      const existingCollection = variableCache.getCollection(collectionName);
      
      if (existingCollection) {
        // Handle per-collection behavior (Advanced mode)
        if (collectionBehavior === 'replace') {
          // Replace mode: delete existing collection and create fresh
          Logger.log(`  Replacing collection: ${collectionName}`);
          try {
            existingCollection.remove();
            variableCache.removeCollection(collectionName);
            collection = figma.variables.createVariableCollection(collectionName);
            variableCache.setCollection(collectionName, collection);
            createdCollections++;
            Logger.log(`  Created fresh collection (replaced)`);
          } catch (e) {
            Logger.log(`  ⚠️ Could not replace collection: ${e}`);
            continue;
          }
        } else if (!options.merge) {
          Logger.log(`  Skipping existing collection: ${collectionName}`);
          continue;
        } else {
          collection = existingCollection;
          Logger.log(`  Merging into existing collection`);
        }
      } else {
        collection = figma.variables.createVariableCollection(collectionName);
        variableCache.setCollection(collectionName, collection);
        createdCollections++;
        Logger.log(`  Created new collection`);
      }
      
      // Setup modes
      const modeNames = Object.keys(collectionContent.modes);
      const modeMap = new Map<string, string>();
      
      for (const mode of collection.modes) {
        modeMap.set(mode.name, mode.modeId);
      }
      
      if (collection.modes.length === 1 && !modeMap.has(modeNames[0])) {
        collection.renameMode(collection.modes[0].modeId, modeNames[0]);
        modeMap.set(modeNames[0], collection.modes[0].modeId);
      }
      
      for (const modeName of modeNames) {
        if (!modeMap.has(modeName)) {
          try {
            const newModeId = collection.addMode(modeName);
            modeMap.set(modeName, newModeId);
          } catch (e) {
            Logger.log(`  ⚠️ Could not create mode ${modeName}: ${e}`);
          }
        }
      }
      
      // Process variables - TWO PASS APPROACH
      // Pass 1: Create all variables and set RAW values only (skip aliases)
      // Pass 2: Set ALIAS values (now all target variables exist)
      const firstModeVars = collectionContent.modes[modeNames[0]];
      const variablePaths = flattenVariables(firstModeVars, '');
      
      // Store pending alias assignments for pass 2
      const pendingAliases: Array<{
        variable: Variable;
        modeId: string;
        aliasPath: string;
        aliasCollection: string;
        fallbackValue: ExportVariableValue;
      }> = [];
      
      // PASS 1: Create variables and set raw values
      Logger.log(`  Pass 1: Creating variables with raw values...`);
      for (const { path, value } of variablePaths) {
        const fullPath = `${collectionName}/${path}`;
        
        let variable: Variable;
        const existingVar = variableCache.getVariable(fullPath);
        
        if (existingVar) {
          if (!options.overwrite) {
            skippedVariables++;
            continue;
          }
          variable = existingVar;
          updatedVariables++;
        } else {
          try {
            variable = figma.variables.createVariable(
              path,
              collection,
              TypeMapper.toFigmaType(value.$type)
            );
            createdVariables++;
          } catch (e) {
            Logger.log(`  ⚠️ Could not create variable ${path}: ${e}`);
            continue;
          }
        }
        
        if (value.$description) {
          variable.description = value.$description;
        }
        
        try {
          variable.scopes = TypeMapper.arrayToScopes(value.$scopes as string[]);
        } catch { /* Skip */ }
        
        // Set values for each mode - raw values only in pass 1, queue aliases for pass 2
        for (const modeName of modeNames) {
          const modeId = modeMap.get(modeName);
          if (!modeId) continue;
          
          const modeValue = getValueAtPath(collectionContent.modes[modeName], path);
          if (!modeValue) continue;
          
          if (typeof modeValue.$value === 'string' && modeValue.$value.startsWith('{')) {
            // This is an alias - queue for pass 2
            const aliasPath = modeValue.$value.slice(1, -1).replace(/\./g, '/');
            const aliasCollection = modeValue.$collectionName || collectionName;
            pendingAliases.push({
              variable,
              modeId,
              aliasPath,
              aliasCollection,
              fallbackValue: modeValue
            });
            // Set a temporary raw value in case alias resolution fails
            setRawValue(variable, modeId, modeValue);
          } else {
            // Raw value - set immediately
            setRawValue(variable, modeId, modeValue);
          }
        }
        
        variableCache.setVariable(fullPath, variable);
      }
      
      // Store pending aliases for this collection (will be processed after all collections)
      allPendingAliases.push(...pendingAliases);
    }
    
    // PASS 2: Resolve all aliases (now all variables from all collections exist)
    Logger.log(`📥 Pass 2: Resolving ${allPendingAliases.length} alias references...`);
    await variableCache.rebuild(); // Ensure cache has all newly created variables
    
    let aliasesResolved = 0;
    let aliasesFailed = 0;
    
    for (const pending of allPendingAliases) {
      const targetVar = variableCache.getVariable(`${pending.aliasCollection}/${pending.aliasPath}`);
      
      if (targetVar) {
        try {
          pending.variable.setValueForMode(pending.modeId, { type: 'VARIABLE_ALIAS', id: targetVar.id });
          aliasesResolved++;
        } catch (e) {
          // Alias failed, raw value was already set as fallback
          aliasesFailed++;
          Logger.log(`  ⚠️ Could not set alias for ${pending.variable.name}: ${e}`);
        }
      } else {
        // Target not found, raw value was already set as fallback
        aliasesFailed++;
        Logger.log(`  ⚠️ Alias target not found: ${pending.aliasCollection}/${pending.aliasPath}`);
      }
    }
    
    if (allPendingAliases.length > 0) {
      Logger.log(`  ✅ Aliases: ${aliasesResolved} resolved, ${aliasesFailed} used fallback values`);
    }
    
    // Import styles
    if (stylesData && options.importStyles) {
      Logger.log('📦 Importing styles...');
      await variableCache.rebuild();
      
      if (stylesData.colorStyles) {
        const r = await ColorStyleProcessor.importStyles(stylesData.colorStyles, variableCache);
        stylesCreated += r.created;
        stylesUpdated += r.updated;
      }
      if (stylesData.textStyles) {
        const r = await TextStyleProcessor.importStyles(stylesData.textStyles, variableCache);
        stylesCreated += r.created;
        stylesUpdated += r.updated;
      }
      if (stylesData.effectStyles) {
        const r = await EffectStyleProcessor.importStyles(stylesData.effectStyles, variableCache);
        stylesCreated += r.created;
        stylesUpdated += r.updated;
      }
      if (stylesData.gridStyles) {
        const r = await GridStyleProcessor.importStyles(stylesData.gridStyles, variableCache);
        stylesCreated += r.created;
        stylesUpdated += r.updated;
      }
    }
    
    const stats: ImportStats = {
      collectionsCreated: createdCollections,
      variablesCreated: createdVariables,
      variablesUpdated: updatedVariables,
      variablesSkipped: skippedVariables,
      stylesCreated,
      stylesUpdated
    };
    
    Logger.log(`✅ Import complete!`);
    Logger.send('import_complete', { stats });
    
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    Logger.log(`❌ Import error: ${errorMessage}`);
    
    // Automatic rollback if we have a pre-import snapshot
    if (preImportSnapshot) {
      Logger.log('🔄 Attempting automatic rollback to pre-import state...');
      Logger.send('import_rolling_back', { error: errorMessage });
      
      try {
        await restoreFromSnapshot(preImportSnapshot);
        Logger.log('✅ Automatic rollback successful - file restored to pre-import state');
        Logger.send('import_rollback_complete', { 
          error: errorMessage,
          message: 'Import failed but your file has been automatically restored to its previous state.'
        });
      } catch (rollbackError) {
        const rollbackErrorMsg = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        Logger.log(`❌ Rollback failed: ${rollbackErrorMsg}`);
        Logger.send('import_rollback_failed', { 
          error: errorMessage,
          rollbackError: rollbackErrorMsg,
          message: 'Import failed and automatic rollback also failed. Please use Ctrl+Z (Cmd+Z) to undo manually.'
        });
      }
    } else {
      // No snapshot available - just report the error
      Logger.send('error', { 
        message: `Import failed: ${errorMessage}. Use Ctrl+Z (Cmd+Z) to undo changes.`
      });
    }
  }
}

function setRawValue(variable: Variable, modeId: string, value: ExportVariableValue): void {
  try {
    if (value.$type === 'color') {
      const rgba = ColorParser.parse(value.$value);
      const finalRgba = rgba.a < 1 
        ? { ...rgba, a: MathUtils.round2(rgba.a) }
        : rgba;
      variable.setValueForMode(modeId, finalRgba);
    } else {
      variable.setValueForMode(modeId, value.$value as string | number | boolean);
    }
  } catch (e) {
    console.error(`Could not set value: ${e}`);
  }
}

// ============================================================================
// SECTION 13: COLLECTION INFO
// ============================================================================

async function getCollections(): Promise<void> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  
  // Log the raw order from Figma API
  Logger.log(`📋 Figma API returned ${collections.length} collections in this order:`);
  collections.forEach((c, i) => {
    Logger.log(`  ${i + 1}. "${c.name}" (id: ${c.id})`);
  });
  
  // Track library dependencies and aliases
  const libraryDependencies = new Set<string>();
  let totalAliases = 0;
  let localAliases = 0;
  let libraryAliases = 0;
  
  // Process sequentially to preserve exact order
  const data = [];
  for (let index = 0; index < collections.length; index++) {
    const c = collections[index];
    const types = { color: 0, float: 0, boolean: 0, string: 0 };
    
    for (const varId of c.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable) {
        const typeStr = TypeMapper.toExportType(variable.resolvedType);
        types[typeStr as keyof typeof types]++;
        
        // Check for aliases in all modes
        for (const modeId of Object.keys(variable.valuesByMode)) {
          const value = variable.valuesByMode[modeId];
          if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS') {
            totalAliases++;
            const aliasedVar = await figma.variables.getVariableByIdAsync(value.id);
            if (aliasedVar) {
              const aliasedCollection = await figma.variables.getVariableCollectionByIdAsync(aliasedVar.variableCollectionId);
              if (aliasedCollection) {
                // Check if it's from a remote/library collection
                if (aliasedCollection.remote) {
                  libraryDependencies.add(aliasedCollection.name);
                  libraryAliases++;
                } else {
                  localAliases++;
                }
              }
            }
          }
        }
      }
    }
    
    data.push({
      id: c.id,
      name: c.name,
      modes: c.modes.map(m => m.name),
      variableCount: c.variableIds.length,
      types
    });
  }
  
  // Sort alphabetically since Figma API doesn't preserve Variables panel order
  data.sort((a, b) => a.name.localeCompare(b.name));
  
  // Get styles and font info
  const paintStyles = await figma.getLocalPaintStylesAsync();
  const textStyles = await figma.getLocalTextStylesAsync();
  const effectStyles = await figma.getLocalEffectStylesAsync();
  const gridStyles = await figma.getLocalGridStylesAsync();
  
  // Count only exportable paint styles (those with SOLID, GRADIENT, or IMAGE paints)
  let exportablePaintStylesCount = 0;
  for (const style of paintStyles) {
    if (style.paints.length === 0) continue;
    const hasExportablePaint = style.paints.some(p => 
      p.type === 'SOLID' || 
      p.type === 'GRADIENT_LINEAR' || 
      p.type === 'GRADIENT_RADIAL' || 
      p.type === 'GRADIENT_ANGULAR' || 
      p.type === 'GRADIENT_DIAMOND' || 
      p.type === 'IMAGE'
    );
    if (hasExportablePaint) exportablePaintStylesCount++;
  }
  
  const styles = {
    colorStyles: exportablePaintStylesCount,
    textStyles: textStyles.length,
    effectStyles: effectStyles.length,
    gridStyles: gridStyles.length
  };
  
  // Extract font info from text styles
  const fontsUsed = new Map<string, Set<string>>();
  for (const style of textStyles) {
    const family = style.fontName.family;
    const fontStyle = style.fontName.style;
    if (!fontsUsed.has(family)) {
      fontsUsed.set(family, new Set());
    }
    fontsUsed.get(family)!.add(fontStyle);
  }
  
  const fontsList = Array.from(fontsUsed.entries()).map(([family, styles]) => ({
    family,
    styles: Array.from(styles)
  }));
  
  // Count variable bindings in paint styles
  let styleBindingsCount = 0;
  for (const style of paintStyles) {
    if (style.boundVariables && Object.keys(style.boundVariables).length > 0) {
      styleBindingsCount++;
    }
  }
  
  Logger.send('collections', { 
    collections: data, 
    styles,
    libraryDependencies: Array.from(libraryDependencies),
    fontsUsed: fontsList,
    stats: {
      totalVariables: data.reduce((sum, c) => sum + c.variableCount, 0),
      totalAliases,
      localAliases,
      libraryAliases,
      styleBindings: styleBindingsCount
    }
  });
}

async function getVariablesForCollection(collectionName: string): Promise<void> {
  const allCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const collection = allCollections.find(c => c.name === collectionName);
  
  if (!collection) {
    Logger.send('variables', { variables: [] });
    return;
  }
  
  const variables = (await Promise.all(collection.variableIds
    .map(async id => {
      const v = await figma.variables.getVariableByIdAsync(id);
      return v ? { name: v.name, type: v.resolvedType } : null;
    })))
    .filter(Boolean);
  
  Logger.send('variables', { variables });
}

// ============================================================================
// SECTION 14: CLEAR FUNCTIONS
// ============================================================================

async function clearVariables(): Promise<void> {
  Logger.log('🗑️ Clearing all variables...');
  
  try {
    let deletedCollections = 0;
    let deletedVariables = 0;
    
    for (const collection of await figma.variables.getLocalVariableCollectionsAsync()) {
      for (const varId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(varId);
        if (variable) {
          variable.remove();
          deletedVariables++;
        }
      }
      collection.remove();
      deletedCollections++;
    }
    
    Logger.log(`✅ Cleared ${deletedCollections} collections, ${deletedVariables} variables`);
    Logger.send('clear_complete', { message: `${deletedCollections} collections, ${deletedVariables} variables` });
  } catch (e) {
    Logger.log(`❌ Clear variables error: ${e}`);
    Logger.send('error', { message: `Failed to clear variables: ${e}` });
  }
}

async function clearStyles(): Promise<void> {
  Logger.log('🗑️ Clearing all styles...');
  
  try {
    let deletedStyles = 0;
    
    for (const style of await figma.getLocalPaintStylesAsync()) { style.remove(); deletedStyles++; }
    for (const style of await figma.getLocalTextStylesAsync()) { style.remove(); deletedStyles++; }
    for (const style of await figma.getLocalEffectStylesAsync()) { style.remove(); deletedStyles++; }
    for (const style of await figma.getLocalGridStylesAsync()) { style.remove(); deletedStyles++; }
    
    Logger.log(`✅ Cleared ${deletedStyles} styles`);
    Logger.send('clear_complete', { message: `${deletedStyles} styles` });
  } catch (e) {
    Logger.log(`❌ Clear styles error: ${e}`);
    Logger.send('error', { message: `Failed to clear styles: ${e}` });
  }
}

async function clearAll(): Promise<void> {
  Logger.log('🗑️ Clearing everything...');
  
  try {
    await clearVariables();
    await clearStyles();
  } catch (e) {
    Logger.log(`❌ Clear all error: ${e}`);
    Logger.send('error', { message: `Failed to clear: ${e}` });
  }
}

// Create a snapshot of current variables and styles for undo
async function createUndoSnapshot(): Promise<UndoSnapshot> {
  Logger.log('📸 Creating snapshot of current file state...');
  
  // Export all collections using simplified internal format
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const snapshotCollections: unknown[] = [];
  
  for (const collection of collections) {
    const collectionSnapshot: Record<string, unknown> = {
      name: collection.name,
      modes: collection.modes.map(m => ({ id: m.modeId, name: m.name })),
      variables: [] as unknown[]
    };
    
    // Process variables
    for (const variableId of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (!variable) continue;
      
      const varSnapshot: Record<string, unknown> = {
        name: variable.name,
        type: variable.resolvedType,
        scopes: [...variable.scopes],
        values: {} as Record<string, unknown>
      };
      
      for (const mode of collection.modes) {
        const value = variable.valuesByMode[mode.modeId];
        
        if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS') {
          // Handle alias
          const aliasId = (value as VariableAlias).id;
          const aliasVariable = await figma.variables.getVariableByIdAsync(aliasId);
          if (aliasVariable) {
            const aliasCollection = await figma.variables.getVariableCollectionByIdAsync(aliasVariable.variableCollectionId);
            (varSnapshot.values as Record<string, unknown>)[mode.name] = {
              isAlias: true,
              aliasName: aliasVariable.name,
              aliasCollection: aliasCollection?.name || ''
            };
          }
        } else {
          // Handle raw values
          if (variable.resolvedType === 'COLOR') {
            const rgba = value as RGBA;
            (varSnapshot.values as Record<string, unknown>)[mode.name] = {
              isAlias: false,
              value: ColorConverter.toHex(rgba)
            };
          } else {
            (varSnapshot.values as Record<string, unknown>)[mode.name] = {
              isAlias: false,
              value: value
            };
          }
        }
      }
      
      (collectionSnapshot.variables as unknown[]).push(varSnapshot);
    }
    
    snapshotCollections.push(collectionSnapshot);
  }
  
  // Export all styles
  const stylesExport: StylesExport = {
    colorStyles: await ColorStyleProcessor.export({ includeImages: true }),
    textStyles: await TextStyleProcessor.export(),
    effectStyles: await EffectStyleProcessor.export(),
    gridStyles: await GridStyleProcessor.export()
  };
  
  const colorCount = stylesExport.colorStyles?.length || 0;
  Logger.log(`📸 Snapshot captured: ${collections.length} collections, ${colorCount} color styles`);
  
  return {
    timestamp: Date.now(),
    collections: JSON.stringify(snapshotCollections),
    styles: JSON.stringify(stylesExport)
  };
}

// Restore file state from a snapshot (undo)
async function restoreFromSnapshot(snapshot: UndoSnapshot): Promise<void> {
  Logger.log('↩️ Restoring file from snapshot...');
  
  // Step 1: Clear everything
  Logger.log('  Step 1: Clearing current state...');
  await clearAll();
  await variableCache.rebuild();
  
  // Step 2: Restore collections and variables
  const snapshotCollections = JSON.parse(snapshot.collections) as Array<{
    name: string;
    modes: Array<{ id: string; name: string }>;
    variables: Array<{
      name: string;
      type: VariableResolvedDataType;
      scopes: string[];
      values: Record<string, { isAlias: boolean; value?: unknown; aliasName?: string; aliasCollection?: string }>;
    }>;
  }>;
  
  Logger.log(`  Step 2: Restoring ${snapshotCollections.length} collections...`);
  
  // First pass: Create collections and variables with raw values
  const pendingAliases: Array<{
    variable: Variable;
    modeId: string;
    aliasPath: string;
    aliasCollection: string;
  }> = [];
  
  for (const collSnapshot of snapshotCollections) {
    // Create collection
    const newCollection = figma.variables.createVariableCollection(collSnapshot.name);
    
    // Setup modes
    if (collSnapshot.modes.length > 0) {
      // Rename first mode
      newCollection.renameMode(newCollection.modes[0].modeId, collSnapshot.modes[0].name);
      
      // Add additional modes
      for (let i = 1; i < collSnapshot.modes.length; i++) {
        newCollection.addMode(collSnapshot.modes[i].name);
      }
    }
    
    // Get mode mapping
    const modeMap: Record<string, string> = {};
    for (const mode of newCollection.modes) {
      modeMap[mode.name] = mode.modeId;
    }
    
    // Process variables
    for (const varSnapshot of collSnapshot.variables) {
      // Create variable - pass collection node, not ID (required for incremental mode)
      const newVar = figma.variables.createVariable(varSnapshot.name, newCollection, varSnapshot.type);
      
      // Set scopes if available
      if (varSnapshot.scopes && varSnapshot.scopes.length > 0) {
        newVar.scopes = varSnapshot.scopes as VariableScope[];
      }
      
      // Set values for each mode
      for (const modeSnapshot of collSnapshot.modes) {
        const modeId = modeMap[modeSnapshot.name];
        const modeValue = varSnapshot.values[modeSnapshot.name];
        
        if (!modeValue) continue;
        
        if (modeValue.isAlias && modeValue.aliasName) {
          // Queue alias for second pass
          pendingAliases.push({
            variable: newVar,
            modeId,
            aliasPath: modeValue.aliasName,
            aliasCollection: modeValue.aliasCollection || collSnapshot.name
          });
        } else if (modeValue.value !== undefined) {
          // Set raw value
          let rawValue: VariableValue;
          
          if (varSnapshot.type === 'COLOR' && typeof modeValue.value === 'string') {
            rawValue = ColorParser.parse(modeValue.value);
          } else {
            rawValue = modeValue.value as VariableValue;
          }
          
          newVar.setValueForMode(modeId, rawValue);
        }
      }
    }
  }
  
  // Second pass: Resolve aliases
  Logger.log(`  Step 3: Resolving ${pendingAliases.length} aliases...`);
  await variableCache.rebuild();
  
  for (const alias of pendingAliases) {
    const targetKey = `${alias.aliasCollection}/${alias.aliasPath}`;
    const targetVar = variableCache.getVariable(targetKey);
    
    if (targetVar) {
      alias.variable.setValueForMode(alias.modeId, { type: 'VARIABLE_ALIAS', id: targetVar.id });
    }
  }
  
  // Step 4: Restore styles
  const stylesData = JSON.parse(snapshot.styles) as StylesExport;
  Logger.log('  Step 4: Restoring styles...');
  
  if (stylesData.colorStyles && stylesData.colorStyles.length > 0) {
    await ColorStyleProcessor.importStyles(stylesData.colorStyles, variableCache);
  }
  if (stylesData.textStyles && stylesData.textStyles.length > 0) {
    await TextStyleProcessor.importStyles(stylesData.textStyles, variableCache);
  }
  if (stylesData.effectStyles && stylesData.effectStyles.length > 0) {
    await EffectStyleProcessor.importStyles(stylesData.effectStyles, variableCache);
  }
  if (stylesData.gridStyles && stylesData.gridStyles.length > 0) {
    await GridStyleProcessor.importStyles(stylesData.gridStyles, variableCache);
  }
  
  Logger.log('✅ File restored from snapshot');
}

// ============================================================================
// SECTION 15: MESSAGE HANDLER
// ============================================================================

figma.ui.onmessage = async (msg: { type: string; [key: string]: unknown }) => {
  switch (msg.type) {
    case 'export':
      await exportVariables(
        msg.collections as string[] | undefined,
        msg.styleOptions as StyleOptions | undefined,
        msg.preserveLibraryRefs as boolean | undefined,
        msg.includeImages as boolean | undefined,
        (msg.namingConvention as NamingConvention) || 'original',
        (msg.exportFormat as ExportFormatType) || 'figma',
        msg.selectedModes as Record<string, string[]> | undefined,
        (msg.resolveAliases as boolean) || false
      );
      break;
      
    case 'import':
      await importVariables(
        msg.data as string,
        msg.options as ImportOptions
      );
      break;
      
    case 'validate_import':
      // Pre-import validation to check plan limits
      try {
        const importData = JSON.parse(msg.data as string) as ExportFormat;
        const planOverride = msg.plan as FigmaPlan | undefined;
        const validation = await validateImportAgainstPlan(importData, planOverride);
        Logger.send('validation_result', validation);
      } catch (e) {
        Logger.send('validation_result', {
          errors: [`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`],
          canImport: false
        });
      }
      break;
    
    case 'compute_import_diff':
      // Compute what will change before importing
      try {
        const diffData = JSON.parse(msg.data as string);
        const diff = await computeImportDiff(diffData);
        Logger.send('import_diff_result', diff);
      } catch (e) {
        Logger.send('import_diff_result', {
          error: `Failed to compute diff: ${e instanceof Error ? e.message : 'Unknown error'}`
        });
      }
      break;
      
    case 'detect_plan':
      // Detect current plan based on existing collections
      const detectedPlan = await detectCurrentPlan();
      Logger.send('plan_detected', detectedPlan);
      break;
      
    case 'clear_variables':
      await clearVariables();
      break;
      
    case 'clear_styles':
      await clearStyles();
      break;
      
    case 'clear_all':
      await clearAll();
      break;
      
    case 'get_collections':
      await getCollections();
      break;
      
    case 'get_variables':
      await getVariablesForCollection(msg.collection as string);
      break;
      
    case 'check_libraries':
      // Check if required library collections are available
      try {
        const requiredCollections = msg.collections as string[];
        const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
        const localCollectionNames = localCollections.map(c => c.name);
        
        // Check for external library collections (remote)
        // Note: Figma API doesn't provide direct access to team library collections
        // We can only check if variables referencing those libraries can be resolved
        
        const availableCollections: string[] = [];
        const missingCollections: string[] = [];
        
        for (const collectionName of requiredCollections) {
          if (localCollectionNames.includes(collectionName)) {
            availableCollections.push(collectionName);
          } else {
            // Try to find in team libraries (this is a best-effort check)
            // Team library collections might still be available for referencing
            missingCollections.push(collectionName);
          }
        }
        
        Logger.send('library_check_result', {
          allAvailable: missingCollections.length === 0,
          availableCollections,
          missingCollections,
          requiredCollections
        });
      } catch (e) {
        Logger.send('library_check_result', {
          allAvailable: false,
          availableCollections: [],
          missingCollections: msg.collections || [],
          requiredCollections: msg.collections || [],
          error: e instanceof Error ? e.message : 'Library check failed'
        });
      }
      break;
      
    case 'check_fonts':
      // Check if required fonts are available
      try {
        const requiredFonts = msg.fonts as Array<{ family: string; style: string }>;
        const availableFonts: Array<{ family: string; style: string }> = [];
        const missingFonts: Array<{ family: string; style: string }> = [];
        
        // Check each font by attempting to load it
        for (const font of requiredFonts) {
          try {
            await figma.loadFontAsync({ family: font.family, style: font.style });
            availableFonts.push(font);
          } catch {
            missingFonts.push(font);
          }
        }
        
        Logger.send('font_check_result', {
          allAvailable: missingFonts.length === 0,
          availableFonts,
          missingFonts,
          requiredFonts
        });
      } catch (e) {
        Logger.send('font_check_result', {
          allAvailable: false,
          availableFonts: [],
          missingFonts: msg.fonts || [],
          requiredFonts: msg.fonts || [],
          error: e instanceof Error ? e.message : 'Font check failed'
        });
      }
      break;
    
    case 'create_undo_snapshot':
      // Create a snapshot of current variables and styles for undo capability
      try {
        Logger.log('📸 Creating undo snapshot...');
        const snapshot = await createUndoSnapshot();
        Logger.send('snapshot_created', { snapshot });
        Logger.log('✅ Undo snapshot created successfully');
      } catch (e) {
        Logger.log(`❌ Failed to create snapshot: ${e instanceof Error ? e.message : 'Unknown error'}`);
        Logger.send('snapshot_error', { error: e instanceof Error ? e.message : 'Failed to create snapshot' });
      }
      break;
    
    case 'undo_import':
      // Restore file to pre-import state using snapshot
      try {
        Logger.log('↩️ Undoing import using snapshot...');
        const snapshotData = msg.snapshot as UndoSnapshot;
        await restoreFromSnapshot(snapshotData);
        Logger.send('undo_complete', {});
        Logger.log('✅ Import undone successfully');
      } catch (e) {
        Logger.log(`❌ Undo failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        Logger.send('undo_error', { error: e instanceof Error ? e.message : 'Undo failed' });
      }
      break;
      
    case 'close':
      figma.closePlugin();
      break;
  }
};
