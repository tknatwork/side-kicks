// Accessibility detectors. Resolve semantic fg/bg (and border/icon) token
// PAIRS down to concrete RGB per mode, then run real WCAG contrast math.
//
// Pairing is the hard part, and we deliberately DON'T guess it. A foreground is
// paired with a surface ONLY through the explicit `on-<X>` naming convention
// (foreground/on-primary -> surface/primary; text/on-emphasis -> */emphasis) —
// the one signal where the designer has *declared* "this fg is meant to sit on
// that bg". Loose suffix-matching (fg/primary <-> surface/primary) invents pairs
// that were never intended (a chromatic fg usually belongs on a neutral surface;
// a "fixed-light" fg belongs on a dark surface), so it's excluded — the rule
// would rather stay silent than assert a fabricated failure. A DS that doesn't
// use the on-<X> convention simply gets no findings here; auditing its real
// fg/bg combinations needs node-level pixel sampling (deferred below).
// min-font-size (needs text-node data) and the export-pixel-sampling fallback
// are deferred.

import type { Detector } from "../runner.js";
import type { AnalyzedVariable, PartialFinding } from "./shared.js";
import { analyze, aliasTarget } from "./shared.js";

type RGB = { r: number; g: number; b: number };

/** Resolve a COLOR variable's value in a mode down to concrete RGB (follows
 *  aliases; a target's mode falls back to its own first mode when absent). */
function resolveColor(
  a: ReturnType<typeof analyze>,
  varId: string,
  mode: string,
  depth = 0
): RGB | null {
  if (depth > 16) return null;
  const v = a.byId.get(varId);
  if (!v || v.resolvedType !== "COLOR") return null;
  const val = mode in v.valuesByMode ? v.valuesByMode[mode] : Object.values(v.valuesByMode)[0];
  const target = aliasTarget(val);
  if (target) {
    const tv = a.byId.get(target);
    const tMode = tv && mode in tv.valuesByMode ? mode : tv ? Object.keys(tv.valuesByMode)[0] : mode;
    return resolveColor(a, target, tMode, depth + 1);
  }
  if (val && typeof val === "object" && "r" in (val as object)) {
    const o = val as { r: number; g: number; b: number };
    if (typeof o.r === "number") return { r: o.r, g: o.g, b: o.b };
  }
  return null;
}

/** Resolve to the raw alpha of a COLOR variable in a mode (1 if opaque/absent). */
function resolveAlpha(
  a: ReturnType<typeof analyze>,
  varId: string,
  mode: string,
  depth = 0
): number | null {
  if (depth > 16) return null;
  const v = a.byId.get(varId);
  if (!v || v.resolvedType !== "COLOR") return null;
  const val = mode in v.valuesByMode ? v.valuesByMode[mode] : Object.values(v.valuesByMode)[0];
  const target = aliasTarget(val);
  if (target) {
    const tv = a.byId.get(target);
    const tMode = tv && mode in tv.valuesByMode ? mode : tv ? Object.keys(tv.valuesByMode)[0] : mode;
    return resolveAlpha(a, target, tMode, depth + 1);
  }
  if (val && typeof val === "object" && "r" in (val as object)) {
    const o = val as { a?: number };
    return typeof o.a === "number" ? o.a : 1;
  }
  return null;
}

const luminance = ({ r, g, b }: RGB): number => {
  const lin = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrastRatio = (c1: RGB, c2: RGB): number => {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
};

// A foreground that resolves to the SAME primitive as its "surface" isn't a
// real fg/bg pair (it's the same semantic colour in two roles) — the suffix
// heuristic mismatched them. Skip, so we don't emit 1.00:1 noise.
const sameColor = (a: RGB, b: RGB): boolean =>
  Math.abs(a.r - b.r) < 0.004 &&
  Math.abs(a.g - b.g) < 0.004 &&
  Math.abs(a.b - b.b) < 0.004;

const roleOf = (name: string): string => name.toLowerCase().split("/")[0] ?? "";

const FG_ROLE = /^(fg|foreground|text|ink|content|icon|label)$/;
const BG_ROLE = /^(bg|background|surface|fill|elevation)$/;
const LINE_ROLE = /^(border|stroke|outline|divider|separator|ring|icon)$/;

// Pull the on-<X> target out of a foreground token name, or null if it isn't an
// on-token. Handles both `on-primary` (single segment) and `on/primary` (its own
// segment) — `X` is the surface key the designer declared this fg sits on.
function onTarget(name: string): string | null {
  const segs = name.toLowerCase().split("/");
  for (let i = 0; i < segs.length; i++) {
    const m = segs[i].match(/^on[-_](.+)$/); // fg/on-primary
    if (m) return m[1];
    if (segs[i] === "on" && segs[i + 1]) return segs[i + 1]; // fg/on/primary
  }
  return null;
}

// Index bg tokens so an on-<X> target resolves to a surface: by full suffix
// (surface/primary/emphasis -> "primary/emphasis") and by leading segment
// (-> "primary", first wins so it's the base surface of that colour).
interface BgIndex {
  bySuffix: Map<string, AnalyzedVariable>;
  byLead: Map<string, AnalyzedVariable>;
}
function bgIndex(colors: AnalyzedVariable[]): BgIndex {
  const bySuffix = new Map<string, AnalyzedVariable>();
  const byLead = new Map<string, AnalyzedVariable>();
  for (const v of colors) {
    if (!BG_ROLE.test(roleOf(v.name))) continue;
    const suffix = v.name.toLowerCase().split("/").slice(1).join("/");
    if (suffix) bySuffix.set(suffix, v);
    const lead = suffix.split("/")[0];
    if (lead && !byLead.has(lead)) byLead.set(lead, v);
  }
  return { bySuffix, byLead };
}

function findSurface(idx: BgIndex, target: string): AnalyzedVariable | undefined {
  return (
    idx.bySuffix.get(target) ??
    idx.byLead.get(target) ??
    idx.bySuffix.get(`${target}/default`)
  );
}

function contrastRule(
  snap: Parameters<Detector>[0],
  ruleId: string,
  foreRole: RegExp,
  threshold: number,
  label: string
): PartialFinding[] {
  const a = analyze(snap);
  const colors = a.variables.filter(
    (v) => v.tier === "semantic" && v.resolvedType === "COLOR"
  );
  const idx = bgIndex(colors);
  const out: PartialFinding[] = [];
  for (const fore of colors) {
    if (!foreRole.test(roleOf(fore.name))) continue;
    const target = onTarget(fore.name); // only the declared on-<X> convention
    if (!target) continue;
    const surface = findSurface(idx, target);
    if (!surface || surface.id === fore.id) continue;
    const modes = a.modesByCollection.get(fore.collectionId) ?? Object.keys(fore.valuesByMode);
    for (const mode of modes) {
      const fc = resolveColor(a, fore.id, mode);
      const bc = resolveColor(a, surface.id, mode);
      if (!fc || !bc) continue;
      if (sameColor(fc, bc)) continue; // same primitive -> not a real fg/bg pair
      const ratio = contrastRatio(fc, bc);
      if (ratio < threshold) {
        out.push({
          rule_id: ruleId,
          variableId: fore.id,
          message: `'${fore.name}' on '${surface.name}' is ${ratio.toFixed(2)}:1 in mode ${mode} — below the ${threshold}:1 ${label} minimum; adjust the token values.`,
        });
        break; // one finding per pair
      }
    }
  }
  return out;
}

const fgBgPairContrast: Detector = (snap) =>
  contrastRule(snap, "fg-bg-pair-contrast", FG_ROLE, 4.5, "WCAG AA text");

const borderIconGraphicalContrast: Detector = (snap) =>
  contrastRule(snap, "border-icon-graphical-contrast", LINE_ROLE, 3.0, "WCAG non-text (1.4.11)");

// Font size below the accessibility floor (default 12px, configurable). Reads
// the enriched snapshot: TEXT styles' fontSize and each component's smallest
// descendant TEXT size. Silent when no font data is present (old plugin build).
interface MinFontConfig {
  floor: number;
}
const minFontSize: Detector = (snap, config) => {
  const floor = (config as MinFontConfig | undefined)?.floor ?? 12;
  const out: PartialFinding[] = [];
  for (const s of snap.styles) {
    if (s.styleType === "TEXT" && typeof s.fontSize === "number" && s.fontSize < floor) {
      out.push({
        rule_id: "min-font-size",
        message: `Text style '${s.name}' is ${s.fontSize}px, below the ${floor}px minimum; raise it (or justify a caption exception via config).`,
      });
    }
  }
  for (const c of snap.components ?? []) {
    if (typeof c.minTextFontSize === "number" && c.minTextFontSize < floor) {
      out.push({
        rule_id: "min-font-size",
        nodeId: c.id,
        message: `Component '${c.name}' has a TEXT layer at ${c.minTextFontSize}px, below the ${floor}px minimum.`,
      });
    }
  }
  return out;
};

// A semantic fg/bg/line token that resolves to a TRANSLUCENT paint (alpha < 1):
// the alias-resolved RGB contrast can't be trusted (it composites over whatever
// backdrop it's placed on), so the fg-bg-pair/graphical-contrast numbers are
// unreliable for it — pixel-sample the rendered result instead. info; pure over
// the existing colour values (alpha is already in the snapshot).
const A11Y_ROLE = /^(fg|foreground|text|ink|content|icon|label|bg|background|surface|fill|border|stroke|outline|divider|separator|ring)$/;
const contrastFallbackExportSampling: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.tier !== "semantic" || v.resolvedType !== "COLOR") continue;
    if (!A11Y_ROLE.test(v.name.toLowerCase().split("/")[0])) continue;
    const modes = a.modesByCollection.get(v.collectionId) ?? Object.keys(v.valuesByMode);
    for (const mode of modes) {
      const alpha = resolveAlpha(a, v.id, mode);
      if (alpha !== null && alpha < 0.999) {
        out.push({
          rule_id: "contrast-fallback-export-sampling",
          variableId: v.id,
          message: `'${v.name}' resolves to a translucent colour (alpha ${alpha.toFixed(2)}) in mode ${mode}; alias-resolved contrast can't be trusted for it — verify with pixel sampling over the real backdrop.`,
        });
        break;
      }
    }
  }
  return out;
};

export const a11yDetectors: Record<string, Detector> = {
  "fg-bg-pair-contrast": fgBgPairContrast,
  "border-icon-graphical-contrast": borderIconGraphicalContrast,
  "min-font-size": minFontSize,
  "contrast-fallback-export-sampling": contrastFallbackExportSampling,
};
