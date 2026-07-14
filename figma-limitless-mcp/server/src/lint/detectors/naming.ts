// Naming detectors — deliberately tolerant. A team's case convention (kebab
// vs camel) and category vocabulary are THEIR choice, so we flag only
// objectively-messy names and the one naming rule that affects theming
// (hue words belong to primitives, not semantics). All advisory (warn).

import type { Detector } from "../runner.js";
import type { PartialFinding } from "./shared.js";
import { analyze, roleSegment } from "./shared.js";

// True chromatic hues only — neutral/gray/slate/etc. are commonly used as
// legitimate semantic role names, so they're excluded to avoid false positives.
const HUE_WORD =
  /^(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)$/;

const nameKebabSegments: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    const segs = v.name.split("/");
    const messy =
      v.name.startsWith("/") ||
      v.name.endsWith("/") ||
      v.name.includes("//") ||
      segs.some((s) => s.length === 0 || /\s/.test(s));
    if (messy) {
      out.push({
        rule_id: "name-kebab-segments",
        variableId: v.id,
        message: `'${v.name}' has a malformed segment (space, empty, or stray slash); use clean slash-separated segments.`,
      });
    }
  }
  return out;
};

const nameSlashStructureDepth: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    const depth = v.name.split("/").length;
    if (depth < 2) {
      out.push({
        rule_id: "name-slash-structure-depth",
        variableId: v.id,
        message: `'${v.name}' is flat (no group); use slash grouping like 'category/role' so it nests in the Variables panel and code output.`,
      });
    } else if (depth > 5) {
      out.push({
        rule_id: "name-slash-structure-depth",
        variableId: v.id,
        message: `'${v.name}' is ${depth} levels deep; very deep names are hard to consume — flatten toward category/role/variant.`,
      });
    }
  }
  return out;
};

const hueRampWordsPrimitivesOnly: Detector = (snap) => {
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.tier === "primitive") continue; // hue ramps belong in primitives
    const hue = v.name
      .toLowerCase()
      .split("/")
      .find((s) => HUE_WORD.test(s));
    if (hue) {
      out.push({
        rule_id: "hue-ramp-words-primitives-only",
        variableId: v.id,
        message: `${v.tier} token '${v.name}' names a hue ('${hue}'); semantic/component tokens should be role-named (bg/fg/brand), not colour-named — role names are what let a theme repaint them.`,
      });
    }
  }
  return out;
};

// Pull the on-<X> target from a token name (mirrors the a11y pairing rule).
const onTargetSeg = (name: string): string | null => {
  const segs = name.toLowerCase().split("/");
  for (let i = 0; i < segs.length; i++) {
    const m = segs[i].match(/^on[-_](.+)$/);
    if (m) return m[1];
    if (segs[i] === "on" && segs[i + 1]) return segs[i + 1];
  }
  return null;
};
const SURFACE_ROLE = /^(surface|background|bg|fill|elevation)$/;
const FG_ROLE = /^(fg|foreground|text|ink|content|icon|label)$/;
// Generic surface modifiers pair with plain foreground/default, not an on-<X>.
const GENERIC_SURFACE_KEY =
  /^(default|base|muted|subtle|emphasis|inverse|overlay|disabled|hover|active|focus|selected|pressed)$/;

// Once a DS ADOPTS the on-<X> convention (Material's on-primary, Primer's
// fg-on-emphasis), every chromatic surface should have its pair, so text on it
// has a defined, contrast-checkable colour. Fires only on INCONSISTENCY (some
// surfaces paired, this one forgotten) — a DS that doesn't use on-<X> at all is
// making a valid choice and gets nothing here.
const surfaceOnPairCompleteness: Detector = (snap) => {
  const a = analyze(snap);
  const colors = a.variables.filter(
    (v) => v.tier === "semantic" && v.resolvedType === "COLOR"
  );
  const onKeys = new Set<string>();
  for (const v of colors) {
    if (!FG_ROLE.test(v.name.toLowerCase().split("/")[0])) continue;
    const t = onTargetSeg(v.name);
    if (t) onKeys.add(t);
  }
  if (onKeys.size === 0) return []; // convention not adopted
  const out: PartialFinding[] = [];
  const flagged = new Set<string>();
  for (const v of colors) {
    const segs = v.name.toLowerCase().split("/");
    if (!SURFACE_ROLE.test(segs[0])) continue;
    const key = segs[1]; // the surface's colour key (leading suffix segment)
    if (!key || GENERIC_SURFACE_KEY.test(key)) continue;
    if (onKeys.has(key) || flagged.has(key)) continue;
    flagged.add(key);
    out.push({
      rule_id: "surface-on-pair-completeness",
      variableId: v.id,
      message: `Surface '${v.name}' has no matching on-${key} foreground token, though the DS defines on-tokens for other surfaces; text on it has no contrast-checked colour. Add foreground/on-${key}.`,
    });
  }
  return out;
};

// ---- Opt-in, config-driven detectors (defaultOn:false) -------------------
// These encode a TEAM'S house style, so they never run by default — only when
// explicitly enabled with the team's own vocabulary/params (config.ts validates
// the shape; the runner passes it here already resolved).

interface RoleAllowlistConfig {
  allowlist: string[]; // lowercased by the resolver
  resolvedType: string;
}
const semanticRoleAllowlist: Detector = (snap, config) => {
  const cfg = config as RoleAllowlistConfig | undefined;
  if (!cfg || !Array.isArray(cfg.allowlist) || cfg.allowlist.length === 0) return [];
  const allow = new Set(cfg.allowlist);
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    if (v.tier !== "semantic" || v.resolvedType !== cfg.resolvedType) continue;
    const role = roleSegment(v.name);
    if (!allow.has(role)) {
      out.push({
        rule_id: "semantic-role-allowlist",
        variableId: v.id,
        message: `Semantic ${cfg.resolvedType} token '${v.name}' uses role '${role}', not in the configured allowlist (${cfg.allowlist.join(", ")}); rename to an approved role or extend the allowlist deliberately.`,
      });
    }
  }
  return out;
};

interface TierVocabConfig {
  vocab: { primitive?: string[]; semantic?: string[]; component?: string[] };
}
const topSegmentInTierVocabulary: Detector = (snap, config) => {
  const cfg = config as TierVocabConfig | undefined;
  if (!cfg || !cfg.vocab) return [];
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    const list = cfg.vocab[v.tier as "primitive" | "semantic" | "component"];
    if (!list || list.length === 0) continue; // no vocabulary configured for this tier
    const top = roleSegment(v.name);
    if (!list.includes(top)) {
      out.push({
        rule_id: "top-segment-in-tier-vocabulary",
        variableId: v.id,
        message: `${v.tier} token '${v.name}' starts with '${top}', not in the configured ${v.tier} vocabulary (${list.join(", ")}); rename or move it to the tier its name implies.`,
      });
    }
  }
  return out;
};

interface ZeroPadConfig {
  width: number;
}
const numericScaleZeroPadded: Detector = (snap, config) => {
  const width = (config as ZeroPadConfig | undefined)?.width ?? 3;
  const a = analyze(snap);
  const out: PartialFinding[] = [];
  for (const v of a.variables) {
    for (const seg of v.name.split("/")) {
      if (/^\d+$/.test(seg) && seg.length < width) {
        out.push({
          rule_id: "numeric-scale-zero-padded",
          variableId: v.id,
          message: `'${v.name}' has numeric step '${seg}' not zero-padded to ${width} digits (e.g. '${seg.padStart(width, "0")}'); pad for stable sort order and codegen.`,
        });
        break; // one finding per variable
      }
    }
  }
  return out;
};

export const namingDetectors: Record<string, Detector> = {
  "name-kebab-segments": nameKebabSegments,
  "name-slash-structure-depth": nameSlashStructureDepth,
  "hue-ramp-words-primitives-only": hueRampWordsPrimitivesOnly,
  "surface-on-pair-completeness": surfaceOnPairCompleteness,
  "semantic-role-allowlist": semanticRoleAllowlist,
  "top-segment-in-tier-vocabulary": topSegmentInTierVocabulary,
  "numeric-scale-zero-padded": numericScaleZeroPadded,
};
