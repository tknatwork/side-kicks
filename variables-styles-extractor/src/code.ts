/**
 * ☕️ Variables & Styles Extractor - Figma Plugin
 * Export and import Figma variables and styles with full fidelity
 * 
 * @copyright 2025 Tushar Kant Naik / The Keep Collective
 * @license MIT - See LICENSE file
 * @version 1.6.0
 * @author Tushar Kant Naik <hi@tusharkantnaik.com>
 * @website https://tusharkantnaik.com
 */

// JSF-AV Compliant Architecture
// Increased UI size for better performance with large design systems
figma.showUI(__html__, { 
  width: 480, 
  height: 760,
  themeColors: true,
  title: '☕️ Variables & Styles Extractor v1.6.0'
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
  };
}

// Variable binding
interface VariableBinding {
  readonly id?: string;
  readonly name?: string;
  readonly collection?: string;
}

// Style export interfaces
interface ExportColorStyle {
  readonly name: string;
  readonly description?: string;
  readonly color: ExportColorValue;
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

// Import options
interface ImportOptions {
  readonly merge: boolean;
  readonly overwrite: boolean;
  readonly importStyles?: boolean;
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
    canImport: errors.length === 0
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
  export(): Promise<TExport[]>;
  importStyles(styles: TExport[], variables: VariableCache): Promise<{ created: number; updated: number }>;
}

// Color Style Processor
const ColorStyleProcessor: StyleProcessor<ExportColorStyle, PaintStyle> = {
  async export(): Promise<ExportColorStyle[]> {
    const styles: ExportColorStyle[] = [];
    
    for (const style of await figma.getLocalPaintStylesAsync()) {
      if (style.paints.length === 0) continue;
      const paint = style.paints[0];
      if (paint.type !== 'SOLID') continue;
      
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
      
      const colorStyle: ExportColorStyle = {
        name: style.name,
        color: ColorConverter.toAllFormats(colorWithAlpha),
        opacity: MathUtils.round2(effectiveOpacity),
        ...(style.description && { description: style.description }),
        boundVariables: await extractBindings((paint as unknown as Record<string, unknown>).boundVariables as Record<string, VariableAlias | undefined>, ['color'])
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
      
      style.paints = [paint];
    }
    
    return { created, updated };
  }
};

// Text Style Processor
const TextStyleProcessor: StyleProcessor<ExportTextStyle, TextStyle> = {
  async export(): Promise<ExportTextStyle[]> {
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
  async export(): Promise<ExportEffectStyle[]> {
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
  async export(): Promise<ExportGridStyle[]> {
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
// SECTION 11: EXPORT ORCHESTRATOR
// ============================================================================

async function exportVariables(
  selectedCollections?: string[], 
  styleOptions?: StyleOptions
): Promise<void> {
  Logger.log('📤 Starting export...');
  
  try {
    let collections = await figma.variables.getLocalVariableCollectionsAsync();
    
    if (selectedCollections?.length) {
      collections = collections.filter(c => selectedCollections.includes(c.name));
      Logger.log(`Filtering to ${collections.length} selected collections`);
    }
    
    const exportData: ExportFormat = [];
    let totalVariables = 0;
    
    for (const collection of collections) {
      Logger.log(`Processing collection: ${collection.name}`);
      
      const collectionExport: CollectionExport = {
        [collection.name]: { modes: {} }
      };
      
      // Initialize modes
      for (const mode of collection.modes) {
        collectionExport[collection.name].modes[mode.name] = {};
      }
      
      // Process variables
      for (const variableId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable) continue;
        
        totalVariables++;
        const nameParts = variable.name.split('/');
        
        for (const mode of collection.modes) {
          const modeValues = collectionExport[collection.name].modes[mode.name];
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
          
          if (isVariableAlias(value)) {
            const aliasVar = await figma.variables.getVariableByIdAsync(value.id);
            if (aliasVar) {
              const aliasCol = await figma.variables.getVariableCollectionByIdAsync(aliasVar.variableCollectionId);
              isAlias = true;
              aliasCollection = aliasCol?.name ?? '';
              exportValue = `{${aliasVar.name.replace(/\//g, '.')}}`;
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
            ...(isAlias && { $libraryName: '', $collectionName: aliasCollection })
          };
          
          current[leafName] = varExport;
        }
      }
      
      exportData.push(collectionExport);
    }
    
    // Export styles
    let stylesExported: StylesExport | null = null;
    if (styleOptions) {
      stylesExported = {};
      if (styleOptions.colorStyles) stylesExported.colorStyles = await ColorStyleProcessor.export();
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
    
    Logger.log(`✅ Export complete: ${stats.collections} collections, ${stats.variables} variables`);
    Logger.send('export_complete', {
      data: JSON.stringify(exportData, null, 2),
      stats
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
  
  try {
    const importData: ExportFormat = JSON.parse(jsonData);
    
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
    
    // Process collections
    for (const collectionObj of collectionData) {
      const collectionName = Object.keys(collectionObj)[0];
      const collectionContent = collectionObj[collectionName];
      
      Logger.log(`Processing collection: ${collectionName}`);
      
      let collection: VariableCollection;
      const existingCollection = variableCache.getCollection(collectionName);
      
      if (existingCollection) {
        if (!options.merge) {
          Logger.log(`  Skipping existing collection: ${collectionName}`);
          continue;
        }
        collection = existingCollection;
        Logger.log(`  Merging into existing collection`);
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
      
      // Process variables
      const firstModeVars = collectionContent.modes[modeNames[0]];
      const variablePaths = flattenVariables(firstModeVars, '');
      
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
        
        // Set values for each mode
        for (const modeName of modeNames) {
          const modeId = modeMap.get(modeName);
          if (!modeId) continue;
          
          const modeValue = getValueAtPath(collectionContent.modes[modeName], path);
          if (!modeValue) continue;
          
          if (typeof modeValue.$value === 'string' && modeValue.$value.startsWith('{')) {
            const aliasPath = modeValue.$value.slice(1, -1).replace(/\./g, '/');
            const aliasCollection = modeValue.$collectionName || collectionName;
            const targetVar = variableCache.getVariable(`${aliasCollection}/${aliasPath}`);
            
            if (targetVar) {
              try {
                variable.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: targetVar.id });
              } catch {
                setRawValue(variable, modeId, modeValue);
              }
            } else {
              setRawValue(variable, modeId, modeValue);
            }
          } else {
            setRawValue(variable, modeId, modeValue);
          }
        }
        
        variableCache.setVariable(fullPath, variable);
      }
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
    Logger.log(`❌ Import error: ${e}`);
    Logger.send('error', { message: `Import failed: ${e}` });
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
  
  const data = await Promise.all(collections.map(async c => {
    const types = { color: 0, float: 0, boolean: 0, string: 0 };
    
    for (const varId of c.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable) {
        const typeStr = TypeMapper.toExportType(variable.resolvedType);
        types[typeStr as keyof typeof types]++;
      }
    }
    
    return {
      id: c.id,
      name: c.name,
      modes: c.modes.map(m => m.name),
      variableCount: c.variableIds.length,
      types
    };
  }));
  
  const styles = {
    colorStyles: (await figma.getLocalPaintStylesAsync()).length,
    textStyles: (await figma.getLocalTextStylesAsync()).length,
    effectStyles: (await figma.getLocalEffectStylesAsync()).length,
    gridStyles: (await figma.getLocalGridStylesAsync()).length
  };
  
  Logger.send('collections', { collections: data, styles });
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

// ============================================================================
// SECTION 15: MESSAGE HANDLER
// ============================================================================

figma.ui.onmessage = async (msg: { type: string; [key: string]: unknown }) => {
  switch (msg.type) {
    case 'export':
      await exportVariables(
        msg.collections as string[] | undefined,
        msg.styleOptions as StyleOptions | undefined
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
      
    case 'close':
      figma.closePlugin();
      break;
  }
};
