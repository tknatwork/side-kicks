/**
 * W3C DTCG Format — Design Token Community Group compliant export.
 *
 * Exports tokens in the W3C DTCG draft spec format (2025.10).
 * Uses $type, $value, $description at leaf nodes.
 * References use curly-brace dot-notation: {color.primary-500}.
 *
 * @see https://tr.designtokens.org/format/
 * @module export/dtcg-format
 */

import type {
  VariableDefinition,
  VariableValue,
  ColorValue,
  TierArchitecture,
  TierLevel,
} from '../tokens/schema';
import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';
import { isAlias } from '../tokens/three-tier-engine';

// ============================================================================
// SECTION 1: DTCG TYPES
// ============================================================================

/** DTCG token type names. */
export type DtcgType = 'color' | 'dimension' | 'fontFamily' | 'fontWeight'
  | 'number' | 'string' | 'boolean' | 'duration' | 'cubicBezier'
  | 'shadow' | 'gradient' | 'typography' | 'transition';

/** A single DTCG token at the leaf level. */
export interface DtcgToken {
  readonly $type: DtcgType;
  readonly $value: unknown;
  readonly $description?: string;
}

/** A DTCG token group (object with nested tokens or groups). */
export interface DtcgGroup {
  readonly [key: string]: DtcgToken | DtcgGroup;
}

/** Root DTCG document. */
export interface DtcgDocument {
  readonly $schema?: string;
  readonly [key: string]: DtcgToken | DtcgGroup | string | undefined;
}

// ============================================================================
// SECTION 2: TYPE MAPPING
// ============================================================================

/**
 * Map DSB variable types + scopes to DTCG types.
 *
 * DTCG is more granular: DSB's "float" can be a dimension (px),
 * fontWeight, or number depending on the scope context.
 */
function toDtcgType(variable: VariableDefinition): DtcgType {
  if (variable.type === 'color') return 'color';
  if (variable.type === 'boolean') return 'boolean';
  if (variable.type === 'string') {
    if (variable.scopes.includes('FONT_FAMILY')) return 'fontFamily';
    return 'string';
  }
  if (variable.type === 'float') {
    if (variable.scopes.includes('FONT_WEIGHT')) return 'fontWeight';
    if (variable.scopes.includes('FONT_SIZE')) return 'dimension';
    if (variable.scopes.includes('LINE_HEIGHT')) return 'number';
    if (variable.scopes.includes('GAP') || variable.scopes.includes('WIDTH_HEIGHT')) return 'dimension';
    if (variable.scopes.includes('CORNER_RADIUS')) return 'dimension';
    if (variable.scopes.includes('OPACITY')) return 'number';
    return 'number';
  }
  return 'string';
}

// ============================================================================
// SECTION 3: VALUE CONVERSION
// ============================================================================

/**
 * Convert a DSB variable value to a DTCG-compliant value.
 */
function toDtcgValue(
  variable: VariableDefinition,
  value: VariableValue,
  dtcgType: DtcgType
): unknown {
  // Alias → DTCG reference notation: {group.token-name}
  if (isAlias(value)) {
    // Convert slash-separated path to dot-separated DTCG reference
    const dtcgPath = value.target.replace(/\//g, '.');
    return `{${dtcgPath}}`;
  }

  // Color → DTCG uses hex string as the canonical color format
  if (dtcgType === 'color') {
    if (typeof value === 'object' && value !== null && 'hex' in value) {
      return (value as ColorValue).hex;
    }
    // Already a string (hex)
    if (typeof value === 'string') return value;
  }

  // Dimension → DTCG expects an object { value: number, unit: string }
  if (dtcgType === 'dimension' && typeof value === 'number') {
    return { value, unit: 'px' };
  }

  // FontFamily → DTCG expects a string or array of strings
  if (dtcgType === 'fontFamily' && typeof value === 'string') {
    return value;
  }

  // FontWeight → DTCG expects a number
  if (dtcgType === 'fontWeight' && typeof value === 'number') {
    return value;
  }

  // Fallback: return as-is
  return value;
}

// ============================================================================
// SECTION 4: EXPORT
// ============================================================================

export interface DtcgExportOptions {
  /** Include $schema reference in the root. Default: true. */
  readonly includeSchema?: boolean;
  /** Only export variables from specific tiers. Default: all tiers. */
  readonly tiers?: readonly TierLevel[];
  /** Which mode to export (DTCG is single-mode). Default: first mode of each tier. */
  readonly mode?: string;
}

/**
 * Export variables to W3C DTCG format.
 *
 * DTCG is a flat (single-mode) format. If variables have multiple modes,
 * this exports the specified mode (or the first mode by default).
 *
 * @param variables - All variable definitions.
 * @param tiers - The tier architecture.
 * @param options - Export options.
 */
export function exportDtcgFormat(
  variables: ReadonlyArray<VariableDefinition>,
  tiers: TierArchitecture,
  options: DtcgExportOptions = {}
): Result<DtcgDocument, string> {
  const includeSchema = options.includeSchema !== false;
  const filterTiers = options.tiers;

  const doc: Record<string, unknown> = {};

  if (includeSchema) {
    doc['$schema'] = 'https://tr.designtokens.org/format/#schema';
  }

  // Filter by tiers if specified
  const filteredVars = filterTiers
    ? variables.filter(v => filterTiers.includes(v.tier))
    : variables;

  // Determine which mode to export per tier
  const tierConfigs = [tiers.primitives, tiers.semantic, tiers.component];
  if (tiers.breakpoints) tierConfigs.push(tiers.breakpoints);
  const defaultModes: Record<string, string> = {};
  for (const config of tierConfigs) {
    defaultModes[config.tier] = options.mode || config.modes[0] || 'Value';
  }

  for (const variable of filteredVars) {
    const modeName = defaultModes[variable.tier] || Object.keys(variable.values)[0]!;
    const value = variable.values[modeName];
    if (value === undefined) continue;

    const dtcgType = toDtcgType(variable);
    const dtcgValue = toDtcgValue(variable, value, dtcgType);

    const token: DtcgToken = {
      $type: dtcgType,
      $value: dtcgValue,
      ...(variable.description ? { $description: variable.description } : {}),
    };

    // Set at the dot-separated path
    setDtcgPath(doc, variable.name, token);
  }

  return R.ok(doc as DtcgDocument);
}

/**
 * Set a DTCG token at a path within the document.
 *
 * Paths like "color/primary-500" become nested groups:
 * { color: { "primary-500": { $type: ..., $value: ... } } }
 */
// Segment names that, if assigned, can alter Object.prototype and pollute
// every object in the runtime. Reject them with a thrown error so the
// caller can choose how to surface the problem.
// Defends against CodeQL js/prototype-polluting-assignment.
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

function setDtcgPath(
  root: Record<string, unknown>,
  path: string,
  token: DtcgToken
): void {
  const segments = path.split('/');

  // Validate every segment before mutating anything. A single bad segment
  // aborts the write — partial mutation under attack input is worse than
  // throwing.
  for (const segment of segments) {
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      throw new Error(
        `setDtcgPath: refused prototype-polluting segment "${segment}" in path "${path}"`
      );
    }
  }

  let current: Record<string, unknown> = root;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    // Defence-in-depth: re-check each segment locally so static analysers
    // see the guard adjacent to the assignment.
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      throw new Error(
        `setDtcgPath: refused prototype-polluting segment "${segment}"`
      );
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)
        || typeof current[segment] !== 'object'
        || current[segment] === null) {
      // Use a null-prototype object for newly-created groups so a future
      // tampered token name still cannot reach Object.prototype.
      // Object.defineProperty creates an own, non-prototype property even
      // on receivers that lack hasOwn semantics.
      Object.defineProperty(current, segment, {
        value: Object.create(null),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    current = current[segment] as Record<string, unknown>;
  }

  const finalSegment = segments[segments.length - 1]!;
  if (FORBIDDEN_SEGMENTS.has(finalSegment)) {
    throw new Error(
      `setDtcgPath: refused prototype-polluting segment "${finalSegment}"`
    );
  }
  // defineProperty bypasses any setter inherited from a tampered prototype
  // and never assigns onto Object.prototype.
  Object.defineProperty(current, finalSegment, {
    value: token,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

// ============================================================================
// SECTION 5: MULTI-MODE EXPORT (EXTENSION)
// ============================================================================

/**
 * Export all modes as separate DTCG documents.
 *
 * Since DTCG doesn't natively support modes, this produces one
 * document per mode (e.g., { "Light": DtcgDocument, "Dark": DtcgDocument }).
 */
export function exportDtcgMultiMode(
  variables: ReadonlyArray<VariableDefinition>,
  tiers: TierArchitecture,
  options: Omit<DtcgExportOptions, 'mode'> = {}
): Result<Readonly<Record<string, DtcgDocument>>, string> {
  // Collect all unique mode names across all tier configs
  const allModes = new Set<string>();
  const tierConfigs = [tiers.primitives, tiers.semantic, tiers.component];
  if (tiers.breakpoints) tierConfigs.push(tiers.breakpoints);
  for (const config of tierConfigs) {
    for (const mode of config.modes) {
      allModes.add(mode);
    }
  }

  const result: Record<string, DtcgDocument> = {};

  for (const mode of allModes) {
    const doc = exportDtcgFormat(variables, tiers, { ...options, mode });
    if (!doc.ok) return doc;
    result[mode] = doc.value;
  }

  return R.ok(result);
}
