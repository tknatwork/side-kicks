// Wave 11a: the two deferred rules implementable offline (both opt-in). Each
// fires only when enabled + (for multi-brand) configured, and is silent by
// default / on its control.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runLint } from "../dist/lint/index.js";

const base = (over) => ({ collections: [], variables: [], styles: [], components: [], meta: { pageCount: 1, scannedAllPages: true }, ...over });
const has = (rep, id) => rep.findings.some((f) => f.rule_id === id);
const V = (id, name, collectionId, valuesByMode) => ({
  id, name, collectionId, resolvedType: "COLOR",
  scopes: ["ALL_FILLS"], hiddenFromPublishing: false, codeSyntax: {}, description: "",
  valuesByMode,
});
const A = (id) => ({ alias: id });

// ---- default-variant-is-base-tuple ---------------------------------------
const setDefault = (defaultVal) => base({
  components: [{
    id: "s", name: "Button", type: "COMPONENT_SET",
    propertyDefinitions: { Size: { type: "VARIANT", variantOptions: ["sm", "md", "lg"] } },
    defaultVariantTuple: { Size: defaultVal },
  }],
});

test("default-variant-is-base-tuple: opt-in; fires when default != first option", () => {
  // opt-in off by default -> silent even though md != sm
  assert.ok(!has(runLint(setDefault("md")), "default-variant-is-base-tuple"));
  // enabled + default 'md' (2nd) deviates from base 'sm' -> fires
  assert.ok(has(runLint(setDefault("md"), { enable: ["default-variant-is-base-tuple"] }), "default-variant-is-base-tuple"));
  // enabled + default 'sm' (first/base) -> silent
  assert.ok(!has(runLint(setDefault("sm"), { enable: ["default-variant-is-base-tuple"] }), "default-variant-is-base-tuple"));
});

// ---- multi-brand-alias-discipline ----------------------------------------
const brandSnap = () => base({
  collections: [
    { id: "P", name: "Primitives", defaultModeId: "p", modes: [{ modeId: "p", name: "V" }] },
    { id: "S", name: "Semantic", defaultModeId: "s", modes: [{ modeId: "s", name: "V" }] },
  ],
  variables: [
    { ...V("p_blue", "blue/500", "P", { p: { r: 0.1, g: 0.3, b: 0.9 } }), hiddenFromPublishing: true },
    V("brand_primary", "brand/primary", "S", { s: A("p_blue") }),      // the brand layer
    V("accent_good", "accent/default", "S", { s: A("brand_primary") }), // routes through brand -> ok
    V("accent_bad", "accent/emphasis", "S", { s: A("p_blue") }),        // skips brand -> fires
    V("fg", "foreground/default", "S", { s: A("p_blue") }),             // not a brandable role -> silent
  ],
});

test("multi-brand-alias-discipline: opt-in + config; flags brandable semantics that skip the brand layer", () => {
  const cfg = { config: { "multi-brand-alias-discipline": { brandPrefix: "brand" } }, enable: ["multi-brand-alias-discipline"] };
  const rep = runLint(brandSnap(), cfg);
  assert.ok(rep.findings.some((f) => f.rule_id === "multi-brand-alias-discipline" && f.variableId === "accent_bad"));
  assert.ok(!rep.findings.some((f) => f.rule_id === "multi-brand-alias-discipline" && f.variableId === "accent_good"));
  assert.ok(!rep.findings.some((f) => f.rule_id === "multi-brand-alias-discipline" && f.variableId === "fg"));
  assert.ok(!rep.findings.some((f) => f.rule_id === "multi-brand-alias-discipline" && f.variableId === "brand_primary")); // brand layer itself exempt
});

test("multi-brand-alias-discipline: off by default; missing config -> config_errors", () => {
  assert.ok(!has(runLint(brandSnap()), "multi-brand-alias-discipline")); // opt-in off
  const rep = runLint(brandSnap(), { enable: ["multi-brand-alias-discipline"] }); // enabled, no config
  assert.ok(rep.config_errors.some((e) => e.rule_id === "multi-brand-alias-discipline"));
  assert.ok(!has(rep, "multi-brand-alias-discipline"));
});

// ---- contrast-fallback-export-sampling (offline: alpha detection) ---------
const RGBA = (r, g, b, a) => ({ r, g, b, a });
test("contrast-fallback-export-sampling: flags translucent semantic colour tokens", () => {
  const snap = base({
    collections: [
      { id: "P", name: "Primitives", defaultModeId: "p", modes: [{ modeId: "p", name: "V" }] },
      { id: "S", name: "Semantic", defaultModeId: "s", modes: [{ modeId: "s", name: "V" }] },
    ],
    variables: [
      { ...V("p_scrim", "black/50", "P", { p: RGBA(0, 0, 0, 0.5) }), hiddenFromPublishing: true },
      { ...V("p_solid", "black", "P", { p: RGBA(0, 0, 0, 1) }), hiddenFromPublishing: true },
      V("s_overlay", "background/overlay", "S", { s: A("p_scrim") }), // translucent -> fires
      V("s_fg", "foreground/default", "S", { s: A("p_solid") }),       // opaque -> silent
      V("s_accent", "accent/default", "S", { s: A("p_scrim") }),       // role not fg/bg/line -> silent
    ],
  });
  const rep = runLint(snap);
  assert.ok(rep.findings.some((f) => f.rule_id === "contrast-fallback-export-sampling" && f.variableId === "s_overlay"));
  assert.ok(!rep.findings.some((f) => f.rule_id === "contrast-fallback-export-sampling" && f.variableId === "s_fg"));
  assert.ok(!rep.findings.some((f) => f.rule_id === "contrast-fallback-export-sampling" && f.variableId === "s_accent"));
});
