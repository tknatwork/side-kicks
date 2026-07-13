/**
 * Regression tests for the 2.2.0 forward-compat + new-style-type logic.
 *
 * Pure-logic mirrors of `filterKnownScopes`, `applyEffectDefaults`, and the
 * TypeMapper type maps in src/code.ts. Run with:
 *   node tests/type-mapper.test.mjs
 *
 * The plugin has no test runner (build is plain `tsc && terser`), so this is a
 * standalone node script. Keep each mirrored function identical to the one in
 * src/code.ts apart from stripped type annotations.
 */

// ----- functions under test (ports from src/code.ts) ------------------------

const KNOWN_VARIABLE_SCOPES = {
  'ALL_SCOPES': true,
  'TEXT_CONTENT': true,
  'CORNER_RADIUS': true,
  'WIDTH_HEIGHT': true,
  'GAP': true,
  'ALL_FILLS': true,
  'FRAME_FILL': true,
  'SHAPE_FILL': true,
  'TEXT_FILL': true,
  'STROKE_COLOR': true,
  'STROKE_FLOAT': true,
  'EFFECT_FLOAT': true,
  'EFFECT_COLOR': true,
  'OPACITY': true,
  'FONT_FAMILY': true,
  'FONT_STYLE': true,
  'FONT_WEIGHT': true,
  'FONT_SIZE': true,
  'LINE_HEIGHT': true,
  'LETTER_SPACING': true,
  'PARAGRAPH_SPACING': true,
  'PARAGRAPH_INDENT': true
};

function filterKnownScopes(arr) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (KNOWN_VARIABLE_SCOPES[arr[i]] === true) {
      result.push(arr[i]);
    }
  }
  return result;
}

function applyEffectDefaults(e) {
  if (e.type === 'NOISE') {
    if (e.noiseType === undefined) e.noiseType = 'MONOTONE';
    if (e.noiseSize === undefined) e.noiseSize = 1;
    if (e.density === undefined) e.density = 0.5;
    if (e.color === undefined) e.color = { r: 0, g: 0, b: 0, a: 1 };
    // NOTE: no blendMode default - current Figma builds reject the key on
    // NOISE writes (verified live) even though the typings declare it.
  } else if (e.type === 'TEXTURE') {
    if (e.noiseSize === undefined) e.noiseSize = 1;
    if (e.radius === undefined) e.radius = 0;
    if (e.clipToShape === undefined) e.clipToShape = true;
  } else if (e.type === 'GLASS') {
    if (e.lightIntensity === undefined) e.lightIntensity = 0.5;
    if (e.lightAngle === undefined) e.lightAngle = 45;
    if (e.refraction === undefined) e.refraction = 0.5;
    if (e.depth === undefined) e.depth = 0.5;
    if (e.dispersion === undefined) e.dispersion = 0;
    if (e.radius === undefined) e.radius = 0;
  }
}

function toExportType(type) {
  const map = {
    'COLOR': 'color',
    'FLOAT': 'float',
    'STRING': 'string',
    'BOOLEAN': 'boolean'
  };
  return map[type] ?? (String(type).toLowerCase());
}

function toFigmaType(type) {
  const map = {
    'color': 'COLOR',
    'float': 'FLOAT',
    'string': 'STRING',
    'boolean': 'BOOLEAN'
  };
  return map[type] ?? (String(type).toUpperCase());
}

const MOTION_TIMING_NAME = /(^|\/)(durations?|timings?|delays?|speeds?)($|\/)/i;
const MOTION_EASING_NAME = /(^|\/)easings?($|\/)/i;
const MOTION_EASING_VALUE = /^(cubic-bezier|spring|steps)\s*\(|^(linear|ease|ease-in|ease-out|ease-in-out)$/i;
function classifyMotionType(typeStr, name, stringValues) {
  if (typeStr === 'timing' || typeStr === 'duration') return 'timing';
  if (typeStr === 'easing') return 'easing';
  if (typeStr === 'float' && MOTION_TIMING_NAME.test(name)) return 'timing';
  if (typeStr === 'string') {
    if (MOTION_EASING_NAME.test(name)) return 'easing';
    for (let i = 0; i < stringValues.length; i++) {
      const v = stringValues[i];
      if (typeof v === 'string' && MOTION_EASING_VALUE.test(v.trim())) return 'easing';
    }
  }
  return typeStr;
}

// ----- tiny assert harness ---------------------------------------------------
let passed = 0;
let failed = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}\n      expected: ${b}\n      actual:   ${a}`);
  }
}

console.log('type-mapper (forward-compat):');

// 1) Known types map exactly as before — no regression.
eq(toExportType('COLOR'), 'color', 'COLOR exports as color');
eq(toExportType('FLOAT'), 'float', 'FLOAT exports as float (timing variables ride this)');
eq(toExportType('BOOLEAN'), 'boolean', 'BOOLEAN exports as boolean');
eq(toFigmaType('float'), 'FLOAT', 'float imports as FLOAT');

// 2) Forward-compat: a future type (e.g. easing) round-trips verbatim instead
//    of being mislabeled string/STRING.
eq(toExportType('EASING'), 'easing', 'unknown resolved type exports verbatim, lowercase');
eq(toFigmaType('easing'), 'EASING', 'unknown $type imports verbatim, uppercase (createVariable gates support)');
eq(toFigmaType(toExportType('EASING')), 'EASING', 'unknown type survives a full round-trip');

console.log('filter-known-scopes:');

// 3) All 22 known scopes pass through untouched.
const all22 = Object.keys(KNOWN_VARIABLE_SCOPES);
eq(filterKnownScopes(all22).length, 22, 'all 22 known scopes are kept');

// 4) Unknown scopes are dropped, known ones kept — order preserved.
eq(
  filterKnownScopes(['CORNER_RADIUS', 'FUTURE_SCOPE', 'FONT_WEIGHT']),
  ['CORNER_RADIUS', 'FONT_WEIGHT'],
  'unknown scope is dropped without losing the rest',
);

// 5) Prototype-pollution keys don't sneak through the whitelist object.
eq(filterKnownScopes(['constructor', 'toString', '__proto__']), [], 'object prototype keys are not treated as scopes');

// 6) New 1.130 scopes (previously missing from docs) are recognized.
eq(
  filterKnownScopes(['TEXT_CONTENT', 'STROKE_FLOAT', 'EFFECT_FLOAT', 'OPACITY', 'FONT_FAMILY', 'FONT_STYLE', 'FONT_WEIGHT']),
  ['TEXT_CONTENT', 'STROKE_FLOAT', 'EFFECT_FLOAT', 'OPACITY', 'FONT_FAMILY', 'FONT_STYLE', 'FONT_WEIGHT'],
  'all seven newer scopes are known',
);

console.log('effect-defaults:');

// 7) NOISE with only a type gets every required field.
const noise = { type: 'NOISE' };
applyEffectDefaults(noise);
eq(noise, { type: 'NOISE', noiseType: 'MONOTONE', noiseSize: 1, density: 0.5, color: { r: 0, g: 0, b: 0, a: 1 } }, 'bare NOISE gains required defaults (no blendMode - live Figma rejects it)');

// 8) Present fields are never overridden.
const duo = { type: 'NOISE', noiseType: 'DUOTONE', density: 0.9, color: { r: 1, g: 0, b: 0, a: 1 }, noiseSize: 2 };
applyEffectDefaults(duo);
eq(duo.noiseType, 'DUOTONE', 'existing noiseType is kept');
eq(duo.density, 0.9, 'existing density is kept');

// 9) TEXTURE and GLASS required fields.
const tex = { type: 'TEXTURE' };
applyEffectDefaults(tex);
eq(tex, { type: 'TEXTURE', noiseSize: 1, radius: 0, clipToShape: true }, 'bare TEXTURE gains required defaults');
const glass = { type: 'GLASS', refraction: 0.8 };
applyEffectDefaults(glass);
eq(glass.refraction, 0.8, 'existing GLASS refraction is kept');
eq(glass.lightIntensity, 0.5, 'GLASS lightIntensity default fills in');

// 10) Shadow/blur effects are untouched (no stray fields injected).
const shadow = { type: 'DROP_SHADOW', radius: 4 };
applyEffectDefaults(shadow);
eq(shadow, { type: 'DROP_SHADOW', radius: 4 }, 'shadow effects pass through unmodified');

console.log('motion-classification (preview stats):');

// 11) Convention detection: FLOAT durations by name segment.
eq(classifyMotionType('float', 'duration/fast', []), 'timing', 'FLOAT duration/* counts as Timing');
eq(classifyMotionType('float', 'motion/delays/short', []), 'timing', 'nested delays segment counts as Timing');
eq(classifyMotionType('float', 'spacing/4', []), 'float', 'plain FLOAT stays a Number');
eq(classifyMotionType('float', 'durability/rating', []), 'float', 'segment match is exact - durability is not duration');

// 12) Convention detection: STRING easings by name or value shape.
eq(classifyMotionType('string', 'easing/standard', ['whatever']), 'easing', 'easing/* name counts as Easing');
eq(classifyMotionType('string', 'label/x', ['cubic-bezier(0.4, 0, 0.2, 1)']), 'easing', 'cubic-bezier() value counts as Easing');
eq(classifyMotionType('string', 'label/x', ['spring(1, 100, 15, 0)']), 'easing', 'spring() value counts as Easing');
eq(classifyMotionType('string', 'label/x', ['ease-in-out']), 'easing', 'CSS easing keyword counts as Easing');
eq(classifyMotionType('string', 'content/cta-label', ['Get started']), 'string', 'plain STRING stays a String');

// 13) Native future types win outright (forward-compat surfacing).
eq(classifyMotionType('timing', 'anything', []), 'timing', 'native timing type wins');
eq(classifyMotionType('easing', 'anything', []), 'easing', 'native easing type wins');
eq(classifyMotionType('color', 'duration/fast', []), 'color', 'non-float/string types are never reclassified');

// ----- mirror drift check ----------------------------------------------------
// Fail loudly if src/code.ts diverges from these ports (logic lines only).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const codeTs = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'code.ts'), 'utf-8');
for (const marker of [
  "if (KNOWN_VARIABLE_SCOPES[arr[i]] === true) {",
  "if (e.noiseType === undefined) e.noiseType = 'MONOTONE';",
  "if (e.lightIntensity === undefined) e.lightIntensity = 0.5;",
  "return map[type] ?? (String(type).toLowerCase() as VariableValueType);",
  "return map[type] ?? (String(type).toUpperCase() as VariableResolvedDataType);",
  "'PARAGRAPH_INDENT': true",
  "function classifyMotionType(typeStr: string, name: string, stringValues: readonly string[]): string {"
]) {
  eq(codeTs.includes(marker), true, `src/code.ts still contains mirrored line: ${marker.slice(0, 48)}…`);
}

// ----- summary ----------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed);
