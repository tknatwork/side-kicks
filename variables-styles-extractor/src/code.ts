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
// Window sizes per UI mode (the UI requests a resize on mode switch via 'resize_ui'):
//   Simple (default): 3-column compact layout
//   Advanced:         4-column layout
const UI_SIZE = {
  simple: { width: 905, height: 628 },
  advanced: { width: 1200, height: 628 }
};
figma.showUI(__html__, {
  width: UI_SIZE.simple.width,
  height: UI_SIZE.simple.height,
  themeColors: true,
  title: 'Variables & Styles Extractor v2.1.2'
});

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

// Group summaries for Simple-mode group pickers
interface GroupSummary {
  name: string;
  count: number;
}

interface StyleGroupSummaries {
  color: GroupSummary[];
  text: GroupSummary[];
  effect: GroupSummary[];
  grid: GroupSummary[];
}

type ExportFormat = (CollectionExport | { _styles: StylesExport })[];

// Naming conventions for code-friendly export
type NamingConvention = 'original' | 'camelCase' | 'kebab-case' | 'snake_case';

// Export format types
type ExportFormatType = 'figma' | 'w3c' | 'tokens-studio';

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
    // Unique (library collection, variable path) pairs the refs point at —
    // lets check_libraries judge satisfiability by content, not just by name.
    // selfSatisfied marks refs whose collection+path is provided by the import
    // payload itself (e.g. a file that carries a local twin of the library it
    // references) — those link during the import regardless of file state.
    readonly refs: Array<{ collection: string; path: string; selfSatisfied?: boolean }>;
  };
  readonly fontDependencies?: {
    readonly styleCount: number;
    readonly fonts: Array<{ family: string; style: string }>;
  };
}

// Plugin -> UI messages for heavy-load operations (progress, chunked export,
// cancellation, operation denial).
interface ProgressMessage {
  readonly type: 'operation_progress';
  readonly operation: string;
  readonly phase: string;
  readonly label: string;
  readonly current: number;
  readonly total: number;
  readonly indeterminate: boolean;
}

interface ExportChunkMessage {
  readonly type: 'export_chunk';
  readonly seq: number;
  readonly total: number;
  readonly data: string;
}

interface ExportDoneMessage {
  readonly type: 'export_done';
  readonly stats: ExportStats;
  readonly format: string;
  readonly chunkCount: number;
  readonly totalLength: number;
}

interface CancelledMessage {
  readonly type: 'operation_cancelled';
  readonly operation: string;
  readonly phase: string;
  readonly rolledBack: boolean;
  readonly partial?: boolean;
  readonly message: string;
}

interface DeniedMessage {
  readonly type: 'operation_denied';
  readonly requested: string;
  readonly running: string;
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

// ============================================================================
// SECTION 3a: HEAVY-LOAD UTILITIES — yield, cancellation, operation lock,
//             batch runners, progress throttling (QuickJS-safe)
// ============================================================================

// Yield control back to the host event loop so the UI can repaint.
function yieldToHost(): Promise<void> {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}

// Cancellation sentinel: a plain Error tagged with isOperationCancelled.
interface CancelError extends Error {
  isOperationCancelled: true;
}

function makeCancelError(): CancelError {
  const err = new Error('Operation cancelled') as CancelError;
  err.isOperationCancelled = true;
  return err;
}

function isCancelError(e: unknown): boolean {
  return typeof e === 'object' && e !== null &&
    (e as Record<string, unknown>).isOperationCancelled === true;
}

// Single global operation lock. Only one long operation runs at a time.
interface OperationState {
  type: string | null;
  cancelRequested: boolean;
  cancellable: boolean;
}

const currentOperation: OperationState = {
  type: null,
  cancelRequested: false,
  cancellable: true
};

function beginOperation(type: string): boolean {
  if (currentOperation.type !== null) {
    figma.ui.postMessage({
      type: 'operation_denied',
      requested: type,
      running: currentOperation.type
    });
    return false;
  }
  currentOperation.type = type;
  currentOperation.cancelRequested = false;
  currentOperation.cancellable = true;
  return true;
}

function endOperation(): void {
  currentOperation.type = null;
  currentOperation.cancelRequested = false;
  currentOperation.cancellable = true;
}

function checkCancelled(): void {
  if (currentOperation.cancelRequested && currentOperation.cancellable) {
    throw makeCancelError();
  }
}

async function withOperation(type: string, fn: () => Promise<void>): Promise<void> {
  if (!beginOperation(type)) return;
  try {
    await fn();
  } finally {
    endOperation();
  }
}

// Run a synchronous fn over items in batches, yielding between batches.
async function runBatched<T>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => void,
  onBatch?: (done: number, total: number) => void
): Promise<void> {
  const total = items.length;
  for (let start = 0; start < total; start += batchSize) {
    const end = Math.min(start + batchSize, total);
    for (let i = start; i < end; i++) {
      fn(items[i], i);
    }
    if (onBatch) onBatch(end, total);
    checkCancelled();
    if (end < total) {
      await yieldToHost();
    }
  }
}

// Run an async fn over items in chunks via Promise.all, yielding between chunks.
async function runBatchedAsync<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T, index: number) => Promise<R>,
  onBatch?: (done: number, total: number) => void
): Promise<R[]> {
  const total = items.length;
  const results: R[] = [];
  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(start + chunkSize, total);
    const promises: Promise<R>[] = [];
    for (let i = start; i < end; i++) {
      promises.push(fn(items[i], i));
    }
    const chunkResults = await Promise.all(promises);
    for (let j = 0; j < chunkResults.length; j++) {
      results.push(chunkResults[j]);
    }
    if (onBatch) onBatch(end, total);
    checkCancelled();
    if (end < total) {
      await yieldToHost();
    }
  }
  return results;
}

// Run an async fn over items strictly in order, yielding every batchSize items.
async function runSequentialAsync<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<R>,
  onBatch?: (done: number, total: number) => void
): Promise<R[]> {
  const total = items.length;
  const results: R[] = [];
  for (let i = 0; i < total; i++) {
    results.push(await fn(items[i], i));
    const done = i + 1;
    if (done % batchSize === 0 || done === total) {
      if (onBatch) onBatch(done, total);
      checkCancelled();
      if (done < total) {
        await yieldToHost();
      }
    }
  }
  return results;
}

// Progress reporter with time-based throttling. Always posts on phase change
// or final tick; otherwise skips updates that arrive too soon.
interface ProgressReporter {
  report(
    phase: string,
    label: string,
    current: number,
    total: number,
    indeterminate?: boolean
  ): void;
}

function createProgress(operation: string): ProgressReporter {
  let lastPhase: string | null = null;
  let lastPost = 0;
  return {
    report(
      phase: string,
      label: string,
      current: number,
      total: number,
      indeterminate?: boolean
    ): void {
      const now = Date.now();
      const phaseChanged = phase !== lastPhase;
      const isFinal = total > 0 && current >= total;
      if (!phaseChanged && !isFinal) {
        if (now - lastPost < BATCH.PROGRESS_MIN_MS) return;
      }
      lastPhase = phase;
      lastPost = now;
      figma.ui.postMessage({
        type: 'operation_progress',
        operation,
        phase,
        label,
        current,
        total,
        indeterminate: indeterminate === true
      });
    }
  };
}

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

// Batch sizing + throttling config for heavy-load handling (QuickJS sandbox)
const BATCH = {
  SYNC_CREATE: 50,
  SYNC_LIGHT: 200,
  ASYNC_LOOKUP: 50,
  ASYNC_LIBRARY: 10,
  ASYNC_FONT: 5,
  SEQ_EXPORT: 25,
  PROGRESS_MIN_MS: 250,
  EXPORT_CHUNK_BYTES: 262144,
  EXPORT_YIELD_EVERY: 8
} as const;

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
  const libraryRefKeys = new Set<string>();
  const libraryRefs: Array<{ collection: string; path: string; selfSatisfied?: boolean }> = [];

  // Index every variable path the import payload itself provides, keyed by
  // collection name (and $originalName where a naming convention renamed the
  // JSON key). A library ref whose collection+path appears here is satisfied
  // by the import itself — e.g. community files that carry a local twin of
  // the very library they reference.
  const selfPaths = new Map<string, Set<string>>();
  for (const colExport of importCollections) {
    const colName = Object.keys(colExport)[0];
    const colData = colExport[colName];
    if (!colData || !colData.modes) continue;

    const pathSet = new Set<string>();
    for (const modeName of Object.keys(colData.modes)) {
      const variables = flattenVariables(colData.modes[modeName], '');
      for (const { path } of variables) pathSet.add(path);
    }
    selfPaths.set(colName, pathSet);
    const originalName = (colData as { $originalName?: string }).$originalName;
    if (originalName && originalName !== colName) selfPaths.set(originalName, pathSet);
  }

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
          // Record the unique (collection, path) pair this ref targets so the
          // availability check can match by content, not just collection name.
          if (typeof value.$value === 'string' && value.$value.startsWith('{')) {
            const refPath = value.$value.slice(1, -1).replace(/\./g, '/');
            const refKey = value.$collectionName + ' ' + refPath;
            if (!libraryRefKeys.has(refKey)) {
              libraryRefKeys.add(refKey);
              const providedByImport = selfPaths.get(value.$collectionName);
              libraryRefs.push({
                collection: value.$collectionName,
                path: refPath,
                selfSatisfied: providedByImport ? providedByImport.has(refPath) : false
              });
            }
          }
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
        collections: Array.from(libraryCollections),
        refs: libraryRefs
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

// Resolve a variable's value through Figma's own rendering engine. Used when
// manual chain-walking dead-ends: getVariableByIdAsync cannot fetch library-
// internal variables this file never imported (e.g. an unpublished primitive
// that a referenced library token aliases), but the renderer resolves the full
// chain regardless. A throwaway hidden node pinned to the wanted mode of the
// exporting collection provides the resolution context.
function resolveViaConsumer(
  variable: Variable,
  collection: VariableCollection,
  modeId: string
): string | number | boolean | RGBA | undefined {
  let node: FrameNode | null = null;
  try {
    node = figma.createFrame();
    node.name = '__vse-alias-resolver';
    node.visible = false;
    node.resize(1, 1);
    node.setExplicitVariableModeForCollection(collection, modeId);
    const resolved = variable.resolveForConsumer(node);
    return resolved ? (resolved.value as string | number | boolean | RGBA) : undefined;
  } catch (e) {
    Logger.log(`⚠️ Consumer-resolve failed for ${variable.name}: ${e instanceof Error ? e.message : 'unknown error'}`);
    return undefined;
  } finally {
    if (node) {
      node.remove();
    }
  }
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
// SECTION 4D: TOKENS STUDIO CONVERTER
// ============================================================================
// Emits the Tokens Studio (tokens-studio/figma-plugin) single-file container:
// one token set per "<Collection>/<Mode>", DTCG keys only ($type/$value/
// $description), "$themes" + "$metadata.tokenSetOrder" always present, plus
// dedicated "styles/color" / "styles/typography" / "styles/effects" sets.
// Pure transform over the already-built export data — no Figma API calls.
// QuickJS-safe: no spread, no optional chaining, no nullish coalescing.

// FLOAT scope -> Tokens Studio type refinement (applied only when the variable
// carries exactly one relevant scope and no ALL_SCOPES).
const TS_FLOAT_SCOPE_MAP: Record<string, string> = {
  'CORNER_RADIUS': 'borderRadius',
  'STROKE_FLOAT': 'borderWidth',
  'GAP': 'spacing',
  'WIDTH_HEIGHT': 'sizing',
  'OPACITY': 'opacity',
  'FONT_SIZE': 'fontSizes',
  'LINE_HEIGHT': 'lineHeights',
  'LETTER_SPACING': 'letterSpacing',
  'PARAGRAPH_SPACING': 'paragraphSpacing'
};

// STRING scope -> Tokens Studio type refinement
const TS_STRING_SCOPE_MAP: Record<string, string> = {
  'FONT_FAMILY': 'fontFamilies',
  'FONT_STYLE': 'fontWeights'
};

// Figma textCase -> Tokens Studio typography textCase (SMALL_CAPS* omitted —
// no Tokens Studio representation)
const TS_TEXT_CASE_MAP: Record<string, string> = {
  'ORIGINAL': 'none',
  'UPPER': 'uppercase',
  'LOWER': 'lowercase',
  'TITLE': 'capitalize'
};

// Figma textDecoration -> Tokens Studio typography textDecoration
const TS_TEXT_DECORATION_MAP: Record<string, string> = {
  'NONE': 'none',
  'UNDERLINE': 'underline',
  'STRIKETHROUGH': 'line-through'
};

type TokensStudioCompositeValue = Record<string, string | number>;

interface TokensStudioToken {
  $type: string;
  $value: string | number | TokensStudioCompositeValue | TokensStudioCompositeValue[];
  $description?: string;
}

interface TokensStudioGroup {
  [key: string]: TokensStudioToken | TokensStudioGroup;
}

interface TokensStudioTheme {
  id: string;
  name: string;
  group: string;
  selectedTokenSets: Record<string, string>;
}

// Aggregated skip counters so each category logs ONE note, not one per item.
interface TokensStudioSkipState {
  libraryRefsSkipped: number;
  imagePaintsSkipped: number;
  blurEffectsSkipped: number;
}

const TokensStudioConverter = {
  // Token path segments must not contain { } $ — and never resolve to
  // prototype-polluting keys when used as dynamic object properties.
  sanitizeSegment(segment: string): string {
    let cleaned = segment.replace(/[{}$]/g, '');
    if (cleaned.length === 0) {
      cleaned = '_';
    }
    if (cleaned === '__proto__' || cleaned === 'constructor' || cleaned === 'prototype') {
      cleaned = '_' + cleaned;
    }
    return cleaned;
  },

  // "{path.to.token}" -> same ref with every dot-segment passed through
  // sanitizeSegment, so refs always match sanitized token paths (incl. the
  // empty-after-stripping and __proto__/constructor/prototype renames).
  // exportData alias refs are already collection-prefix-free name paths
  // (built from the target variable's name with "/" -> "."), which is exactly
  // the Tokens Studio reference shape; normal refs pass through unchanged.
  sanitizeAliasRef(ref: string): string {
    const parts = ref.substring(1, ref.length - 1).split('.');
    const cleaned: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      cleaned.push(this.sanitizeSegment(parts[i]));
    }
    return '{' + cleaned.join('.') + '}';
  },

  isAliasRef(value: unknown): value is string {
    return typeof value === 'string' && value.charAt(0) === '{' &&
           value.charAt(value.length - 1) === '}';
  },

  // Plain JSON numbers, <= 3 decimals
  roundNumber(n: number): number {
    return Math.round(n * 1000) / 1000;
  },

  // "#rrggbb" for opaque colors; CSS "rgba(r, g, b, a)" when alpha < 1
  // (ColorConverter only sets rgb.a / emits rgba css when alpha < 1).
  colorToTS(color: ExportColorValue): string {
    const alpha = color.rgb !== undefined ? color.rgb.a : undefined;
    if (alpha !== undefined && alpha < 1) {
      return color.css;
    }
    // Near-opaque rounding edge: raw alpha in (0.995, 1) rounds to rgb.a = 1
    // here, but ColorConverter.toHex (which checks the RAW alpha) already
    // appended an alpha byte. Strip it so opaque emission is always #rrggbb.
    if (color.rgb !== undefined && color.hex.length > 7) {
      return color.hex.substring(0, 7);
    }
    return color.hex;
  },

  floatTypeFromScopes(scopes: readonly string[] | undefined): string {
    if (!scopes) {
      return 'number';
    }
    let mapped = '';
    let relevant = 0;
    for (let i = 0; i < scopes.length; i++) {
      if (scopes[i] === 'ALL_SCOPES') {
        return 'number';
      }
      const candidate = TS_FLOAT_SCOPE_MAP[scopes[i]];
      if (candidate !== undefined) {
        relevant++;
        mapped = candidate;
      }
    }
    return relevant === 1 ? mapped : 'number';
  },

  stringTypeFromScopes(scopes: readonly string[] | undefined): string {
    if (!scopes) {
      return 'text';
    }
    let mapped = '';
    let relevant = 0;
    for (let i = 0; i < scopes.length; i++) {
      if (scopes[i] === 'ALL_SCOPES') {
        return 'text';
      }
      const candidate = TS_STRING_SCOPE_MAP[scopes[i]];
      if (candidate !== undefined) {
        relevant++;
        mapped = candidate;
      }
    }
    return relevant === 1 ? mapped : 'text';
  },

  // Convert one export leaf to a Tokens Studio token; null = skip (library
  // alias with no resolvable local value — its "{ref}" target is not in the
  // export, so the reference would dangle).
  convertVariableLeaf(leaf: ExportVariableValue, state: TokensStudioSkipState): TokensStudioToken | null {
    let rawValue: string | number | boolean | ExportColorValue = leaf.$value;
    if (leaf.$libraryRef !== undefined) {
      if (leaf.$localValue !== undefined) {
        rawValue = leaf.$localValue;
      } else {
        state.libraryRefsSkipped++;
        return null;
      }
    }

    let tsType: string;
    let tsValue: string | number;
    const aliasRef = this.isAliasRef(rawValue);

    if (leaf.$type === 'color') {
      tsType = 'color';
      if (aliasRef) {
        tsValue = this.sanitizeAliasRef(rawValue as string);
      } else if (typeof rawValue === 'object' && rawValue !== null) {
        tsValue = this.colorToTS(rawValue as ExportColorValue);
      } else {
        tsValue = String(rawValue);
      }
    } else if (leaf.$type === 'float') {
      tsType = this.floatTypeFromScopes(leaf.$scopes);
      if (aliasRef) {
        tsValue = this.sanitizeAliasRef(rawValue as string);
      } else if (typeof rawValue === 'number') {
        tsValue = this.roundNumber(rawValue);
      } else {
        tsValue = String(rawValue);
      }
    } else if (leaf.$type === 'boolean') {
      // Tokens Studio boolean tokens carry string values "true" / "false"
      tsType = 'boolean';
      tsValue = aliasRef ? this.sanitizeAliasRef(rawValue as string) : String(rawValue);
    } else {
      tsType = this.stringTypeFromScopes(leaf.$scopes);
      tsValue = aliasRef ? this.sanitizeAliasRef(rawValue as string) : String(rawValue);
    }

    // Key order is deliberate: $type before $value (matches the plugin output)
    const token: TokensStudioToken = { $type: tsType, $value: tsValue };
    if (leaf.$description) {
      token.$description = leaf.$description;
    }
    return token;
  },

  // Insert a token at a "/"-separated path, creating nested groups as needed.
  insertTokenAtPath(root: TokensStudioGroup, path: string, token: TokensStudioToken): void {
    const parts = path.split('/');
    let current: TokensStudioGroup = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = this.sanitizeSegment(parts[i]);
      const existing = current[seg];
      if (existing !== undefined && typeof existing === 'object' && !('$value' in existing)) {
        current = existing as TokensStudioGroup;
      } else {
        const created: TokensStudioGroup = {};
        current[seg] = created;
        current = created;
      }
    }
    current[this.sanitizeSegment(parts[parts.length - 1])] = token;
  },

  // Best-effort CSS gradient string: angle derived from the transform's
  // x-axis (fallback 180deg); stop order and positions preserved.
  gradientToCss(paint: ExportGradientPaint): string {
    let angle = 180;
    const t = paint.gradientTransform;
    if (t !== undefined) {
      let deg = Math.atan2(t[0][1], t[0][0]) * 180 / Math.PI + 90;
      deg = ((deg % 360) + 360) % 360;
      angle = Math.round(deg * 100) / 100;
    }
    const stops: string[] = [];
    for (let i = 0; i < paint.gradientStops.length; i++) {
      const stop = paint.gradientStops[i];
      const pos = Math.round(stop.position * 10000) / 100;
      stops.push(this.colorToTS(stop.color) + ' ' + pos + '%');
    }
    return 'linear-gradient(' + angle + 'deg, ' + stops.join(', ') + ')';
  },

  // First exportable paint wins: SOLID -> hex/rgba, gradients -> CSS string;
  // IMAGE paints are counted and skipped.
  colorStyleToTSValue(style: ExportColorStyle, state: TokensStudioSkipState): string | null {
    const paints: readonly ExportPaintData[] = style.paints !== undefined ? style.paints : [];
    for (let i = 0; i < paints.length; i++) {
      const paint = paints[i];
      if (paint.type === 'SOLID') {
        return this.colorToTS(paint.color);
      }
      if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL' ||
          paint.type === 'GRADIENT_ANGULAR' || paint.type === 'GRADIENT_DIAMOND') {
        return this.gradientToCss(paint);
      }
      if (paint.type === 'IMAGE') {
        state.imagePaintsSkipped++;
      }
    }
    // Legacy single-color field fallback
    if (style.color !== undefined) {
      return this.colorToTS(style.color);
    }
    return null;
  },

  // Typography composite: singular sub-keys; sub-keys we cannot derive are
  // omitted (ExportTextStyle does not capture paragraphSpacing).
  textStyleToTSValue(style: ExportTextStyle): TokensStudioCompositeValue {
    const value: TokensStudioCompositeValue = {};
    value.fontFamily = style.fontFamily;
    value.fontWeight = style.fontStyle;
    if (typeof style.fontSize === 'number') {
      value.fontSize = this.roundNumber(style.fontSize);
    }
    const lineHeight = style.lineHeight as { unit?: string; value?: number };
    if (lineHeight !== undefined && lineHeight !== null) {
      if (lineHeight.unit === 'AUTO') {
        value.lineHeight = 'AUTO';
      } else if (lineHeight.unit === 'PERCENT' && typeof lineHeight.value === 'number') {
        value.lineHeight = this.roundNumber(lineHeight.value) + '%';
      } else if (lineHeight.unit === 'PIXELS' && typeof lineHeight.value === 'number') {
        value.lineHeight = this.roundNumber(lineHeight.value);
      }
    }
    const letterSpacing = style.letterSpacing as { unit?: string; value?: number };
    if (letterSpacing !== undefined && letterSpacing !== null) {
      if (letterSpacing.unit === 'PERCENT' && typeof letterSpacing.value === 'number') {
        value.letterSpacing = this.roundNumber(letterSpacing.value) + '%';
      } else if (letterSpacing.unit === 'PIXELS' && typeof letterSpacing.value === 'number') {
        value.letterSpacing = this.roundNumber(letterSpacing.value);
      }
    }
    if (style.textCase !== undefined) {
      const textCase = TS_TEXT_CASE_MAP[style.textCase];
      if (textCase !== undefined) {
        value.textCase = textCase;
      }
    }
    if (style.textDecoration !== undefined) {
      const textDecoration = TS_TEXT_DECORATION_MAP[style.textDecoration];
      if (textDecoration !== undefined) {
        value.textDecoration = textDecoration;
      }
    }
    return value;
  },

  // Shadow layers only; blur effects are counted and skipped. Single layer ->
  // object, multiple layers -> array (layer order preserved).
  effectStyleToTSValue(
    style: ExportEffectStyle,
    state: TokensStudioSkipState
  ): TokensStudioCompositeValue | TokensStudioCompositeValue[] | null {
    const layers: TokensStudioCompositeValue[] = [];
    const effects = style.effects !== undefined ? style.effects : [];
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        const layer: TokensStudioCompositeValue = {
          color: effect.color !== undefined ? this.colorToTS(effect.color) : '#000000',
          type: effect.type === 'DROP_SHADOW' ? 'dropShadow' : 'innerShadow',
          x: effect.offset !== undefined ? this.roundNumber(effect.offset.x) : 0,
          y: effect.offset !== undefined ? this.roundNumber(effect.offset.y) : 0,
          blur: typeof effect.radius === 'number' ? this.roundNumber(effect.radius) : 0,
          spread: typeof effect.spread === 'number' ? this.roundNumber(effect.spread) : 0
        };
        layers.push(layer);
      } else {
        state.blurEffectsSkipped++;
      }
    }
    if (layers.length === 0) {
      return null;
    }
    return layers.length === 1 ? layers[0] : layers;
  },

  // Theme ids: lowercase, spaces -> "-"
  themeIdSegment(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-');
  }
} as const;

// Transform the already-built (post-group-filter) export data into the Tokens
// Studio single-file container ("shape A").
function convertToTokensStudio(exportData: ExportFormat): Record<string, unknown> {
  const conv = TokensStudioConverter;
  const result: Record<string, unknown> = {};
  const tokenSetOrder: string[] = [];
  const state: TokensStudioSkipState = {
    libraryRefsSkipped: 0,
    imagePaintsSkipped: 0,
    blurEffectsSkipped: 0
  };

  // Split collection wrappers from the trailing _styles wrapper
  interface TSCollectionInfo {
    name: string;
    modeNames: string[];
    modes: ModeVariables;
  }
  const collections: TSCollectionInfo[] = [];
  let stylesData: StylesExport | null = null;

  for (let i = 0; i < exportData.length; i++) {
    const item = exportData[i];
    const maybeStyles = (item as { _styles?: StylesExport })._styles;
    if (maybeStyles !== undefined) {
      stylesData = maybeStyles;
      continue;
    }
    const wrapper = item as CollectionExport;
    const wrapperKeys = Object.keys(wrapper);
    for (let k = 0; k < wrapperKeys.length; k++) {
      const rawName = wrapperKeys[k];
      const entry = wrapper[rawName];
      if (!entry || typeof entry !== 'object' || entry.modes === undefined) {
        continue;
      }
      // Reserved container keys: a collection literally named "$themes" or
      // "$metadata" gets a "-set" suffix as its set-name base.
      const setBaseName = (rawName === '$themes' || rawName === '$metadata') ? rawName + '-set' : rawName;
      collections.push({
        name: setBaseName,
        modeNames: Object.keys(entry.modes),
        modes: entry.modes
      });
    }
  }

  // Variable token sets: one per Collection/Mode (even single-mode
  // collections), collections in order, modes in collection order.
  for (let c = 0; c < collections.length; c++) {
    const col = collections[c];
    for (let m = 0; m < col.modeNames.length; m++) {
      const modeName = col.modeNames[m];
      const setName = col.name + '/' + modeName;
      const group: TokensStudioGroup = {};
      const flat = flattenVariables(col.modes[modeName], '');
      for (let f = 0; f < flat.length; f++) {
        const token = conv.convertVariableLeaf(flat[f].value, state);
        if (token !== null) {
          conv.insertTokenAtPath(group, flat[f].path, token);
        }
      }
      result[setName] = group;
      tokenSetOrder.push(setName);
    }
  }

  // Style sets (only emitted when they have content), appended after the
  // variable sets in tokenSetOrder.
  const styleSetNames: string[] = [];
  // A collection literally named "styles" with a mode named color/typography/
  // effects would produce a variable set with the same key as a style set;
  // suffix the style set instead of silently overwriting the variable set.
  function styleSetKey(base: string): string {
    return result[base] !== undefined ? base + '-set' : base;
  }
  if (stylesData !== null) {
    if (stylesData.colorStyles !== undefined && stylesData.colorStyles.length > 0) {
      const group: TokensStudioGroup = {};
      for (let i = 0; i < stylesData.colorStyles.length; i++) {
        const style = stylesData.colorStyles[i];
        const tsValue = conv.colorStyleToTSValue(style, state);
        if (tsValue === null) {
          continue;
        }
        const token: TokensStudioToken = { $type: 'color', $value: tsValue };
        if (style.description) {
          token.$description = style.description;
        }
        conv.insertTokenAtPath(group, style.name, token);
      }
      if (Object.keys(group).length > 0) {
        const colorSetKey = styleSetKey('styles/color');
        result[colorSetKey] = group;
        tokenSetOrder.push(colorSetKey);
        styleSetNames.push(colorSetKey);
      }
    }
    if (stylesData.textStyles !== undefined && stylesData.textStyles.length > 0) {
      const group: TokensStudioGroup = {};
      for (let i = 0; i < stylesData.textStyles.length; i++) {
        const style = stylesData.textStyles[i];
        const token: TokensStudioToken = { $type: 'typography', $value: conv.textStyleToTSValue(style) };
        if (style.description) {
          token.$description = style.description;
        }
        conv.insertTokenAtPath(group, style.name, token);
      }
      if (Object.keys(group).length > 0) {
        const typographySetKey = styleSetKey('styles/typography');
        result[typographySetKey] = group;
        tokenSetOrder.push(typographySetKey);
        styleSetNames.push(typographySetKey);
      }
    }
    if (stylesData.effectStyles !== undefined && stylesData.effectStyles.length > 0) {
      const group: TokensStudioGroup = {};
      for (let i = 0; i < stylesData.effectStyles.length; i++) {
        const style = stylesData.effectStyles[i];
        const tsValue = conv.effectStyleToTSValue(style, state);
        if (tsValue === null) {
          continue;
        }
        const token: TokensStudioToken = { $type: 'boxShadow', $value: tsValue };
        if (style.description) {
          token.$description = style.description;
        }
        conv.insertTokenAtPath(group, style.name, token);
      }
      if (Object.keys(group).length > 0) {
        const effectsSetKey = styleSetKey('styles/effects');
        result[effectsSetKey] = group;
        tokenSetOrder.push(effectsSetKey);
        styleSetNames.push(effectsSetKey);
      }
    }
    if (stylesData.gridStyles !== undefined && stylesData.gridStyles.length > 0) {
      Logger.log('Tokens Studio export: grid styles skipped (no Tokens Studio representation)');
    }
  }

  // One aggregated note per skipped category (JSF: no per-item log spam)
  if (state.libraryRefsSkipped > 0) {
    Logger.log('Tokens Studio export: skipped ' + state.libraryRefsSkipped + ' library-alias token(s) with no resolvable local value');
  }
  if (state.imagePaintsSkipped > 0) {
    Logger.log('Tokens Studio export: skipped ' + state.imagePaintsSkipped + ' image paint(s) in color styles (no Tokens Studio representation)');
  }
  if (state.blurEffectsSkipped > 0) {
    Logger.log('Tokens Studio export: skipped ' + state.blurEffectsSkipped + ' blur effect(s) in effect styles (boxShadow tokens carry shadows only)');
  }

  // $themes: one entry per collection x mode. Own set "enabled"; every other
  // collection contributes its same-named mode set when it exists (else its
  // first mode set) as "source"; style sets are "source" in every theme.
  const themes: TokensStudioTheme[] = [];
  for (let c = 0; c < collections.length; c++) {
    const col = collections[c];
    for (let m = 0; m < col.modeNames.length; m++) {
      const modeName = col.modeNames[m];
      const selected: Record<string, string> = {};
      selected[col.name + '/' + modeName] = 'enabled';
      for (let o = 0; o < collections.length; o++) {
        if (o === c) {
          continue;
        }
        const other = collections[o];
        if (other.modeNames.length === 0) {
          continue;
        }
        let pick = other.modeNames[0];
        for (let mm = 0; mm < other.modeNames.length; mm++) {
          if (other.modeNames[mm] === modeName) {
            pick = modeName;
            break;
          }
        }
        selected[other.name + '/' + pick] = 'source';
      }
      for (let s = 0; s < styleSetNames.length; s++) {
        selected[styleSetNames[s]] = 'source';
      }
      themes.push({
        id: conv.themeIdSegment(col.name) + '-' + conv.themeIdSegment(modeName),
        name: modeName,
        group: col.name,
        selectedTokenSets: selected
      });
    }
  }

  result['$themes'] = themes;
  result['$metadata'] = { tokenSetOrder: tokenSetOrder };
  return result;
}

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

// Decide which existing collection's copy of `aliasPath` an alias should bind
// to when re-linking on import. Pure (no Figma deps) so it is unit-tested in
// isolation — keep in sync with tests/alias-resolution.test.mjs.
//
// An external/library dependency is often imported into the target file under a
// collection name that differs from the `$collectionName` baked into the export
// (e.g. exported against "Tailwind CSS", imported as "Tailwind Primitives"). The
// exact collection-qualified key then misses even though the target variable is
// present. This recovers the link by matching on the variable path, refusing to
// guess when the match is genuinely ambiguous.
function chooseAliasCollection(
  aliasCollection: string,
  aliasPath: string,
  exactExists: boolean,
  pathCollections: readonly string[],
  importingCollection: string
): string | null {
  // Fast path: the recorded collection has this exact path locally/in-library.
  if (exactExists) return aliasCollection;
  if (!pathCollections || pathCollections.length === 0) return null;
  // Only one collection anywhere holds this path — unambiguous, link it.
  if (pathCollections.length === 1) return pathCollections[0];
  // Several collections hold the path. Disambiguate without guessing wildly.
  // Collapse internal whitespace runs too: real-world files contain pairs like
  // "☀️ Mode" (library) vs "☀️  Mode" (local) that differ only by a double space.
  const norm = function (s: string): string { return String(s).replace(/\s+/g, ' ').trim().toLowerCase(); };
  const target = norm(aliasCollection);
  // 1) A collection whose name matches the recorded one apart from case/space.
  for (let i = 0; i < pathCollections.length; i++) {
    if (norm(pathCollections[i]) === target) return pathCollections[i];
  }
  // 2) Exactly one candidate that is not the collection currently importing —
  //    an external dependency lives in some *other* collection by definition.
  const external = pathCollections.filter(function (c): boolean { return c !== importingCollection; });
  if (external.length === 1) return external[0];
  // 3) Still ambiguous — refuse to guess (caller keeps the $localValue fallback).
  return null;
}

class VariableCache {
  private collectionMap = new Map<string, VariableCollection>();
  private variableMap = new Map<string, Variable>();
  private libraryVariableMap = new Map<string, Variable>(); // Library/remote variables
  private libraryCollectionNames = new Set<string>(); // Names of connected library collections
  private initialized = false;
  private libraryIndexed = false;
  // Lazy path -> [collection names] index across local + library variables, used
  // to recover external-dependency alias links when the collection name drifts.
  // Invalidated on any local mutation; rebuilt on demand.
  private nameIndex: Map<string, string[]> | null = null;

  // Lazy readiness: build the local index once if not already done.
  async ensureReady(): Promise<void> {
    if (this.initialized) return;
    await this.rebuildLocal();
    this.initialized = true;
  }

  // Back-compat: external callers still call initialize(). Delegates to ensureReady().
  async initialize(): Promise<void> {
    await this.ensureReady();
  }

  // Full rebuild for callers that need both local and library indexes.
  async rebuild(): Promise<void> {
    await this.rebuildLocal();
    await this.ensureLibraryIndex();
    this.initialized = true;
  }

  // Rebuild ONLY the local collection + variable index. No library indexing.
  async rebuildLocal(): Promise<void> {
    this.clearLocal();

    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    for (let c = 0; c < collections.length; c++) {
      const col = collections[c];
      this.collectionMap.set(col.name, col);

      // Batch the per-variable async lookups instead of awaiting one at a time.
      const ids = col.variableIds;
      const resolved = await runBatchedAsync(
        ids,
        BATCH.ASYNC_LOOKUP,
        function (varId: string): Promise<Variable | null> {
          return figma.variables.getVariableByIdAsync(varId);
        }
      );
      for (let i = 0; i < resolved.length; i++) {
        const v = resolved[i];
        if (v) {
          this.variableMap.set(`${col.name}/${v.name}`, v);
        }
      }
    }
  }

  // Build the library/remote variable index once. Idempotent.
  async ensureLibraryIndex(): Promise<void> {
    if (this.libraryIndexed) return;
    await this.indexLibraryVariables();
    this.libraryIndexed = true;
  }

  // Synchronously clear only the local collection + variable maps.
  clearLocal(): void {
    this.collectionMap.clear();
    this.variableMap.clear();
    this.nameIndex = null;
  }

  // Index library variables from connected team libraries
  private async indexLibraryVariables(): Promise<void> {
    this.libraryVariableMap.clear();
    this.libraryCollectionNames.clear();
    this.nameIndex = null; // library variables feed the path index

    try {
      // Get all library variable collections available to this file
      const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

      for (let c = 0; c < libraryCollections.length; c++) {
        const libCol = libraryCollections[c];
        this.libraryCollectionNames.add(libCol.name);

        // Get variables in this library collection
        try {
          const libraryVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libCol.key);
          // Import variables in batches so a large library does not block the host.
          const libColName = libCol.name;
          await runBatchedAsync(
            libraryVars,
            BATCH.ASYNC_LIBRARY,
            async (libVar): Promise<void> => {
              // Import the variable so we can reference it by ID
              try {
                const importedVar = await figma.variables.importVariableByKeyAsync(libVar.key);
                if (importedVar) {
                  this.libraryVariableMap.set(`${libColName}/${importedVar.name}`, importedVar);
                }
              } catch (importErr) {
                // Individual variable import failure - skip
              }
            }
          );
        } catch (e) {
          Logger.log(`  ⚠️ Could not index library collection "${libCol.name}": ${e}`);
        }
      }

      if (this.libraryCollectionNames.size > 0) {
        Logger.log(`📚 Indexed ${this.libraryVariableMap.size} library variables from ${this.libraryCollectionNames.size} connected libraries`);
      }
    } catch (e) {
      Logger.log(`⚠️ Could not access team library: ${e}`);
    }
  }

  getCollection(name: string): VariableCollection | undefined {
    return this.collectionMap.get(name);
  }

  getVariable(key: string): Variable | undefined {
    // Check local variables first, then library variables
    return this.variableMap.get(key) || this.libraryVariableMap.get(key);
  }

  // Build (memoized) a variable-name -> [collection names] index across local
  // and library variables. The map keys are "collectionName/variableName"; the
  // variable's own `.name` is used to strip the collection prefix exactly, so
  // collection or variable names that themselves contain '/' stay correct.
  private getNameIndex(): Map<string, string[]> {
    if (this.nameIndex) return this.nameIndex;
    const index = new Map<string, string[]>();
    const add = function (collection: string, name: string): void {
      const cols = index.get(name);
      if (cols) {
        if (cols.indexOf(collection) === -1) cols.push(collection);
      } else {
        index.set(name, [collection]);
      }
    };
    const ingest = function (v: Variable, key: string): void {
      const name = v.name;
      // key === `${collection}/${name}` — strip the trailing "/name" exactly.
      const collection = key.slice(0, key.length - name.length - 1);
      add(collection, name);
    };
    this.variableMap.forEach(ingest);
    this.libraryVariableMap.forEach(ingest);
    this.nameIndex = index;
    return index;
  }

  // Resolve a variable target by collection + path, tolerating external/library
  // dependencies imported under a different collection name. Exact match is the
  // fast path; on a miss it recovers the link by variable path (see
  // chooseAliasCollection). Returns undefined when no safe match exists.
  resolveTarget(collection: string, path: string, importingCollection: string = ''): Variable | undefined {
    const exact = this.getVariable(`${collection}/${path}`);
    if (exact) return exact;
    const candidates = this.getNameIndex().get(path);
    if (!candidates || candidates.length === 0) return undefined;
    const chosen = chooseAliasCollection(collection, path, false, candidates, importingCollection);
    return chosen ? this.getVariable(`${chosen}/${path}`) : undefined;
  }

  setVariable(key: string, variable: Variable): void {
    this.variableMap.set(key, variable);
    this.nameIndex = null;
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
    this.nameIndex = null;
  }

  // Check if a collection is available (local or library)
  isCollectionAvailable(name: string): boolean {
    return this.collectionMap.has(name) || this.libraryCollectionNames.has(name);
  }

  // Get all connected library collection names
  getLibraryCollectionNames(): string[] {
    return Array.from(this.libraryCollectionNames);
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

    const localPaintStyles = await figma.getLocalPaintStylesAsync();
    await runSequentialAsync(localPaintStyles, 20, async function (style: PaintStyle): Promise<void> {
      if (style.paints.length === 0) return;

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
      
      if (exportPaints.length === 0) return;

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
    });

    return styles;
  },

  async importStyles(styles: ExportColorStyle[], cache: VariableCache): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    const existing = new Map<string, PaintStyle>();
    for (const s of await figma.getLocalPaintStylesAsync()) {
      existing.set(s.name, s);
    }

    await runSequentialAsync(styles, 20, async function (colorStyle: ExportColorStyle): Promise<void> {
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
                  const targetVar = cache.resolveTarget(binding.collection, binding.name);
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
              const targetVar = cache.resolveTarget(binding.collection, binding.name);
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
    });

    return { created, updated };
  }
};

// Text Style Processor
const TextStyleProcessor: StyleProcessor<ExportTextStyle, TextStyle> = {
  async export(_options?: { includeImages?: boolean }): Promise<ExportTextStyle[]> {
    const styles: ExportTextStyle[] = [];

    const localTextStyles = await figma.getLocalTextStylesAsync();
    await runSequentialAsync(localTextStyles, 20, async function (style: TextStyle): Promise<void> {
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
    });

    return styles;
  },

  async importStyles(styles: ExportTextStyle[], cache: VariableCache): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    const existing = new Map<string, TextStyle>();
    for (const s of await figma.getLocalTextStylesAsync()) {
      existing.set(s.name, s);
    }

    await runSequentialAsync(styles, 20, async function (textStyle: ExportTextStyle): Promise<void> {
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
              const targetVar = cache.resolveTarget(binding.collection, binding.name);
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
    });

    return { created, updated };
  }
};

// Effect Style Processor
const EffectStyleProcessor: StyleProcessor<ExportEffectStyle, EffectStyle> = {
  async export(_options?: { includeImages?: boolean }): Promise<ExportEffectStyle[]> {
    const styles: ExportEffectStyle[] = [];

    const localEffectStyles = await figma.getLocalEffectStylesAsync();
    await runSequentialAsync(localEffectStyles, 20, async function (style: EffectStyle): Promise<void> {
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
    });

    return styles;
  },

  async importStyles(styles: ExportEffectStyle[], cache: VariableCache): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    const existing = new Map<string, EffectStyle>();
    for (const s of await figma.getLocalEffectStylesAsync()) {
      existing.set(s.name, s);
    }

    await runSequentialAsync(styles, 20, async function (effectStyle: ExportEffectStyle): Promise<void> {
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
              const targetVar = cache.resolveTarget(binding.collection, binding.name);
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
    });

    return { created, updated };
  }
};

// Grid Style Processor
const GridStyleProcessor: StyleProcessor<ExportGridStyle, GridStyle> = {
  async export(_options?: { includeImages?: boolean }): Promise<ExportGridStyle[]> {
    const styles: ExportGridStyle[] = [];

    const localGridStyles = await figma.getLocalGridStylesAsync();
    await runSequentialAsync(localGridStyles, 20, async function (style: GridStyle): Promise<void> {
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
    });

    return styles;
  },

  async importStyles(styles: ExportGridStyle[], cache: VariableCache): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    
    const existing = new Map<string, GridStyle>();
    for (const s of await figma.getLocalGridStylesAsync()) {
      existing.set(s.name, s);
    }

    await runSequentialAsync(styles, 20, async function (gridStyle: ExportGridStyle): Promise<void> {
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
              const targetVar = cache.resolveTarget(binding.collection, binding.name);
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
    });

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

// Selected style groups for export filtering (Simple mode)
interface SelectedStyleGroups {
  color?: string[];
  text?: string[];
  effect?: string[];
  grid?: string[];
}

// Filter style-processor export results down to allowed group keys.
// allowed === undefined means "no filtering — keep everything".
function filterStylesByGroup<T extends { name: string }>(items: T[], allowed: string[] | undefined): T[] {
  if (!allowed) {
    return items;
  }
  return items.filter(function (s) { return allowed.indexOf(getGroupKey(s.name)) !== -1; });
}

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
  resolveAliases: boolean = false,
  selectedGroups?: Record<string, string[]>,
  selectedStyleGroups?: SelectedStyleGroups
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

    // Progress + heavy-load handling: compute grand total of variables to export
    // (sum of filtered collection variable counts) and keep a running count so
    // the UI can show determinate progress across collections.
    const progress = createProgress('export');
    let grandTotal = 0;
    for (let gc = 0; gc < collections.length; gc++) {
      grandTotal += collections[gc].variableIds.length;
    }
    let processedVars = 0;

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
      
      // Process variables sequentially (shared nested structure mutation), batched
      // with periodic yields so the UI can repaint on large collections.
      await runSequentialAsync(
        collection.variableIds,
        BATCH.SEQ_EXPORT,
        async function (variableId: string): Promise<void> {
        processedVars++;
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable) return;

        // Group filtering (Simple mode): key absent for a collection => export ALL its variables
        if (selectedGroups && selectedGroups[collection.name]) {
          if (selectedGroups[collection.name].indexOf(getGroupKey(variable.name)) === -1) {
            return;
          }
        }

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
                let resolvedValue = await resolveAliasValue(aliasVar, mode.modeId);
                if (resolvedValue === '') {
                  // Chain dead-ended on a library-internal variable the API
                  // can't fetch — ask the rendering engine instead.
                  const consumerValue = resolveViaConsumer(variable, collection, mode.modeId);
                  if (consumerValue !== undefined) resolvedValue = consumerValue;
                }
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
                
                // Get the resolved local value for library aliases. Resolve
                // recursively: a library target whose value is itself an alias
                // (a chain) must still yield a concrete fallback, otherwise the
                // importer has nothing to fall back to and the token shows 0.
                if (isLibraryAlias) {
                  let resolvedValue = await resolveAliasValue(aliasVar, mode.modeId);
                  if (resolvedValue === '') {
                    // Chain dead-ended on a library-internal variable the API
                    // can't fetch — ask the rendering engine instead.
                    const consumerValue = resolveViaConsumer(variable, collection, mode.modeId);
                    if (consumerValue !== undefined) resolvedValue = consumerValue;
                  }
                  if (typeof resolvedValue === 'object' && resolvedValue !== null && 'r' in resolvedValue) {
                    localValue = ColorConverter.toAllFormats(resolvedValue as RGBA);
                  } else if (resolvedValue !== '') {
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
        },
        function (): void {
          progress.report('export_variables', 'Exporting variables', processedVars, grandTotal);
        }
      );

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
      if (styleOptions.colorStyles) {
        progress.report('export_styles', 'Exporting styles', 0, 0, true);
        const colorAllowed = selectedStyleGroups ? selectedStyleGroups.color : undefined;
        stylesExported.colorStyles = filterStylesByGroup(await ColorStyleProcessor.export({ includeImages }), colorAllowed);
        if (colorAllowed && stylesExported.colorStyles.length === 0) {
          delete stylesExported.colorStyles;
        }
      }
      if (styleOptions.textStyles) {
        progress.report('export_styles', 'Exporting styles', 0, 0, true);
        const textAllowed = selectedStyleGroups ? selectedStyleGroups.text : undefined;
        stylesExported.textStyles = filterStylesByGroup(await TextStyleProcessor.export(), textAllowed);
        if (textAllowed && stylesExported.textStyles.length === 0) {
          delete stylesExported.textStyles;
        }
      }
      if (styleOptions.effectStyles) {
        progress.report('export_styles', 'Exporting styles', 0, 0, true);
        const effectAllowed = selectedStyleGroups ? selectedStyleGroups.effect : undefined;
        stylesExported.effectStyles = filterStylesByGroup(await EffectStyleProcessor.export(), effectAllowed);
        if (effectAllowed && stylesExported.effectStyles.length === 0) {
          delete stylesExported.effectStyles;
        }
      }
      if (styleOptions.gridStyles) {
        progress.report('export_styles', 'Exporting styles', 0, 0, true);
        const gridAllowed = selectedStyleGroups ? selectedStyleGroups.grid : undefined;
        stylesExported.gridStyles = filterStylesByGroup(await GridStyleProcessor.export(), gridAllowed);
        if (gridAllowed && stylesExported.gridStyles.length === 0) {
          delete stylesExported.gridStyles;
        }
      }
      
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
    } else if (exportFormat === 'tokens-studio') {
      // Tokens Studio (tokens-studio/figma-plugin) single-file container
      outputData = JSON.stringify(convertToTokensStudio(exportData), null, 2);
      Logger.log(`✅ Export complete (Tokens Studio format): ${stats.collections} collections, ${stats.variables} variables`);
    } else {
      // Figma JSON format
      outputData = JSON.stringify(exportData, null, 2);
      Logger.log(`✅ Export complete: ${stats.collections} collections, ${stats.variables} variables`);
    }
    
    await sendExportInChunks(outputData, stats, exportFormat);

  } catch (e) {
    if (isCancelError(e)) {
      Logger.log('🛑 Export cancelled');
      figma.ui.postMessage({
        type: 'operation_cancelled',
        operation: 'export',
        phase: 'export',
        rolledBack: false,
        message: 'Export cancelled. Nothing was changed.'
      });
      return;
    }
    Logger.log(`❌ Export error: ${e}`);
    Logger.send('error', { message: `Export failed: ${e}` });
  }
}

// Deliver a large export payload to the UI in size-bounded chunks so a single
// postMessage never has to serialize a multi-megabyte string at once. Splits on
// byte budget (BATCH.EXPORT_CHUNK_BYTES) but never mid surrogate pair, yields to
// the host every BATCH.EXPORT_YIELD_EVERY chunks, then posts a final summary.
async function sendExportInChunks(
  outputData: string,
  stats: ExportStats,
  format: string
): Promise<void> {
  const len = outputData.length;
  const size = BATCH.EXPORT_CHUNK_BYTES;
  const total = Math.max(1, Math.ceil(len / size));
  let seq = 0;
  let start = 0;
  while (start < len) {
    let end = Math.min(start + size, len);
    // Don't split in the middle of a surrogate pair: if the last code unit in
    // this slice is a high surrogate, extend the boundary by one.
    if (end < len) {
      const lastCode = outputData.charCodeAt(end - 1);
      if (lastCode >= 0xD800 && lastCode <= 0xDBFF) {
        end += 1;
      }
    }
    const piece = outputData.slice(start, end);
    figma.ui.postMessage({
      type: 'export_chunk',
      seq: seq,
      total: total,
      data: piece
    });
    seq++;
    start = end;
    if (seq % BATCH.EXPORT_YIELD_EVERY === 0 && start < len) {
      await yieldToHost();
    }
  }
  figma.ui.postMessage({
    type: 'export_done',
    stats: stats,
    format: format,
    // Report the ACTUAL number of chunks emitted, not the precomputed estimate.
    // Surrogate-boundary extension can make the real count differ from
    // ceil(len/size); the UI integrity check (chunks.length === chunkCount)
    // must compare against what was actually sent.
    chunkCount: seq,
    totalLength: len
  });
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

  // Heavy-load handling: throttled progress + a mutation-started flag so the
  // cancel/rollback paths know whether the file was actually touched yet.
  const progress = createProgress('import');
  let mutationStarted = false;

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

    // PRE-PASS: flatten each collection's first mode exactly once (reused in pass 1),
    // sum the grand total for determinate progress, and detect whether any value
    // references the team library so we only index it when actually needed.
    const preflattened: Array<{
      collectionObj: CollectionExport;
      flatPaths: FlatVariable[];
    }> = [];
    let importGrandTotal = 0;
    let needsLibraryIndex = false;
    for (let pc = 0; pc < collectionData.length; pc++) {
      const collectionObj = collectionData[pc];
      const jsonName = Object.keys(collectionObj)[0];
      const content = collectionObj[jsonName];
      const modeKeys = Object.keys(content.modes);
      const firstMode = modeKeys.length > 0 ? content.modes[modeKeys[0]] : {};
      const flatPaths = flattenVariables(firstMode, '');
      preflattened.push({ collectionObj: collectionObj, flatPaths: flatPaths });
      importGrandTotal += flatPaths.length;

      // Scan for library needs: a $libraryRef, or an alias pointing at a
      // collection name that is not one of the collections in this import file.
      for (let fp = 0; fp < flatPaths.length; fp++) {
        const v = flatPaths[fp].value;
        if (v.$libraryRef) {
          needsLibraryIndex = true;
        } else if (v.$collectionName && v.$collectionName !== (content.$originalName || jsonName)) {
          needsLibraryIndex = true;
        }
      }
    }

    // FIRST MUTATION BOUNDARY: everything above is read-only. Commit an undo
    // checkpoint immediately before the first mutating step so a single Figma
    // undo reverts the whole import as one unit.
    mutationStarted = true;
    figma.commitUndo();

    // Handle Clean Import: clear everything first (silent — internal step of the
    // import's own undo boundary; cancellation rethrows into the rollback path).
    if (options.clearFirst) {
      Logger.log('🧹 Clean Import: Clearing existing variables and styles...');
      await clearAll(true);
      Logger.log('✅ Clean Import: Clearing complete...');
    }

    // Handle Custom Merge: selectively clear variables and/or styles (silent).
    if (options.customMerge) {
      const { clearVariables: shouldClearVars, clearStyles: shouldClearStyles } = options.customMerge;
      if (shouldClearVars && shouldClearStyles) {
        Logger.log('🎯 Custom Merge: Clearing both variables and styles...');
        await clearAll(true);
      } else if (shouldClearVars) {
        Logger.log('🎯 Custom Merge: Clearing variables only...');
        await clearVariables(true);
      } else if (shouldClearStyles) {
        Logger.log('🎯 Custom Merge: Clearing styles only...');
        await clearStyles(true);
      }
      Logger.log('✅ Custom Merge: Clearing complete...');
    }

    // Build the local cache index once (picks up any state after clearing).
    // Index the team library only when the pre-pass found library refs or the
    // caller explicitly opted in via useLibraryRefs.
    progress.report('cache_scan', 'Scanning existing variables', 0, 0, true);
    await variableCache.rebuildLocal();
    if (needsLibraryIndex || options.useLibraryRefs) {
      await variableCache.ensureLibraryIndex();
    }

    // Collect all pending aliases across all collections for pass 2
    const allPendingAliases: Array<{
      variable: Variable;
      modeId: string;
      aliasPath: string;
      aliasCollection: string;
      importingCollection: string;
      fallbackValue: ExportVariableValue;
    }> = [];

    let processedTotal = 0;

    // Process collections - PASS 1: Create variables with raw values
    Logger.log(`📥 Pass 1: Processing ${collectionData.length} collections...`);
    for (let pidx = 0; pidx < preflattened.length; pidx++) {
      const collectionObj = preflattened[pidx].collectionObj;
      const variablePaths = preflattened[pidx].flatPaths;
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
      // variablePaths reuses the pre-pass flatten — no redundant re-flatten here.

      // Store pending alias assignments for pass 2
      const pendingAliases: Array<{
        variable: Variable;
        modeId: string;
        aliasPath: string;
        aliasCollection: string;
        importingCollection: string;
        fallbackValue: ExportVariableValue;
      }> = [];

      // PASS 1: Create variables and set raw values (batched + yielded)
      Logger.log(`  Pass 1: Creating variables with raw values...`);
      await runBatched(
        variablePaths,
        BATCH.SYNC_CREATE,
        function (entry: FlatVariable): void {
        const path = entry.path;
        const value = entry.value;
        const fullPath = `${collectionName}/${path}`;

        let variable: Variable;
        const existingVar = variableCache.getVariable(fullPath);

        if (existingVar) {
          if (!options.overwrite) {
            skippedVariables++;
            return;
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
            return;
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
              importingCollection: collectionName,
              fallbackValue: modeValue
            });
            // Set a temporary raw value in case alias resolution fails. Prefer the
            // exporter-preserved $localValue (the resolved value of an external/
            // library alias) over the unparseable "{ref}" string, which would
            // otherwise collapse to 0 / black.
            setRawValue(variable, modeId, aliasFallbackValue(modeValue));
          } else {
            // Raw value - set immediately
            setRawValue(variable, modeId, modeValue);
          }
        }

        variableCache.setVariable(fullPath, variable);
        },
        function (done: number): void {
          progress.report('import_create', 'Importing variables', processedTotal + done, importGrandTotal);
        }
      );
      processedTotal += variablePaths.length;

      // Store pending aliases for this collection (will be processed after all collections)
      allPendingAliases.push(...pendingAliases);
    }

    // PASS 2: Resolve all aliases (now all variables from all collections exist).
    // Aliases run strictly AFTER all raw values are in place. No cache rebuild
    // needed: the initial cache_scan indexed pre-existing variables and Pass 1
    // registered every created variable/collection under its JSON-path key —
    // exactly the key space the alias lookups below use.
    Logger.log(`📥 Pass 2: Resolving ${allPendingAliases.length} alias references...`);

    let aliasesResolved = 0;
    let aliasesFailed = 0;

    await runBatched(
      allPendingAliases,
      BATCH.SYNC_LIGHT,
      function (pending: {
        variable: Variable;
        modeId: string;
        aliasPath: string;
        aliasCollection: string;
        importingCollection: string;
        fallbackValue: ExportVariableValue;
      }): void {
      // Exact collection-qualified match first; on a miss, recover the link by
      // path so external/library dependencies imported under a different
      // collection name still bind instead of collapsing to the raw fallback.
      const targetVar = variableCache.resolveTarget(
        pending.aliasCollection,
        pending.aliasPath,
        pending.importingCollection
      );

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
        // Target not found anywhere — the $localValue/raw fallback set in pass 1 stands.
        aliasesFailed++;
        Logger.log(`  ⚠️ Alias target not found: ${pending.aliasCollection}/${pending.aliasPath}`);
      }
      },
      function (done: number, total: number): void {
        progress.report('import_aliases', 'Linking aliases', done, total);
      }
    );

    if (allPendingAliases.length > 0) {
      Logger.log(`  ✅ Aliases: ${aliasesResolved} resolved, ${aliasesFailed} used fallback values`);
    }

    // Import styles
    if (stylesData && options.importStyles) {
      Logger.log('📦 Importing styles...');
      progress.report('import_styles', 'Importing styles', 0, 0, true);

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

    // Close the undo boundary AFTER the import fully completes so the whole
    // import collapses into a single undo step.
    figma.commitUndo();

    Logger.log(`✅ Import complete!`);
    Logger.send('import_complete', { stats, snapshot: preImportSnapshot });

  } catch (e) {
    const cancelled = isCancelError(e);

    // Cancelled before any mutation: nothing to roll back.
    if (cancelled && !mutationStarted) {
      Logger.log('🛑 Import cancelled before any changes were made');
      figma.ui.postMessage({
        type: 'operation_cancelled',
        operation: 'import',
        phase: 'snapshot',
        rolledBack: false,
        message: 'Import cancelled. No changes were made.'
      });
      return;
    }

    const errorMessage = e instanceof Error ? e.message : String(e);
    if (!cancelled) {
      Logger.log(`❌ Import error: ${errorMessage}`);
    } else {
      Logger.log('🛑 Import cancelled after mutation started — rolling back...');
    }

    // Automatic rollback if we have a pre-import snapshot
    if (preImportSnapshot) {
      Logger.log('🔄 Attempting automatic rollback to pre-import state...');
      Logger.send('import_rolling_back', { error: errorMessage });

      try {
        await restoreFromSnapshot(preImportSnapshot);
        Logger.log('✅ Automatic rollback successful - file restored to pre-import state');
        if (cancelled) {
          figma.ui.postMessage({
            type: 'operation_cancelled',
            operation: 'import',
            phase: 'rollback',
            rolledBack: true,
            message: 'Import cancelled — your file was restored to its previous state.'
          });
        } else {
          Logger.send('import_rollback_complete', {
            error: errorMessage,
            message: 'Import failed but your file has been automatically restored to its previous state.'
          });
        }
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

// Pick the raw value to write as a temporary fallback for an alias that has not
// been linked yet. For external/library aliases the exporter preserves the
// resolved value in $localValue; use it so an unresolved alias shows its
// last-known value instead of collapsing to 0 / black (the "{ref}" string is
// unparseable as a color/number). Returns the original value when there is no
// preserved local value to fall back to.
function aliasFallbackValue(value: ExportVariableValue): ExportVariableValue {
  if (value.$localValue === undefined) return value;
  return {
    $scopes: value.$scopes,
    $type: value.$type,
    $value: value.$localValue,
    ...(value.$description !== undefined && { $description: value.$description })
  };
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

// Group key = text before the first '/' in a variable/style name; '' = ungrouped
function getGroupKey(name: string): string {
  const slashIndex = name.indexOf('/');
  if (slashIndex === -1) {
    return '';
  }
  return name.substring(0, slashIndex);
}

// Count names per group key, sorted alphabetically with '' (ungrouped) last
function summarizeGroups(names: string[]): GroupSummary[] {
  // Null-prototype object: group keys come from user-named variables/styles
  // (e.g. a group literally named "__proto__" must behave as a plain key)
  const counts: Record<string, number> = Object.create(null);
  const keys: string[] = [];
  for (let i = 0; i < names.length; i++) {
    const key = getGroupKey(names[i]);
    if (typeof counts[key] !== 'number') {
      counts[key] = 0;
      keys.push(key);
    }
    counts[key] = counts[key] + 1;
  }
  keys.sort(function (a, b) {
    if (a === b) { return 0; }
    if (a === '') { return 1; }
    if (b === '') { return -1; }
    return a < b ? -1 : 1;
  });
  const result: GroupSummary[] = [];
  for (let i = 0; i < keys.length; i++) {
    result.push({ name: keys[i], count: counts[keys[i]] });
  }
  return result;
}

// A paint style is exportable when it has at least one SOLID, GRADIENT, or IMAGE paint
function isExportablePaintStyle(style: PaintStyle): boolean {
  if (style.paints.length === 0) {
    return false;
  }
  for (let i = 0; i < style.paints.length; i++) {
    const p = style.paints[i];
    if (
      p.type === 'SOLID' ||
      p.type === 'GRADIENT_LINEAR' ||
      p.type === 'GRADIENT_RADIAL' ||
      p.type === 'GRADIENT_ANGULAR' ||
      p.type === 'GRADIENT_DIAMOND' ||
      p.type === 'IMAGE'
    ) {
      return true;
    }
  }
  return false;
}

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
  
  // Memoize aliased-target collections so we never re-fetch the same collection
  // once per alias. Maps variableCollectionId -> { name, remote }.
  const aliasCollectionMemo = new Map<string, { name: string; remote: boolean }>();

  // Process sequentially to preserve exact order. Per collection we prefetch the
  // variable objects in async chunks (yielding between chunks) instead of a
  // serial getVariableByIdAsync per id.
  const data = [];
  for (let index = 0; index < collections.length; index++) {
    const c = collections[index];
    const types = { color: 0, float: 0, boolean: 0, string: 0 };
    const variableNames: string[] = [];

    // Batch-resolve all variables in this collection.
    const variables = await runBatchedAsync(
      c.variableIds,
      BATCH.ASYNC_LOOKUP,
      function (varId: string): Promise<Variable | null> {
        return figma.variables.getVariableByIdAsync(varId);
      }
    );

    // First pass over resolved variables: counts, names, and collect alias
    // target ids for a second batched lookup.
    const aliasTargetIds: string[] = [];
    for (let vi = 0; vi < variables.length; vi++) {
      const variable = variables[vi];
      if (!variable) continue;
      variableNames.push(variable.name);
      const typeStr = TypeMapper.toExportType(variable.resolvedType);
      types[typeStr as keyof typeof types]++;

      const modeKeys = Object.keys(variable.valuesByMode);
      for (let mk = 0; mk < modeKeys.length; mk++) {
        const value = variable.valuesByMode[modeKeys[mk]];
        if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS') {
          totalAliases++;
          aliasTargetIds.push((value as VariableAlias).id);
        }
      }
    }

    // Batch-resolve the aliased variables, then deref each one's collection via
    // the memo (single fetch per unseen collection id).
    const aliasedVars = await runBatchedAsync(
      aliasTargetIds,
      BATCH.ASYNC_LOOKUP,
      function (id: string): Promise<Variable | null> {
        return figma.variables.getVariableByIdAsync(id);
      }
    );
    for (let av = 0; av < aliasedVars.length; av++) {
      const aliasedVar = aliasedVars[av];
      if (!aliasedVar) continue;
      const collId = aliasedVar.variableCollectionId;
      let memo = aliasCollectionMemo.get(collId);
      if (!memo) {
        const aliasedCollection = await figma.variables.getVariableCollectionByIdAsync(collId);
        if (!aliasedCollection) continue;
        memo = { name: aliasedCollection.name, remote: aliasedCollection.remote };
        aliasCollectionMemo.set(collId, memo);
      }
      if (memo.remote) {
        libraryDependencies.add(memo.name);
        libraryAliases++;
      } else {
        localAliases++;
      }
    }

    data.push({
      id: c.id,
      name: c.name,
      modes: c.modes.map(m => m.name),
      variableCount: c.variableIds.length,
      types,
      groups: summarizeGroups(variableNames)
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
  const exportablePaintStyleNames: string[] = [];
  for (let i = 0; i < paintStyles.length; i++) {
    if (isExportablePaintStyle(paintStyles[i])) {
      exportablePaintStylesCount++;
      exportablePaintStyleNames.push(paintStyles[i].name);
    }
  }

  const styles = {
    colorStyles: exportablePaintStylesCount,
    textStyles: textStyles.length,
    effectStyles: effectStyles.length,
    gridStyles: gridStyles.length
  };

  // Group summaries per style type (color uses only exportable paint styles,
  // so group counts sum to the same totals as the counts above)
  const textStyleNames: string[] = [];
  for (let i = 0; i < textStyles.length; i++) {
    textStyleNames.push(textStyles[i].name);
  }
  const effectStyleNames: string[] = [];
  for (let i = 0; i < effectStyles.length; i++) {
    effectStyleNames.push(effectStyles[i].name);
  }
  const gridStyleNames: string[] = [];
  for (let i = 0; i < gridStyles.length; i++) {
    gridStyleNames.push(gridStyles[i].name);
  }

  const styleGroups: StyleGroupSummaries = {
    color: summarizeGroups(exportablePaintStyleNames),
    text: summarizeGroups(textStyleNames),
    effect: summarizeGroups(effectStyleNames),
    grid: summarizeGroups(gridStyleNames)
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
    styleGroups,
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

// ============================================================================
// SECTION 14: CLEAR FUNCTIONS
// ============================================================================

// silent: when true, suppress the user-facing clear_complete/error postMessages
// (used by restore, where the clear is an internal step of a larger operation).
async function clearVariables(silent: boolean = false): Promise<void> {
  Logger.log('🗑️ Clearing all variables...');

  // Progress only surfaces for standalone (non-silent) clears; internal callers
  // (restore, clean import) drive their own progress reporters.
  const progress = silent ? null : createProgress('clear');
  let deletedCollections = 0;
  let deletedVariables = 0;
  let committed = false;

  try {
    // Gather all collections + their variable ids up front so we have a grand
    // total for determinate progress.
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const gathered: Array<{ collection: VariableCollection; ids: string[] }> = [];
    let total = 0;
    for (let i = 0; i < collections.length; i++) {
      const ids = collections[i].variableIds;
      gathered.push({ collection: collections[i], ids: ids });
      total += ids.length;
    }

    // Standalone clears get a Figma undo checkpoint before the first deletion so
    // a single Cmd+Z reverts the whole clear. Internal/silent clears participate
    // in their caller's undo boundary instead.
    if (!silent && total > 0) {
      figma.commitUndo();
      committed = true;
    }

    let done = 0;
    for (let g = 0; g < gathered.length; g++) {
      const entry = gathered[g];
      // Resolve the variable objects for this collection in async chunks.
      const resolved = await runBatchedAsync(
        entry.ids,
        BATCH.ASYNC_LOOKUP,
        function (id: string): Promise<Variable | null> {
          return figma.variables.getVariableByIdAsync(id);
        }
      );
      // Remove the resolved variables in light synchronous batches.
      await runBatched(
        resolved,
        BATCH.SYNC_LIGHT,
        function (variable: Variable | null): void {
          if (variable) {
            variable.remove();
            deletedVariables++;
          }
        },
        function (batchDone: number): void {
          if (progress) {
            progress.report('clear', 'Deleting variables', done + batchDone, total);
          }
        }
      );
      done += entry.ids.length;
      entry.collection.remove();
      deletedCollections++;
    }

    variableCache.clearLocal();

    if (!silent && committed) {
      figma.commitUndo();
    }

    Logger.log(`✅ Cleared ${deletedCollections} collections, ${deletedVariables} variables`);
    if (!silent) {
      Logger.send('clear_complete', { message: `${deletedCollections} collections, ${deletedVariables} variables` });
    }
  } catch (e) {
    // Internal/silent clears must rethrow cancellation so the caller's rollback
    // path runs; only standalone clears translate it into a user message.
    if (isCancelError(e)) {
      if (silent) {
        throw e;
      }
      Logger.log(`🛑 Clear cancelled after ${deletedVariables} variables in ${deletedCollections} collections`);
      figma.ui.postMessage({
        type: 'operation_cancelled',
        operation: 'clear',
        phase: 'clear',
        rolledBack: false,
        partial: { collectionsDeleted: deletedCollections, variablesDeleted: deletedVariables },
        message: `Clear cancelled — ${deletedVariables} variables in ${deletedCollections} collections were already deleted. Remaining items were not touched. Use Cmd+Z to restore deleted items.`
      });
      return;
    }
    Logger.log(`❌ Clear variables error: ${e}`);
    if (!silent) {
      Logger.send('error', { message: `Failed to clear variables: ${e}` });
    } else {
      throw e;
    }
  }
}

async function clearStyles(silent: boolean = false): Promise<void> {
  Logger.log('🗑️ Clearing all styles...');

  const progress = silent ? null : createProgress('clear');
  let deletedStyles = 0;
  let committed = false;

  try {
    const paintStyles = await figma.getLocalPaintStylesAsync();
    const textStyles = await figma.getLocalTextStylesAsync();
    const effectStyles = await figma.getLocalEffectStylesAsync();
    const gridStyles = await figma.getLocalGridStylesAsync();
    const total = paintStyles.length + textStyles.length + effectStyles.length + gridStyles.length;

    if (!silent && total > 0) {
      figma.commitUndo();
      committed = true;
    }

    let done = 0;
    const removeStyle = function (style: BaseStyle): void {
      style.remove();
      deletedStyles++;
    };
    const onBatch = function (batchDone: number): void {
      if (progress) {
        progress.report('clear', 'Deleting styles', done + batchDone, total);
      }
    };

    await runBatched(paintStyles, BATCH.SYNC_LIGHT, removeStyle, onBatch);
    done += paintStyles.length;
    await runBatched(textStyles, BATCH.SYNC_LIGHT, removeStyle, onBatch);
    done += textStyles.length;
    await runBatched(effectStyles, BATCH.SYNC_LIGHT, removeStyle, onBatch);
    done += effectStyles.length;
    await runBatched(gridStyles, BATCH.SYNC_LIGHT, removeStyle, onBatch);
    done += gridStyles.length;

    if (!silent && committed) {
      figma.commitUndo();
    }

    Logger.log(`✅ Cleared ${deletedStyles} styles`);
    if (!silent) {
      Logger.send('clear_complete', { message: `${deletedStyles} styles` });
    }
  } catch (e) {
    if (isCancelError(e)) {
      if (silent) {
        throw e;
      }
      Logger.log(`🛑 Clear styles cancelled after ${deletedStyles} styles`);
      figma.ui.postMessage({
        type: 'operation_cancelled',
        operation: 'clear',
        phase: 'clear',
        rolledBack: false,
        partial: { collectionsDeleted: 0, variablesDeleted: deletedStyles },
        message: `Clear cancelled — ${deletedStyles} styles were already deleted. Remaining items were not touched. Use Cmd+Z to restore deleted items.`
      });
      return;
    }
    Logger.log(`❌ Clear styles error: ${e}`);
    if (!silent) {
      Logger.send('error', { message: `Failed to clear styles: ${e}` });
    } else {
      throw e;
    }
  }
}

async function clearAll(silent: boolean = false): Promise<void> {
  Logger.log('🗑️ Clearing everything...');

  // Internal/silent callers: just delegate and let cancellation/errors bubble
  // so the caller's rollback path runs. The children participate in the
  // caller's own undo boundary (no per-child commitUndo).
  if (silent) {
    await clearVariables(true);
    await clearStyles(true);
    return;
  }

  // Standalone clearAll: bracket BOTH children in a single Figma undo unit and
  // emit exactly ONE terminal message. The children run silent so they don't
  // each open their own commitUndo boundary (which would split the operation
  // into two separate Cmd+Z steps) and don't post their own clear_complete /
  // operation_cancelled. Running silent also makes them rethrow CancelError, so
  // a cancellation during the variables phase short-circuits before styles and
  // produces a single operation_cancelled message instead of two.
  let committed = false;
  try {
    figma.commitUndo();
    committed = true;
    await clearVariables(true);
    await clearStyles(true);
    figma.commitUndo();
    Logger.send('clear_complete', { message: 'all variables and styles' });
  } catch (e) {
    if (committed) {
      figma.commitUndo();
    }
    if (isCancelError(e)) {
      Logger.log('🛑 Clear all cancelled');
      figma.ui.postMessage({
        type: 'operation_cancelled',
        operation: 'clear',
        phase: 'clear',
        rolledBack: false,
        partial: { collectionsDeleted: 0, variablesDeleted: 0 },
        message: 'Clear cancelled — some items may already have been deleted. Use Cmd+Z to restore deleted items.'
      });
      return;
    }
    Logger.log(`❌ Clear all error: ${e}`);
    Logger.send('error', { message: `Failed to clear: ${e}` });
  }
}

// Create a snapshot of current variables and styles for undo. Read-only, so it
// is cancellable. An optional progress reporter surfaces determinate progress.
async function createUndoSnapshot(reporter?: ProgressReporter): Promise<UndoSnapshot> {
  Logger.log('📸 Creating snapshot of current file state...');

  // Export all collections using simplified internal format
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const snapshotCollections: unknown[] = [];

  // Memoize variableCollectionId -> collection name for alias dereferencing so
  // we don't re-fetch the same collection once per alias.
  const collectionNameById = new Map<string, string>();

  // Grand total for determinate progress.
  let totalVars = 0;
  for (let tc = 0; tc < collections.length; tc++) {
    totalVars += collections[tc].variableIds.length;
  }
  let processedVars = 0;

  for (const collection of collections) {
    collectionNameById.set(collection.id, collection.name);
    const collectionSnapshot: Record<string, unknown> = {
      name: collection.name,
      modes: collection.modes.map(m => ({ id: m.modeId, name: m.name })),
      variables: [] as unknown[]
    };

    // Batch the per-variable async lookups instead of awaiting one at a time.
    const resolvedVars = await runBatchedAsync(
      collection.variableIds,
      BATCH.ASYNC_LOOKUP,
      function (variableId: string): Promise<Variable | null> {
        return figma.variables.getVariableByIdAsync(variableId);
      },
      function (done: number): void {
        if (reporter) {
          reporter.report('snapshot', 'Preparing snapshot (undo safety)', processedVars + done, totalVars);
        }
      }
    );
    processedVars += collection.variableIds.length;

    for (let rv = 0; rv < resolvedVars.length; rv++) {
      const variable = resolvedVars[rv];
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
            let aliasCollectionName = collectionNameById.get(aliasVariable.variableCollectionId);
            if (aliasCollectionName === undefined) {
              const aliasCollection = await figma.variables.getVariableCollectionByIdAsync(aliasVariable.variableCollectionId);
              aliasCollectionName = aliasCollection ? aliasCollection.name : '';
              collectionNameById.set(aliasVariable.variableCollectionId, aliasCollectionName);
            }
            (varSnapshot.values as Record<string, unknown>)[mode.name] = {
              isAlias: true,
              aliasName: aliasVariable.name,
              aliasCollection: aliasCollectionName
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

// Snapshot collection shape used by restore (kept in one place for validation).
interface SnapshotCollection {
  name: string;
  modes: Array<{ id: string; name: string }>;
  variables: Array<{
    name: string;
    type: VariableResolvedDataType;
    scopes: string[];
    values: Record<string, { isAlias: boolean; value?: unknown; aliasName?: string; aliasCollection?: string }>;
  }>;
}

// Validate a parsed snapshot-collections payload before we touch the file. This
// is what makes restore safe: we never clear the current state until we know the
// snapshot parses and has the expected shape.
function isValidSnapshotCollections(parsed: unknown): parsed is SnapshotCollection[] {
  if (!Array.isArray(parsed)) return false;
  for (let i = 0; i < parsed.length; i++) {
    const c = parsed[i] as Record<string, unknown>;
    if (c === null || typeof c !== 'object') return false;
    if (typeof c.name !== 'string') return false;
    if (!Array.isArray(c.modes)) return false;
    if (!Array.isArray(c.variables)) return false;
  }
  return true;
}

// Restore file state from a snapshot (undo).
//
// CRITICAL ORDERING (fixes the prior data-loss bug where the file was cleared
// before the snapshot was parsed): we PARSE + VALIDATE everything first, and
// only after that passes do we mark the operation non-cancellable and clear.
async function restoreFromSnapshot(snapshot: UndoSnapshot): Promise<void> {
  Logger.log('↩️ Restoring file from snapshot...');

  // Per-call progress reporter (phases: undo_restore, undo_aliases, undo_styles).
  const restoreProgress = createProgress('restore');

  // STEP 1 (read-only): parse + shape-check BEFORE any mutation.
  const parsedCollections = JSON.parse(snapshot.collections);
  const stylesData = JSON.parse(snapshot.styles) as StylesExport;
  if (!isValidSnapshotCollections(parsedCollections)) {
    throw new Error('Snapshot is malformed (collections payload failed validation) — refusing to clear the file.');
  }
  const snapshotCollections = parsedCollections;

  // STEP 2: point of no return. The restore itself rebuilds the prior state, so
  // a half-applied restore is worse than completing it — make it uncancellable.
  currentOperation.cancellable = false;

  // STEP 3: clear current state (silent — this is an internal step of restore).
  // clearVariables already empties the local cache via clearLocal(); the restore
  // pass below registers every collection/variable it creates, so no rescan needed.
  Logger.log('  Clearing current state...');
  await clearVariables(true);
  await clearStyles(true);

  Logger.log(`  Restoring ${snapshotCollections.length} collections...`);

  // First pass: Create collections and variables with raw values (batched).
  const pendingAliases: Array<{
    variable: Variable;
    modeId: string;
    aliasPath: string;
    aliasCollection: string;
  }> = [];

  await runBatched(
    snapshotCollections,
    BATCH.SYNC_CREATE,
    function (collSnapshot: SnapshotCollection): void {
    // Create collection
    const newCollection = figma.variables.createVariableCollection(collSnapshot.name);
    variableCache.setCollection(collSnapshot.name, newCollection);

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
      variableCache.setVariable(`${collSnapshot.name}/${varSnapshot.name}`, newVar);

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
    },
    function (done: number, total: number): void {
      restoreProgress.report('undo_restore', 'Restoring variables', done, total);
    }
  );

  // Second pass: Resolve aliases (batched, light). The first pass registered
  // every created collection/variable into the cache, so no rescan is needed.
  Logger.log(`  Resolving ${pendingAliases.length} aliases...`);

  await runBatched(
    pendingAliases,
    BATCH.SYNC_LIGHT,
    function (alias: { variable: Variable; modeId: string; aliasPath: string; aliasCollection: string }): void {
      const targetKey = `${alias.aliasCollection}/${alias.aliasPath}`;
      const targetVar = variableCache.getVariable(targetKey);
      if (targetVar) {
        alias.variable.setValueForMode(alias.modeId, { type: 'VARIABLE_ALIAS', id: targetVar.id });
      }
    },
    function (done: number, total: number): void {
      restoreProgress.report('undo_aliases', 'Restoring aliases', done, total);
    }
  );

  // Restore styles
  Logger.log('  Restoring styles...');
  restoreProgress.report('undo_styles', 'Restoring styles', 0, 0, true);

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
    case 'cancel_operation':
      // Synchronous cancel request. Only flips a flag the running operation polls
      // between batches; the uncancellable rollback window ignores it.
      if (currentOperation.type !== null) {
        if (currentOperation.cancellable) {
          currentOperation.cancelRequested = true;
          Logger.log('🛑 Cancellation requested — finishing current batch…');
        } else {
          Logger.log('⚠️ Rollback in progress — cannot cancel');
        }
      }
      break;

    case 'resize_ui':
      // Window follows the UI mode. Only the two known sizes are accepted —
      // never arbitrary dimensions from the iframe.
      if (msg.mode === 'advanced') {
        figma.ui.resize(UI_SIZE.advanced.width, UI_SIZE.advanced.height);
      } else {
        figma.ui.resize(UI_SIZE.simple.width, UI_SIZE.simple.height);
      }
      break;

    case 'export':
      await withOperation('export', function (): Promise<void> {
        return exportVariables(
          msg.collections as string[] | undefined,
          msg.styleOptions as StyleOptions | undefined,
          msg.preserveLibraryRefs as boolean | undefined,
          msg.includeImages as boolean | undefined,
          (msg.namingConvention as NamingConvention) || 'original',
          (msg.exportFormat as ExportFormatType) || 'figma',
          msg.selectedModes as Record<string, string[]> | undefined,
          (msg.resolveAliases as boolean) || false,
          msg.selectedGroups as Record<string, string[]> | undefined,
          msg.selectedStyleGroups as SelectedStyleGroups | undefined
        );
      });
      break;

    case 'import':
      await withOperation('import', function (): Promise<void> {
        return importVariables(
          msg.data as string,
          msg.options as ImportOptions
        );
      });
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
      await withOperation('clear', function (): Promise<void> {
        return clearVariables(false);
      });
      break;

    case 'clear_styles':
      await withOperation('clear', function (): Promise<void> {
        return clearStyles(false);
      });
      break;

    case 'clear_all':
      await withOperation('clear', function (): Promise<void> {
        return clearAll(false);
      });
      break;

    case 'get_collections':
      await withOperation('scan', getCollections);
      break;

    case 'check_libraries':
      // Check if required library collections are available — by name first,
      // then by CONTENT: a library that is not connected still counts as
      // satisfied when every variable path its refs target already exists in
      // this file (imported locally or via another connected library), since
      // the importer re-links those refs by path.
      try {
        const requiredCollections = msg.collections as string[];
        const requiredRefs = (msg.refs || []) as Array<{ collection: string; path: string; selfSatisfied?: boolean }>;

        // Initialize cache to index both local and library collections
        await variableCache.rebuild();

        const availableCollections: string[] = [];
        const missingCollections: string[] = [];
        const collectionStatus: Array<{
          name: string;
          status: 'connected' | 'mapped' | 'partial' | 'missing';
          satisfiable: number;
          total: number;
          fromImport: number;
        }> = [];

        for (const collectionName of requiredCollections) {
          const refs = requiredRefs.filter(function (r): boolean { return r.collection === collectionName; });
          if (variableCache.isCollectionAvailable(collectionName)) {
            availableCollections.push(collectionName);
            collectionStatus.push({ name: collectionName, status: 'connected', satisfiable: refs.length, total: refs.length, fromImport: 0 });
            continue;
          }
          // Name miss: a ref still resolves when the import payload itself
          // provides the collection+path (selfSatisfied), or when the path
          // matches variables already present (same matcher the importer uses).
          let satisfiable = 0;
          let fromImport = 0;
          for (const r of refs) {
            if (r.selfSatisfied) {
              satisfiable++;
              fromImport++;
            } else if (variableCache.resolveTarget(r.collection, r.path)) {
              satisfiable++;
            }
          }
          if (refs.length > 0 && satisfiable === refs.length) {
            availableCollections.push(collectionName);
            collectionStatus.push({ name: collectionName, status: 'mapped', satisfiable, total: refs.length, fromImport });
          } else if (satisfiable > 0) {
            missingCollections.push(collectionName);
            collectionStatus.push({ name: collectionName, status: 'partial', satisfiable, total: refs.length, fromImport });
          } else {
            missingCollections.push(collectionName);
            collectionStatus.push({ name: collectionName, status: 'missing', satisfiable: 0, total: refs.length, fromImport: 0 });
          }
        }

        Logger.log(`📚 Library check: ${availableCollections.length} available, ${missingCollections.length} missing`);
        for (const cs of collectionStatus) {
          Logger.log(`  ${cs.status === 'missing' ? '❌' : cs.status === 'partial' ? '⚠️' : '✅'} ${cs.name}: ${cs.status} (${cs.satisfiable}/${cs.total} refs satisfiable)`);
        }

        Logger.send('library_check_result', {
          allAvailable: missingCollections.length === 0,
          availableCollections,
          missingCollections,
          requiredCollections,
          collectionStatus
        });
      } catch (e) {
        Logger.send('library_check_result', {
          allAvailable: false,
          availableCollections: [],
          missingCollections: msg.collections || [],
          requiredCollections: msg.collections || [],
          collectionStatus: [],
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

        // Probe fonts in async chunks (no progress UI, no operation lock). Each
        // probe resolves to {font, available} and never rejects, so a single
        // unavailable font does not abort the whole batch.
        const probes = await runBatchedAsync(
          requiredFonts,
          BATCH.ASYNC_FONT,
          function (font: { family: string; style: string }): Promise<{ font: { family: string; style: string }; available: boolean }> {
            return figma.loadFontAsync({ family: font.family, style: font.style })
              .then(function (): { font: { family: string; style: string }; available: boolean } {
                return { font: font, available: true };
              })
              .catch(function (): { font: { family: string; style: string }; available: boolean } {
                return { font: font, available: false };
              });
          }
        );
        for (let i = 0; i < probes.length; i++) {
          if (probes[i].available) {
            availableFonts.push(probes[i].font);
          } else {
            missingFonts.push(probes[i].font);
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
    
    case 'undo_import':
      // Restore file to pre-import state using snapshot
      await withOperation('undo', async function (): Promise<void> {
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
      });
      break;
  }
};
