// Wave 10a: the pending rules implementable over the EXISTING snapshot (no new
// plugin data). Each fires on a violation and stays silent on the control.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runLint } from "../dist/lint/index.js";
import { themingDetectors } from "../dist/lint/detectors/theming.js";
import { componentDetectors } from "../dist/lint/detectors/components.js";
import { tokenDetectors } from "../dist/lint/detectors/tokens.js";

const coll = (id, name, modes) => ({ id, name, defaultModeId: modes[0].modeId, modes });
const mode = (id, name) => ({ modeId: id, name });
const cset = (id, name, propertyDefinitions) => ({ id, name, type: "COMPONENT_SET", propertyDefinitions });
const V = (id, name, collectionId, valuesByMode) => ({
  id, name, collectionId, resolvedType: "COLOR",
  scopes: ["ALL_FILLS"], hiddenFromPublishing: false, codeSyntax: {}, description: "",
  valuesByMode,
});
const A = (id) => ({ alias: id });
const base = (over) => ({ collections: [], variables: [], styles: [], components: [], meta: { pageCount: 1, scannedAllPages: true }, ...over });
const has = (arr, id) => arr.some((f) => f.rule_id === id);

test("consistent-mode-names-across-axis: same mode spelled differently fires", () => {
  const snap = base({ collections: [
    coll("c1", "Theme A", [mode("a", "Light"), mode("b", "Dark")]),
    coll("c2", "Theme B", [mode("c", "light"), mode("d", "Dark")]), // 'light' vs 'Light'
  ] });
  const f = themingDetectors["consistent-mode-names-across-axis"](snap);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /light/i);
  // consistent spelling -> silent
  const clean = base({ collections: [
    coll("c1", "A", [mode("a", "Light"), mode("b", "Dark")]),
    coll("c2", "B", [mode("c", "Light"), mode("d", "Dark")]),
  ] });
  assert.equal(themingDetectors["consistent-mode-names-across-axis"](clean).length, 0);
});

test("one-theme-axis-per-collection: a 2x2 cross-product of modes fires", () => {
  const snap = base({ collections: [
    coll("c", "Tokens", [mode("1", "Light Compact"), mode("2", "Dark Compact"), mode("3", "Light Cozy"), mode("4", "Dark Cozy")]),
  ] });
  const f = themingDetectors["one-theme-axis-per-collection"](snap);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /2×2|cross-product/);
  // a single-axis 2-mode collection -> silent
  const single = base({ collections: [coll("c", "T", [mode("1", "Light"), mode("2", "Dark")])] });
  assert.equal(themingDetectors["one-theme-axis-per-collection"](single).length, 0);
});

test("boolean-prop-no-sizing-intent: a BOOLEAN named for size fires, show/hide is silent", () => {
  const snap = base({ components: [
    cset("c1", "Card", { large: { type: "BOOLEAN" }, disabled: { type: "BOOLEAN" } }),
  ] });
  const f = componentDetectors["boolean-prop-no-sizing-intent"](snap);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /large/);
});

test("shared-property-value-consistency: opt-in; fires on inconsistent option sets when enabled", () => {
  const snap = base({ components: [
    cset("c1", "Button", { size: { type: "VARIANT", variantOptions: ["sm", "md", "lg"] } }),
    cset("c2", "Chip", { size: { type: "VARIANT", variantOptions: ["small", "medium", "large"] } }),
  ] });
  // default lint (opt-in off) -> not present
  assert.ok(!has(runLint(snap).findings, "shared-property-value-consistency"));
  // enabled -> fires
  const rep = runLint(snap, { enable: ["shared-property-value-consistency"] });
  assert.ok(has(rep.findings, "shared-property-value-consistency"));
  // consistent option sets -> silent even when enabled
  const consistent = base({ components: [
    cset("c1", "Button", { size: { type: "VARIANT", variantOptions: ["sm", "md", "lg"] } }),
    cset("c2", "Chip", { size: { type: "VARIANT", variantOptions: ["sm", "md", "lg"] } }),
  ] });
  assert.ok(!has(runLint(consistent, { enable: ["shared-property-value-consistency"] }).findings, "shared-property-value-consistency"));
});

test("single-use-component-passthrough: pure pass-through used <=1 fires; respects usage + scan guard", () => {
  const collections = [
    coll("P", "Primitives", [mode("p", "V")]),
    coll("S", "Semantic", [mode("s", "V")]),
    coll("K", "Component", [mode("k", "V")]),
  ];
  const variables = [
    { ...V("p_w", "white", "P", { p: { r: 1, g: 1, b: 1 } }), hiddenFromPublishing: true },
    V("s_accent", "accent/default", "S", { s: A("p_w") }),
    V("c_btn", "button/bg", "K", { k: A("s_accent") }), // pure pass-through
  ];
  const snap = (bindings, truncated = false) => base({ collections, variables, nodeBindings: bindings, bindingsTruncated: truncated });
  // used nowhere -> fires
  assert.ok(has(tokenDetectors["single-use-component-passthrough"](snap([])), "single-use-component-passthrough"));
  // used twice -> silent
  const twice = [
    { nodeId: "n1", nodeName: "A", nodeType: "FRAME", field: "fills", variableId: "c_btn" },
    { nodeId: "n2", nodeName: "B", nodeType: "FRAME", field: "fills", variableId: "c_btn" },
  ];
  assert.ok(!has(tokenDetectors["single-use-component-passthrough"](snap(twice)), "single-use-component-passthrough"));
  // truncated scan -> silent (can't prove usage)
  assert.equal(tokenDetectors["single-use-component-passthrough"](snap([], true)).length, 0);
  // no scan at all -> silent
  assert.equal(tokenDetectors["single-use-component-passthrough"](base({ collections, variables })).length, 0);
});
