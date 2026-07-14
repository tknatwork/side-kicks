// Wave 10b: rules driven by the plugin's component-walk enrichment. Each fires
// on enriched data, and — critically — stays SILENT when the enrichment is
// absent (old plugin build) or, for negative-evidence rules, truncated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runLint } from "../dist/lint/index.js";
import { a11yDetectors } from "../dist/lint/detectors/a11y.js";
import { codegenDetectors } from "../dist/lint/detectors/codegen.js";
import { componentDetectors } from "../dist/lint/detectors/components.js";

const base = (over) => ({ collections: [], variables: [], styles: [], components: [], meta: { pageCount: 1, scannedAllPages: true }, ...over });
const comp = (over) => ({ id: "c", name: "Card", type: "COMPONENT", enriched: true, ...over });
const has = (arr, id) => arr.some((f) => f.rule_id === id);

test("min-font-size: flags small text styles and small component text; configurable floor", () => {
  const snap = base({
    styles: [
      { id: "s1", name: "caption", styleType: "TEXT", fontSize: 10 },
      { id: "s2", name: "body", styleType: "TEXT", fontSize: 16 },
    ],
    components: [comp({ minTextFontSize: 9 })],
  });
  const f = a11yDetectors["min-font-size"](snap, { floor: 12 });
  assert.ok(f.some((x) => /caption/.test(x.message))); // 10 < 12
  assert.ok(!f.some((x) => /body/.test(x.message))); // 16 ok
  assert.ok(f.some((x) => x.nodeId === "c")); // component text 9 < 12
  // configurable floor: 8 clears everything
  assert.equal(a11yDetectors["min-font-size"](snap, { floor: 8 }).length, 0);
  // no font data anywhere -> silent
  assert.equal(a11yDetectors["min-font-size"](base({ styles: [{ id: "s", name: "x", styleType: "TEXT" }] }), { floor: 12 }).length, 0);
});

test("min-font-size default floor (12) applies via runLint with no config", () => {
  const rep = runLint(base({ styles: [{ id: "s1", name: "tiny", styleType: "TEXT", fontSize: 8 }] }));
  assert.ok(has(rep.findings, "min-font-size"));
});

test("no-raw-value-on-component-node: fires only on enriched components with a raw layer", () => {
  assert.ok(has(codegenDetectors["no-raw-value-on-component-node"](base({ components: [comp({ hasRawPaintLayer: true, rawPaintSample: "Bg" })] })), "no-raw-value-on-component-node"));
  // enriched but clean -> silent
  assert.equal(codegenDetectors["no-raw-value-on-component-node"](base({ components: [comp({ hasRawPaintLayer: false })] })).length, 0);
  // not enriched -> silent (old plugin)
  assert.equal(codegenDetectors["no-raw-value-on-component-node"](base({ components: [{ id: "c", name: "C", type: "COMPONENT", hasRawPaintLayer: true }] })).length, 0);
});

test("text-layer-uses-style-or-bound-type: fires when enriched and untyped text present", () => {
  assert.ok(has(codegenDetectors["text-layer-uses-style-or-bound-type"](base({ components: [comp({ textLayersMissingType: 2, textLayerSample: "Label" })] })), "text-layer-uses-style-or-bound-type"));
  assert.equal(codegenDetectors["text-layer-uses-style-or-bound-type"](base({ components: [comp({ textLayersMissingType: 0 })] })).length, 0);
  assert.equal(codegenDetectors["text-layer-uses-style-or-bound-type"](base({ components: [{ id: "c", name: "C", type: "COMPONENT", textLayersMissingType: 3 }] })).length, 0);
});

test("no-dead-component-property: negative-evidence — needs a full scan; excludes VARIANT axes", () => {
  const defs = { "Show Icon#1:0": { type: "BOOLEAN" }, "Size#2:0": { type: "VARIANT", variantOptions: ["sm", "lg"] } };
  // 'Show Icon' referenced -> silent; 'Size' is VARIANT so never flagged
  assert.equal(componentDetectors["no-dead-component-property"](base({ components: [comp({ propertyDefinitions: defs, referencedPropKeys: ["Show Icon#1:0"] })] })).length, 0);
  // 'Show Icon' NOT referenced -> fires
  assert.ok(has(componentDetectors["no-dead-component-property"](base({ components: [comp({ propertyDefinitions: defs, referencedPropKeys: [] })] })), "no-dead-component-property"));
  // not enriched (partial scan) -> silent even if referencedPropKeys given (would false-flag)
  assert.equal(componentDetectors["no-dead-component-property"](base({ components: [{ id: "c", name: "C", type: "COMPONENT", propertyDefinitions: defs, referencedPropKeys: [] }] })).length, 0);
});

test("variant-matrix-complete: fires on missing combinations; skips when truncated", () => {
  const defs = { "Size#1:0": { type: "VARIANT", variantOptions: ["sm", "lg"] }, "Tone#2:0": { type: "VARIANT", variantOptions: ["a", "b"] } }; // expected 4
  const set = (over) => ({ id: "s", name: "Button", type: "COMPONENT_SET", propertyDefinitions: defs, ...over });
  // 3 of 4 present -> fires
  assert.ok(has(componentDetectors["variant-matrix-complete"](base({ components: [set({ variantTuples: [{}, {}, {}] })] })), "variant-matrix-complete"));
  // all 4 present -> silent
  assert.equal(componentDetectors["variant-matrix-complete"](base({ components: [set({ variantTuples: [{}, {}, {}, {}] })] })).length, 0);
  // truncated tuple list -> skip (can't prove incompleteness)
  assert.equal(componentDetectors["variant-matrix-complete"](base({ components: [set({ variantTuples: [{}, {}], variantTuplesTruncated: true })] })).length, 0);
  // no tuples gathered (old plugin) -> silent
  assert.equal(componentDetectors["variant-matrix-complete"](base({ components: [set({})] })).length, 0);
});
