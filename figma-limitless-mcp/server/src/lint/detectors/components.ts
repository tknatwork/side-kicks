// Component/variant-structure detectors from componentPropertyDefinitions
// (already in the snapshot). The rules that need variant counts, instance/
// override data, usage, or cross-component heuristics land later. All advisory.

import type { Detector } from "../runner.js";
import type { LintSnapshot } from "../runner.js";
import type { PartialFinding } from "./shared.js";

interface PropDef {
  type?: string;
  variantOptions?: string[];
  preferredValues?: unknown[];
}

const BOOLEAN_PAIRS = [
  new Set(["true", "false"]),
  new Set(["yes", "no"]),
  new Set(["on", "off"]),
  new Set(["enabled", "disabled"]),
  new Set(["show", "hide"]),
  new Set(["visible", "hidden"]),
];
const ASSET_VARIANT_CEILING = 12;

const baseName = (key: string): string => key.split("#")[0].trim();

function eachProp(
  snap: LintSnapshot,
  fn: (c: { id: string; name: string }, key: string, def: PropDef) => void
): void {
  for (const c of snap.components ?? []) {
    const defs = c.propertyDefinitions;
    if (!defs || typeof defs !== "object") continue;
    for (const [key, raw] of Object.entries(defs)) {
      fn(c, key, (raw ?? {}) as PropDef);
    }
  }
}

const propertyNameConventionUnique: Detector = (snap) => {
  const out: PartialFinding[] = [];
  for (const c of snap.components ?? []) {
    const defs = c.propertyDefinitions;
    if (!defs || typeof defs !== "object") continue;
    const counts = new Map<string, number>();
    for (const key of Object.keys(defs)) {
      const base = baseName(key).toLowerCase();
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    for (const [base, n] of counts) {
      if (n > 1) {
        out.push({
          rule_id: "property-name-convention-unique",
          nodeId: c.id,
          message: `Component '${c.name}' has ${n} properties named '${base}'; duplicate property base names are ambiguous for instances and code — make them unique.`,
        });
      }
    }
  }
  return out;
};

const booleanVocabVariantShouldBeBoolean: Detector = (snap) => {
  const out: PartialFinding[] = [];
  eachProp(snap, (c, key, def) => {
    if (def.type !== "VARIANT" || !Array.isArray(def.variantOptions)) return;
    if (def.variantOptions.length !== 2) return;
    const opts = new Set(def.variantOptions.map((o) => String(o).toLowerCase()));
    const isBool = BOOLEAN_PAIRS.some(
      (p) => p.size === opts.size && [...p].every((x) => opts.has(x))
    );
    if (isBool) {
      out.push({
        rule_id: "boolean-vocab-variant-should-be-boolean",
        nodeId: c.id,
        message: `Component '${c.name}' property '${baseName(key)}' is a VARIANT with options {${[...opts].join(", ")}}; make it a BOOLEAN property so it maps to a boolean prop in code.`,
      });
    }
  });
  return out;
};

const instanceSwapPreferredValues: Detector = (snap) => {
  const out: PartialFinding[] = [];
  eachProp(snap, (c, key, def) => {
    if (def.type !== "INSTANCE_SWAP") return;
    if (!Array.isArray(def.preferredValues) || def.preferredValues.length === 0) {
      out.push({
        rule_id: "instance-swap-preferred-values",
        nodeId: c.id,
        message: `Component '${c.name}' instance-swap property '${baseName(key)}' has no preferredValues; set a curated list so instance users pick from the right components.`,
      });
    }
  });
  return out;
};

const noAssetEnumerationVariant: Detector = (snap) => {
  const out: PartialFinding[] = [];
  eachProp(snap, (c, key, def) => {
    if (def.type !== "VARIANT" || !Array.isArray(def.variantOptions)) return;
    if (def.variantOptions.length > ASSET_VARIANT_CEILING) {
      out.push({
        rule_id: "no-asset-enumeration-variant",
        nodeId: c.id,
        message: `Component '${c.name}' VARIANT property '${baseName(key)}' has ${def.variantOptions.length} options; enumerating that many (usually assets/icons) as variants explodes the matrix — use an INSTANCE_SWAP property instead.`,
      });
    }
  });
  return out;
};

const DEFAULT_VARIANT_CEILING = 60;

interface CeilingConfig {
  ceiling: number;
}

// The full variant matrix is the PRODUCT of each VARIANT property's option
// count. Past the ceiling (~60 by default, tunable via config) a set gets slow
// to edit and instantiate; the fix is to convert an axis to a BOOLEAN/
// INSTANCE_SWAP prop or split the component. Computed from propertyDefinitions
// alone — no variant-child data needed.
const variantCountCeiling60: Detector = (snap, config) => {
  const ceiling = (config as CeilingConfig | undefined)?.ceiling ?? DEFAULT_VARIANT_CEILING;
  const out: PartialFinding[] = [];
  for (const c of snap.components ?? []) {
    const defs = c.propertyDefinitions;
    if (!defs || typeof defs !== "object") continue;
    let product = 1;
    let variantProps = 0;
    for (const raw of Object.values(defs)) {
      const def = (raw ?? {}) as PropDef;
      if (def.type === "VARIANT" && Array.isArray(def.variantOptions) && def.variantOptions.length > 0) {
        product *= def.variantOptions.length;
        variantProps++;
      }
    }
    if (variantProps > 0 && product > ceiling) {
      out.push({
        rule_id: "variant-count-ceiling-60",
        nodeId: c.id,
        message: `Component '${c.name}' declares a ${product}-cell variant matrix across ${variantProps} variant propert${variantProps === 1 ? "y" : "ies"}; past ~${ceiling} the set gets slow and unwieldy — convert an axis to a BOOLEAN/INSTANCE_SWAP property or split the component.`,
      });
    }
  }
  return out;
};

// A BOOLEAN property named for a size/layout concept is usually mis-modeled —
// booleans are show/hide; sizing wants a VARIANT axis or a bound layout token.
// Matches any word-token in the base name against a sizing vocabulary. info.
const SIZING_WORD =
  /^(size|sizing|scale|large|small|big|wide|narrow|tall|short|compact|comfortable|cozy|dense|spacious|width|height|xs|sm|md|lg|xl|xxl)$/;
const booleanPropNoSizingIntent: Detector = (snap) => {
  const out: PartialFinding[] = [];
  eachProp(snap, (c, key, def) => {
    if (def.type !== "BOOLEAN") return;
    const words = baseName(key).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (words.some((w) => SIZING_WORD.test(w))) {
      out.push({
        rule_id: "boolean-prop-no-sizing-intent",
        nodeId: c.id,
        message: `Component '${c.name}' BOOLEAN property '${baseName(key)}' names a size/layout concept; booleans are for show/hide — express sizing as a VARIANT size axis or a bound layout token.`,
      });
    }
  });
  return out;
};

// Opt-in (defaultOn:false): the SAME variant property name across components
// should use one option vocabulary (sm/md/lg, not also small/medium/large). But
// a shared name isn't always the same axis (a Button's 'variant' vs an Alert's),
// so this is a team judgment call — off by default to avoid false positives.
const sharedPropertyValueConsistency: Detector = (snap) => {
  const byProp = new Map<string, Map<string, string[]>>(); // base -> optionSetKey -> component names
  eachProp(snap, (c, key, def) => {
    if (def.type !== "VARIANT" || !Array.isArray(def.variantOptions) || def.variantOptions.length === 0) return;
    const base = baseName(key).toLowerCase();
    const optKey = [...def.variantOptions].map((o) => String(o).toLowerCase()).sort().join("|");
    const m = byProp.get(base) ?? byProp.set(base, new Map()).get(base)!;
    (m.get(optKey) ?? m.set(optKey, []).get(optKey)!).push(c.name);
  });
  const out: PartialFinding[] = [];
  for (const [base, variants] of byProp) {
    if (variants.size > 1) {
      const summary = [...variants.entries()]
        .map(([optKey, comps]) => `{${optKey.replace(/\|/g, ", ")}} in ${comps.length}`)
        .join("; ");
      out.push({
        rule_id: "shared-property-value-consistency",
        message: `Property '${base}' uses ${variants.size} different option sets across components (${summary}); normalize to one vocabulary so the same axis reads identically file-wide.`,
      });
    }
  }
  return out;
};

// Enrichment-driven (component walk). A non-VARIANT property (BOOLEAN / TEXT /
// INSTANCE_SWAP) that no descendant references is dead — VARIANT axes are
// structural, not layer-referenced, so they're exempt. Silent unless enriched.
const noDeadComponentProperty: Detector = (snap) => {
  const out: PartialFinding[] = [];
  for (const c of snap.components ?? []) {
    if (c.enriched !== true || !c.propertyDefinitions || !Array.isArray(c.referencedPropKeys)) continue;
    const referenced = new Set(c.referencedPropKeys.map((k) => baseName(k).toLowerCase()));
    for (const [key, raw] of Object.entries(c.propertyDefinitions)) {
      const def = (raw ?? {}) as PropDef;
      if (def.type === "VARIANT") continue;
      if (!referenced.has(baseName(key).toLowerCase())) {
        out.push({
          rule_id: "no-dead-component-property",
          nodeId: c.id,
          message: `Component '${c.name}' property '${baseName(key)}' (${def.type ?? "?"}) is never referenced by a layer; wire it via componentPropertyReferences or delete it.`,
        });
      }
    }
  }
  return out;
};

// A COMPONENT_SET whose realized variant tuples number fewer than the product of
// its variant options is missing combinations. Uses the actual variant children
// (variantTuples); skips when that list was truncated (would false-flag).
const variantMatrixComplete: Detector = (snap) => {
  const out: PartialFinding[] = [];
  for (const c of snap.components ?? []) {
    if (c.type !== "COMPONENT_SET" || !Array.isArray(c.variantTuples) || c.variantTuplesTruncated) continue;
    const defs = c.propertyDefinitions;
    if (!defs || typeof defs !== "object") continue;
    let expected = 1;
    let variantProps = 0;
    for (const raw of Object.values(defs)) {
      const def = (raw ?? {}) as PropDef;
      if (def.type === "VARIANT" && Array.isArray(def.variantOptions) && def.variantOptions.length > 0) {
        expected *= def.variantOptions.length;
        variantProps++;
      }
    }
    if (variantProps === 0) continue;
    const actual = c.variantTuples.length;
    if (actual < expected) {
      out.push({
        rule_id: "variant-matrix-complete",
        nodeId: c.id,
        message: `Component set '${c.name}' defines ${actual} of ${expected} possible variant combinations (${expected - actual} missing); add the missing tuples or reduce an axis to BOOLEAN/INSTANCE_SWAP so the matrix is complete.`,
      });
    }
  }
  return out;
};

export const componentDetectors: Record<string, Detector> = {
  "property-name-convention-unique": propertyNameConventionUnique,
  "boolean-vocab-variant-should-be-boolean": booleanVocabVariantShouldBeBoolean,
  "instance-swap-preferred-values": instanceSwapPreferredValues,
  "no-asset-enumeration-variant": noAssetEnumerationVariant,
  "variant-count-ceiling-60": variantCountCeiling60,
  "boolean-prop-no-sizing-intent": booleanPropNoSizingIntent,
  "shared-property-value-consistency": sharedPropertyValueConsistency,
  "no-dead-component-property": noDeadComponentProperty,
  "variant-matrix-complete": variantMatrixComplete,
};
