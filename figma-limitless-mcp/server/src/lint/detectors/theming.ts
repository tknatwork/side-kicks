// Theming / mode-structure detectors. Theme lives as modes on the Semantic
// tier; Primitives and Component are single-mode. All advisory (warn/info) —
// these are structural preferences, not breakage.

import type { Detector } from "../runner.js";
import type { PartialFinding } from "./shared.js";
import { analyze, aliasTarget } from "./shared.js";

const primitiveComponentSingleMode: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const c of snap.collections) {
    const tier = a.collectionTier.get(c.id);
    if ((tier === "primitive" || tier === "component") && c.modes.length > 1) {
      out.push({
        rule_id: "primitive-component-single-mode",
        message: `${tier === "primitive" ? "Primitive" : "Component"} collection '${c.name}' has ${c.modes.length} modes; only the Semantic tier should be multi-mode (theme). Keep this single-mode and move theming to Semantic.`,
      });
    }
  }
  return out;
};

const everyModePopulated: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    const modes = a.modesByCollection.get(v.collectionId) ?? [];
    const missing = modes.filter((m) => !(m in v.valuesByMode));
    if (missing.length > 0) {
      out.push({
        rule_id: "every-mode-populated",
        variableId: v.id,
        message: `'${v.name}' has no value in ${missing.length} of its collection's mode(s).`,
      });
    }
  }
  return out;
};

const MODE_CEILING = 8;
const modeCountCeiling: Detector = (snap) => {
  const out: PartialFinding[] = [];
  for (const c of snap.collections) {
    if (c.modes.length > MODE_CEILING) {
      out.push({
        rule_id: "mode-count-ceiling",
        message: `Collection '${c.name}' has ${c.modes.length} modes (> ${MODE_CEILING}); a very high count usually means several axes (theme + density + platform) are folded into one collection — split them so each collection has one axis.`,
      });
    }
  }
  return out;
};

const semanticDefaultModeIsBase: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const c of snap.collections) {
    if (a.collectionTier.get(c.id) !== "semantic" || c.modes.length < 2) continue;
    const def = c.modes.find((m) => m.modeId === c.defaultModeId);
    if (def && /dark|night|inverse/i.test(def.name)) {
      out.push({
        rule_id: "semantic-default-mode-is-base",
        message: `Semantic collection '${c.name}' defaults to mode '${def.name}'; the default should be the base/light theme so consumers that don't set a mode get the base look.`,
      });
    }
  }
  return out;
};

// The same mode spelled inconsistently across collections (e.g. 'Light' vs
// 'light' vs 'Light ') breaks the assumption that same-named modes line up on an
// axis. Objective (a normalized name with >1 raw spelling), so default-on/warn.
const consistentModeNamesAcrossAxis: Detector = (snap) => {
  const spellings = new Map<string, Set<string>>();
  for (const c of snap.collections) {
    for (const m of c.modes) {
      const norm = m.name.trim().toLowerCase();
      if (!norm) continue;
      (spellings.get(norm) ?? spellings.set(norm, new Set()).get(norm)!).add(m.name);
    }
  }
  const out: PartialFinding[] = [];
  for (const [norm, raws] of spellings) {
    if (raws.size > 1) {
      out.push({
        rule_id: "consistent-mode-names-across-axis",
        message: `Mode '${norm}' is spelled ${raws.size} different ways across collections (${[...raws].map((r) => `'${r}'`).join(", ")}); use one canonical spelling so theme axes line up.`,
      });
    }
  }
  return out;
};

// A collection whose modes are a full A×B cross-product ('Light Compact', 'Dark
// Compact', 'Light Cozy', 'Dark Cozy') folds TWO axes into one collection.
// Conservative: needs >=4 modes, every mode exactly two separator-split tokens,
// and count == |A|*|B|. Advisory/info.
const MODE_SEP = /[\s/·|,_-]+/;
const oneThemeAxisPerCollection: Detector = (snap) => {
  const out: PartialFinding[] = [];
  for (const c of snap.collections) {
    if (c.modes.length < 4) continue;
    const parts = c.modes.map((m) => m.name.trim().split(MODE_SEP).filter(Boolean));
    if (!parts.every((p) => p.length === 2)) continue;
    const first = new Set(parts.map((p) => p[0].toLowerCase()));
    const second = new Set(parts.map((p) => p[1].toLowerCase()));
    if (first.size >= 2 && second.size >= 2 && first.size * second.size === c.modes.length) {
      out.push({
        rule_id: "one-theme-axis-per-collection",
        message: `Collection '${c.name}' has ${c.modes.length} modes that read as a ${first.size}×${second.size} cross-product ({${[...first].join(", ")}} × {${[...second].join(", ")}}); a collection should switch on ONE axis — split the second into its own collection.`,
      });
    }
  }
  return out;
};

// Opt-in (defaultOn:false), config-driven: only meaningful for multi-brand DSs,
// which must declare their brand layer. A "brandable" semantic (accent/action/
// brand/... role) should alias THROUGH a brand/* token so re-branding is a
// single-layer swap; if its alias chain reaches a primitive without passing a
// brand-layer token, flag it. Requires config { brandPrefix, roles? }.
interface MultiBrandConfig {
  brandPrefix: string;
  roles: string[];
}
const multiBrandAliasDiscipline: Detector = (snap, config) => {
  const cfg = config as MultiBrandConfig | undefined;
  if (!cfg || typeof cfg.brandPrefix !== "string" || !cfg.brandPrefix) return [];
  const prefix = cfg.brandPrefix.toLowerCase();
  const roles = new Set((cfg.roles ?? []).map((r) => r.toLowerCase()));
  const a = analyze(snap);
  const isBrandVar = (name: string): boolean =>
    name.toLowerCase().split("/").includes(prefix);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.tier !== "semantic") continue;
    if (isBrandVar(v.name)) continue; // the brand layer itself needn't route through itself
    if (!roles.has(v.name.toLowerCase().split("/")[0])) continue;
    // Does the token alias through the brand layer in ANY mode? Follow each
    // mode's chain in THAT SAME mode (falling back to a target's first mode only
    // when the mode is absent) — collapsing to the first mode makes the result
    // order-dependent and can fabricate/miss a finding on per-mode-divergent chains.
    let routed = false;
    for (const [modeId, val] of Object.entries(v.valuesByMode)) {
      let t = aliasTarget(val);
      const seen = new Set<string>();
      let hops = 0;
      while (t && !seen.has(t) && hops < 16) {
        seen.add(t);
        const tv = a.byId.get(t);
        if (!tv) break;
        if (isBrandVar(tv.name)) {
          routed = true;
          break;
        }
        const next = modeId in tv.valuesByMode ? tv.valuesByMode[modeId] : Object.values(tv.valuesByMode)[0];
        t = aliasTarget(next);
        hops++;
      }
      if (routed) break;
    }
    if (!routed) {
      out.push({
        rule_id: "multi-brand-alias-discipline",
        variableId: v.id,
        message: `Brandable semantic '${v.name}' doesn't route through the '${cfg.brandPrefix}' layer; alias it via a ${cfg.brandPrefix}/* token so re-branding is a single-layer swap.`,
      });
    }
  }
  return out;
};

export const themingDetectors: Record<string, Detector> = {
  "primitive-component-single-mode": primitiveComponentSingleMode,
  "every-mode-populated": everyModePopulated,
  "mode-count-ceiling": modeCountCeiling,
  "semantic-default-mode-is-base": semanticDefaultModeIsBase,
  "consistent-mode-names-across-axis": consistentModeNamesAcrossAxis,
  "one-theme-axis-per-collection": oneThemeAxisPerCollection,
  "multi-brand-alias-discipline": multiBrandAliasDiscipline,
};
