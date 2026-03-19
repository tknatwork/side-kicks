/**
 * Token Schema — Type definitions for the 3-tier variable architecture.
 *
 * Adapted from Variables & Styles Extractor type definitions.
 * These types define the structure of all token/variable data in DSB.
 *
 * @module tokens/schema
 */

// ============================================================================
// SECTION 1: COLOR TYPES
// ============================================================================

export interface RgbColor {
  readonly r: number;  // 0-255
  readonly g: number;  // 0-255
  readonly b: number;  // 0-255
  readonly a?: number; // 0-1
}

export interface HslColor {
  readonly h: number;  // 0-360
  readonly s: number;  // 0-100
  readonly l: number;  // 0-100
  readonly a?: number; // 0-1
}

export interface HsbColor {
  readonly h: number;  // 0-360
  readonly s: number;  // 0-100
  readonly b: number;  // 0-100
  readonly a?: number; // 0-1
}

/** Figma-native RGBA format (0-1 range for all channels). */
export interface FigmaRgba {
  readonly r: number;  // 0-1
  readonly g: number;  // 0-1
  readonly b: number;  // 0-1
  readonly a: number;  // 0-1
}

/** Complete color representation across all formats. */
export interface ColorValue {
  readonly hex: string;
  readonly rgb: RgbColor;
  readonly css: string;
  readonly hsl: HslColor;
  readonly hsb: HsbColor;
}

// ============================================================================
// SECTION 2: VARIABLE TYPES
// ============================================================================

export type VariableValueType = 'color' | 'float' | 'string' | 'boolean';

/** The primitive value types a variable can hold. */
export type PrimitiveValue = string | number | boolean | ColorValue;

/** Reference to another variable (alias). */
export interface AliasReference {
  readonly type: 'alias';
  /** The target variable's name path (e.g., "color/pink-500"). */
  readonly target: string;
  /** The target variable's collection name. */
  readonly collection: string;
}

/** A variable value is either a primitive or an alias. */
export type VariableValue = PrimitiveValue | AliasReference;

/** Full variable definition with metadata. */
export interface VariableDefinition {
  readonly name: string;
  readonly type: VariableValueType;
  readonly description?: string;
  readonly scopes: readonly string[];
  /** Values per mode: { "Light": value, "Dark": value } */
  readonly values: Readonly<Record<string, VariableValue>>;
  /** Which tier this variable belongs to. */
  readonly tier: TierLevel;
  /** Whether to hide from publishing. */
  readonly hideFromPublishing?: boolean;
}

// ============================================================================
// SECTION 3: TIER ARCHITECTURE
// ============================================================================

export type TierLevel = 'primitives' | 'semantic' | 'component' | 'breakpoints';

/** Configuration for a single tier/collection. */
export interface TierConfig {
  readonly collectionName: string;
  readonly modes: readonly string[];
  readonly description?: string;
  readonly tier: TierLevel;
}

/** Complete 3-tier architecture definition. */
export interface TierArchitecture {
  readonly primitives: TierConfig;
  readonly semantic: TierConfig;
  readonly component: TierConfig;
  readonly breakpoints?: TierConfig;
}

// ============================================================================
// SECTION 4: COLLECTION & EXPORT TYPES
// ============================================================================

/** A group of variables organized by path (e.g., "color/pink-500"). */
export interface VariableGroup {
  readonly [name: string]: VariableDefinition;
}

/** A collection export — compatible with Variables & Styles Extractor format. */
export interface CollectionExport {
  readonly [collectionName: string]: {
    readonly modes: Readonly<Record<string, NestedVariables>>;
    readonly $originalName?: string;
  };
}

/** Nested variable structure within a mode. */
export interface NestedVariables {
  readonly [key: string]: ExportVariableValue | NestedVariables;
}

/** Export format for a single variable value. */
export interface ExportVariableValue {
  readonly $scopes: readonly string[];
  readonly $type: VariableValueType;
  readonly $description?: string;
  readonly $value: string | number | boolean | ColorValue;
  readonly $libraryName?: string;
  readonly $collectionName?: string;
  readonly $libraryRef?: string;
  readonly $localValue?: string | number | boolean | ColorValue;
}

// ============================================================================
// SECTION 5: DESIGN SYSTEM SPEC
// ============================================================================

/** The complete specification that the Conversation Agent produces. */
export interface DesignSystemSpec {
  readonly name: string;
  readonly version: string;
  readonly createdAt: string;
  readonly framework: FrameworkTarget;
  readonly tiers: TierArchitecture;
  readonly palette: PaletteSpec;
  readonly typography: TypographySpec;
  readonly spacing: SpacingSpec;
  readonly breakpoints?: BreakpointSpec;
  readonly components: readonly string[];
  readonly template?: string;
}

export type FrameworkTarget =
  | 'react'
  | 'react-native'
  | 'vue'
  | 'svelte'
  | 'html-css'
  | 'flutter'
  | 'any';

export interface PaletteSpec {
  readonly primary: string;      // hex color
  readonly secondary?: string;
  readonly accent?: string;
  readonly neutral?: string;
  readonly error?: string;
  readonly warning?: string;
  readonly success?: string;
  readonly info?: string;
}

export interface TypographySpec {
  readonly headingFont: string;
  readonly bodyFont: string;
  readonly monoFont?: string;
  readonly baseFontSize: number;
  readonly scaleRatio?: number;
}

export interface SpacingSpec {
  readonly baseUnit: number;     // e.g., 4 or 8
  readonly scale: readonly number[]; // e.g., [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]
}

export interface BreakpointSpec {
  readonly modes: readonly string[]; // e.g., ["Desktop", "Tablet", "Mobile"]
  readonly widths: Readonly<Record<string, number>>; // e.g., { Desktop: 1440, Tablet: 768, Mobile: 375 }
}
