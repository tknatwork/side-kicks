// Dirty-fixture tests: the true-positive complement to the golden fixture.
// The golden fixture proves the suite stays SILENT on a clean DS; these prove
// it actually FIRES on real violations — including that the objectively-broken
// ERROR rules surface as severity:error (so the build gate genuinely blocks) —
// and that the new detectors don't false-positive on their control cases.
// Runs against compiled dist/ (pnpm test builds first).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runLint } from "../dist/lint/index.js";
import { tokenDetectors } from "../dist/lint/detectors/tokens.js";
import { scopeDetectors } from "../dist/lint/detectors/scopes.js";
import { namingDetectors } from "../dist/lint/detectors/naming.js";
import { componentDetectors } from "../dist/lint/detectors/components.js";

const C = (r, g, b) => ({ r, g, b, a: 1 });
const A = (id) => ({ alias: id });
const mkVar = (id, name, coll, valuesByMode, scopes = [], hidden = false) => ({
  id, name, collectionId: coll, resolvedType: "COLOR",
  scopes, hiddenFromPublishing: hidden, codeSyntax: {}, description: "",
  valuesByMode,
});
const base = (variables, extra = {}) => ({
  collections: [
    { id: "P", name: "Primitives", defaultModeId: "m", modes: [{ modeId: "m", name: "M" }] },
    { id: "S", name: "Semantic", defaultModeId: "m", modes: [{ modeId: "m", name: "M" }] },
  ],
  variables, styles: [], components: [],
  meta: { pageCount: 1, scannedAllPages: true },
  ...extra,
});

test("blocking ERROR rules fire as severity:error (the gate really blocks)", () => {
  const broken = base([
    mkVar("p_raw", "gray/900", "P", { m: C(0, 0, 0) }, ["ALL_FILLS"], true),
    mkVar("s_dangling", "foreground/default", "S", { m: A("VariableID:does-not-exist") }, ["TEXT_FILL"]),
    mkVar("s_badscope", "border/default", "S", { m: A("p_raw") }, ["ALL_STROKES"]), // not a real Figma scope
  ]);
  const report = runLint(broken, { severity: "all" });
  const errors = report.findings.filter((f) => f.severity === "error");
  const ids = new Set(errors.map((f) => f.rule_id));
  assert.ok(ids.has("alias-target-resolves"), "dangling alias must be an error");
  assert.ok(ids.has("scope-legal-for-resolved-type"), "illegal scope must be an error");
  assert.ok(report.summary.errors >= 2);
});

test("binding-on-scope-for-property fires only on out-of-scope bindings", () => {
  const snap = base(
    [
      mkVar("v_text", "foreground/default", "S", { m: C(0, 0, 0) }, ["TEXT_FILL"]),
      mkVar("v_all", "misc/any", "S", { m: C(0, 0, 0) }, ["ALL_SCOPES"]),
      mkVar("v_empty", "misc/none", "S", { m: C(0, 0, 0) }, []),
    ],
    {
      nodeBindings: [
        { nodeId: "n1", nodeName: "Rect", nodeType: "RECTANGLE", field: "strokes", variableId: "v_text" }, // FIRE: TEXT_FILL on a stroke
        { nodeId: "n2", nodeName: "Rect", nodeType: "RECTANGLE", field: "strokes", variableId: "v_all" },   // ALL_SCOPES -> ok
        { nodeId: "n3", nodeName: "Rect", nodeType: "RECTANGLE", field: "strokes", variableId: "v_empty" }, // empty scopes -> ok
        { nodeId: "n4", nodeName: "Label", nodeType: "TEXT", field: "fills", variableId: "v_text" },        // TEXT_FILL on a text fill -> ok
      ],
      bindingsTruncated: false,
    }
  );
  const f = scopeDetectors["binding-on-scope-for-property"](snap);
  assert.equal(f.length, 1);
  assert.equal(f[0].variableId, "v_text");
  assert.match(f[0].message, /strokes/);
});

test("surface-on-pair-completeness fires only once the on-<X> convention is adopted", () => {
  const adopted = base([
    mkVar("s_sp", "surface/primary", "S", { m: C(0.1, 0.3, 0.9) }, ["ALL_FILLS"]),
    mkVar("s_sa", "surface/accent", "S", { m: C(0.9, 0.2, 0.1) }, ["ALL_FILLS"]),
    mkVar("s_onp", "foreground/on-primary", "S", { m: C(1, 1, 1) }, ["TEXT_FILL"]),
  ]);
  const f = namingDetectors["surface-on-pair-completeness"](adopted);
  assert.equal(f.length, 1);
  assert.equal(f[0].variableId, "s_sa"); // accent forgotten its on-token
  assert.match(f[0].message, /on-accent/);

  // Not adopted at all (no on-<X> token) -> silent (a valid choice).
  const notAdopted = base([
    mkVar("s_sp2", "surface/primary", "S", { m: C(0.1, 0.3, 0.9) }, ["ALL_FILLS"]),
    mkVar("s_sa2", "surface/accent", "S", { m: C(0.9, 0.2, 0.1) }, ["ALL_FILLS"]),
  ]);
  assert.equal(namingDetectors["surface-on-pair-completeness"](notAdopted).length, 0);
});

test("unused-variable-orphan flags dead hidden tokens, respects the scan guard", () => {
  const vars = [
    mkVar("p_used", "gray/0", "P", { m: C(1, 1, 1) }, ["ALL_FILLS"], true),
    mkVar("p_dead", "gray/500", "P", { m: C(0.5, 0.5, 0.5) }, ["ALL_FILLS"], true),
    mkVar("p_pub", "gray/900", "P", { m: C(0, 0, 0) }, ["ALL_FILLS"], false), // published API -> exempt
    mkVar("s_uses", "background/default", "S", { m: A("p_used") }, ["ALL_FILLS"]),
  ];
  const scanned = base(vars, { nodeBindings: [], bindingsTruncated: false });
  const f = tokenDetectors["unused-variable-orphan"](scanned);
  assert.equal(f.length, 1);
  assert.equal(f[0].variableId, "p_dead");

  // Truncated scan -> can't prove unused -> silent.
  assert.equal(tokenDetectors["unused-variable-orphan"](base(vars, { nodeBindings: [], bindingsTruncated: true })).length, 0);
  // No binding scan at all -> silent.
  assert.equal(tokenDetectors["unused-variable-orphan"](base(vars)).length, 0);
});

test("variant-count-ceiling-60 fires on a matrix product over 60", () => {
  const comps = {
    components: [
      { id: "big", name: "Button", type: "COMPONENT_SET", propertyDefinitions: {
        Size: { type: "VARIANT", variantOptions: ["xs", "s", "m", "l", "xl"] },
        Tone: { type: "VARIANT", variantOptions: ["a", "b", "c", "d"] },
        State: { type: "VARIANT", variantOptions: ["w", "x", "y", "z"] },
      } }, // 5*4*4 = 80 > 60
      { id: "small", name: "Chip", type: "COMPONENT_SET", propertyDefinitions: {
        Size: { type: "VARIANT", variantOptions: ["s", "m", "l"] },
        Tone: { type: "VARIANT", variantOptions: ["a", "b", "c"] },
      } }, // 9
    ],
  };
  const snap = base([], comps);
  const f = componentDetectors["variant-count-ceiling-60"](snap);
  assert.equal(f.length, 1);
  assert.equal(f[0].nodeId, "big");
  assert.match(f[0].message, /80-cell/);
});
