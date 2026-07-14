// Accessibility detectors. Resolve semantic fg/bg (and border/icon) token
// PAIRS down to concrete RGB per mode, then run real WCAG contrast math.
// Pairing is conservative (exact name-suffix match, plus the on-<X> convention)
// so it only flags clear, real low-contrast pairs — advisory (warn).
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

const roleOf = (name: string): string => name.toLowerCase().split("/")[0] ?? "";
const suffixOf = (name: string): string => name.toLowerCase().split("/").slice(1).join("/");

const FG_ROLE = /^(fg|foreground|text|ink|content|icon|label)$/;
const BG_ROLE = /^(bg|background|surface|fill|elevation)$/;
const LINE_ROLE = /^(border|stroke|outline|divider|separator|ring|icon)$/;

// Build a suffix -> bg-token map for a set of semantic COLOR tokens.
function bgIndex(colors: AnalyzedVariable[]): Map<string, AnalyzedVariable> {
  const m = new Map<string, AnalyzedVariable>();
  for (const v of colors) if (BG_ROLE.test(roleOf(v.name))) m.set(suffixOf(v.name), v);
  return m;
}

function findSurface(
  bg: Map<string, AnalyzedVariable>,
  suffix: string
): AnalyzedVariable | undefined {
  if (bg.has(suffix)) return bg.get(suffix);
  const on = suffix.match(/^on[-/](.+)$/); // fg/on-brand -> surface "brand"
  if (on && bg.has(on[1])) return bg.get(on[1]);
  return bg.get("default"); // fall back to the base surface
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
  const bg = bgIndex(colors);
  const out: PartialFinding[] = [];
  for (const fore of colors) {
    if (!foreRole.test(roleOf(fore.name))) continue;
    const surface = findSurface(bg, suffixOf(fore.name));
    if (!surface || surface.id === fore.id) continue;
    const modes = a.modesByCollection.get(fore.collectionId) ?? Object.keys(fore.valuesByMode);
    for (const mode of modes) {
      const fc = resolveColor(a, fore.id, mode);
      const bc = resolveColor(a, surface.id, mode);
      if (!fc || !bc) continue;
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

export const a11yDetectors: Record<string, Detector> = {
  "fg-bg-pair-contrast": fgBgPairContrast,
  "border-icon-graphical-contrast": borderIconGraphicalContrast,
};
