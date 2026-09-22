// Composed colour variables (Figma Plugin API Update 139) and the COLOR_OPACITY
// scope through the lint suite. A composed COLOR value is { color, opacity }:
// the colour is {r,g,b,a?} or an alias, the opacity a 0-100 percentage or an
// alias to a FLOAT, and at least one side is an alias. The plugin's lint_run
// sends nested aliases as { alias: id }; an older plugin build passes Figma's
// raw { type: 'VARIABLE_ALIAS', id } through, and both must be understood.
// These pin that composed references count as alias edges (tiering, usage,
// dangling detection, the graph rules) without the linter treating a composed
// colour as a plain alias or as a raw colour.
// Runs against compiled dist/ (pnpm test builds first).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runLint } from "../dist/lint/index.js";

const C = (r, g, b, a = 1) => ({ r, g, b, a });
const A = (id) => ({ alias: id });
const RAW = (id) => ({ type: "VARIABLE_ALIAS", id }); // an older plugin's pass-through form
const K = (color, opacity) => ({ color, opacity });

const mkVar = (id, name, coll, valuesByMode, opts = {}) => ({
  id, name, collectionId: coll, resolvedType: opts.type ?? "COLOR",
  scopes: opts.scopes ?? ["ALL_SCOPES"], hiddenFromPublishing: opts.hidden ?? false,
  codeSyntax: {}, description: "", valuesByMode,
});

const P = "cPrim", S = "cSem", CO = "cComp";
const pm = "pm", sL = "sLight", sD = "sDark", km = "km";
const TIERS = [
  { id: P, name: "Primitives", defaultModeId: pm, modes: [{ modeId: pm, name: "Value" }] },
  { id: S, name: "Semantic", defaultModeId: sL, modes: [{ modeId: sL, name: "Light" }, { modeId: sD, name: "Dark" }] },
  { id: CO, name: "Component", defaultModeId: km, modes: [{ modeId: km, name: "Value" }] },
];
const snap = (variables, extra = {}) => ({
  collections: TIERS, variables, styles: [], components: [],
  meta: { pageCount: 1, scannedAllPages: true }, ...extra,
});

// Shared primitives: two colours and a COLOR_OPACITY opacity step.
const prims = () => [
  mkVar("p_g900", "gray/900", P, { [pm]: C(0.08, 0.08, 0.08) }, { hidden: true }),
  mkVar("p_white", "gray/0", P, { [pm]: C(1, 1, 1) }, { hidden: true }),
  mkVar("p_op40", "opacity/40", P, { [pm]: 40 }, { type: "FLOAT", scopes: ["COLOR_OPACITY"], hidden: true }),
];

const run = (s, opts = {}) => runLint(s, { severity: "all", ...opts });
const hits = (rep, id) => rep.findings.filter((f) => f.rule_id === id);
const forVar = (rep, id, v) => rep.findings.some((f) => f.rule_id === id && f.variableId === v);
const noFailures = (rep) =>
  assert.deepEqual(rep.rule_failures, [], `rule_failures: ${JSON.stringify(rep.rule_failures)}`);

// --- scopes ------------------------------------------------------------------

test("COLOR_OPACITY and TEXT_CONTENT are legal on FLOAT", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("p_count", "count/items", P, { [pm]: 3 }, { type: "FLOAT", scopes: ["TEXT_CONTENT"], hidden: true }),
  ]));
  assert.deepEqual(hits(rep, "scope-legal-for-resolved-type"), []);
  // A pure-content FLOAT is exempt from the token warn, like a STRING.
  assert.equal(forVar(rep, "no-text-content-scope-on-token", "p_count"), false);
});

test("illegal scopes still fire the ERROR rule; a mixed TEXT_CONTENT FLOAT still warns", () => {
  const rep = run(snap([
    mkVar("p_bad_color", "gray/50", P, { [pm]: C(0.9, 0.9, 0.9) }, { scopes: ["COLOR_OPACITY"], hidden: true }),
    mkVar("p_bad_float", "number/4", P, { [pm]: 4 }, { type: "FLOAT", scopes: ["TEXT_FILL"], hidden: true }),
    mkVar("p_mixed", "number/8", P, { [pm]: 8 }, { type: "FLOAT", scopes: ["TEXT_CONTENT", "GAP"], hidden: true }),
  ]));
  const errs = hits(rep, "scope-legal-for-resolved-type");
  assert.deepEqual(errs.map((f) => f.variableId).sort(), ["p_bad_color", "p_bad_float"]);
  for (const f of errs) assert.equal(f.severity, "error");
  assert.equal(forVar(rep, "no-text-content-scope-on-token", "p_mixed"), true);
});

test("an opacity/* role token may be scoped OPACITY or COLOR_OPACITY", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("s_op_overlay", "opacity/overlay", S, { [sL]: A("p_op40"), [sD]: A("p_op40") }, { type: "FLOAT", scopes: ["COLOR_OPACITY"] }),
    mkVar("s_op_disabled", "opacity/disabled", S, { [sL]: A("p_op40"), [sD]: A("p_op40") }, { type: "FLOAT", scopes: ["OPACITY"] }),
    mkVar("s_op_wrong", "opacity/hover", S, { [sL]: A("p_op40"), [sD]: A("p_op40") }, { type: "FLOAT", scopes: ["GAP"] }),
  ]));
  const ids = hits(rep, "dimension-role-scope-match").map((f) => f.variableId);
  assert.deepEqual(ids, ["s_op_wrong"]);
});

// --- usage and tiering -------------------------------------------------------

test("variables referenced only through a composed colour are not orphans", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("p_unused", "gray/500", P, { [pm]: C(0.5, 0.5, 0.5) }, { hidden: true }),
    // colour side (snapshot form) + opacity side (older plugin's raw form)
    mkVar("s_scrim", "overlay/scrim", S, {
      [sL]: K(A("p_g900"), RAW("p_op40")), [sD]: K(A("p_white"), 60),
    }, { scopes: ["FRAME_FILL"] }),
  ], { nodeBindings: [], bindingsTruncated: false }));
  const orphans = hits(rep, "unused-variable-orphan").map((f) => f.variableId);
  assert.deepEqual(orphans, ["p_unused"], "only the genuinely unused primitive is an orphan");
});

test("a collection of composed colours over another collection is classified semantic", () => {
  // No tier words in either name, so the classifier must read the references.
  const rep = run({
    collections: [
      { id: "cCol", name: "Colours", defaultModeId: "m", modes: [{ modeId: "m", name: "Value" }] },
      { id: "cRoles", name: "Roles", defaultModeId: "m", modes: [{ modeId: "m", name: "Value" }] },
    ],
    variables: [
      mkVar("c_ink", "gray/900", "cCol", { m: C(0.08, 0.08, 0.08) }, { hidden: true }),
      mkVar("c_op", "opacity/40", "cCol", { m: 40 }, { type: "FLOAT", scopes: ["COLOR_OPACITY"], hidden: true }),
      mkVar("r_scrim", "overlay/scrim", "cRoles", { m: K(A("c_ink"), 60) }, { scopes: ["FRAME_FILL"] }),
      mkVar("r_veil", "overlay/veil", "cRoles", { m: K(RAW("c_ink"), RAW("c_op")) }, { scopes: ["FRAME_FILL"] }),
    ],
    styles: [], components: [], meta: { pageCount: 1, scannedAllPages: true },
  });
  assert.deepEqual(hits(rep, "three-tier-collections-exist"), []);
  assert.equal(forVar(rep, "primitive-hidden-from-publishing", "r_scrim"), false);
  assert.equal(forVar(rep, "primitive-hidden-from-publishing", "r_veil"), false);
});

// --- alias-target-resolves ---------------------------------------------------

test("a dangling reference inside a composed colour is an ERROR, in both nested forms", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("s_a", "overlay/a", S, { [sL]: K(A("missing_1"), 50), [sD]: K(A("p_g900"), 50) }, { scopes: ["FRAME_FILL"] }),
    mkVar("s_b", "overlay/b", S, { [sL]: K(C(0, 0, 0), RAW("missing_2")), [sD]: K(C(0, 0, 0), RAW("missing_2")) }, { scopes: ["FRAME_FILL"] }),
  ]));
  const errs = hits(rep, "alias-target-resolves");
  assert.deepEqual(errs.map((f) => f.variableId).sort(), ["s_a", "s_b"]);
  for (const f of errs) {
    assert.equal(f.severity, "error");
    assert.match(f.message, /composed-color reference/);
  }
  noFailures(rep);
});

test("a plain dangling alias is reported exactly as before", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("s_bg", "background/default", S, { [sL]: A("p_white"), [sD]: A("gone") }, { scopes: ["FRAME_FILL"] }),
  ]));
  const errs = hits(rep, "alias-target-resolves");
  assert.equal(errs.length, 1);
  assert.equal(errs[0].message, "'background/default' has a dangling alias in mode sDark (target gone not found).");
});

// --- tier rules --------------------------------------------------------------

test("semantic-alias-in-every-mode treats a composed colour as an alias mode", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("s_ok", "overlay/scrim", S, { [sL]: A("p_g900"), [sD]: K(A("p_white"), 40) }, { scopes: ["FRAME_FILL"] }),
    mkVar("s_mixed", "background/raised", S, { [sL]: A("p_white"), [sD]: C(0.1, 0.1, 0.1) }, { scopes: ["FRAME_FILL"] }),
  ]));
  const ids = hits(rep, "semantic-alias-in-every-mode").map((f) => f.variableId);
  assert.deepEqual(ids, ["s_mixed"]);
});

test("component composed colours: over a semantic is fine, over a primitive skips a tier", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("s_ink", "foreground/default", S, { [sL]: A("p_g900"), [sD]: A("p_white") }, { scopes: ["TEXT_FILL"] }),
    mkVar("k_ok", "button/label-muted", CO, { [km]: K(A("s_ink"), 50) }, { scopes: ["TEXT_FILL"] }),
    mkVar("k_skip", "button/label-faint", CO, { [km]: K(A("p_g900"), 50) }, { scopes: ["TEXT_FILL"] }),
  ]));
  const comp = hits(rep, "component-token-must-alias-semantic");
  assert.deepEqual(comp.map((f) => f.variableId), ["k_skip"]);
  assert.match(comp[0].message, /composes a primitive-tier variable \('gray\/900'\)/);
  const down = hits(rep, "alias-one-tier-down").map((f) => f.variableId);
  assert.deepEqual(down, ["k_skip"]);
});

test("semantic composed colours over primitives pass alias-one-tier-down", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("s_scrim", "overlay/scrim", S, { [sL]: K(A("p_g900"), A("p_op40")), [sD]: K(A("p_white"), A("p_op40")) }, { scopes: ["FRAME_FILL"] }),
  ]));
  assert.deepEqual(hits(rep, "alias-one-tier-down"), []);
});

test("alias-graph-acyclic follows composed references", () => {
  const rep = run(snap([
    ...prims(),
    // component -> semantic (composed) -> primitive: 2 hops, fine
    mkVar("s_scrim", "overlay/scrim", S, { [sL]: K(A("p_g900"), 40), [sD]: K(A("p_white"), 40) }, { scopes: ["FRAME_FILL"] }),
    mkVar("k_scrim", "dialog/scrim", CO, { [km]: A("s_scrim") }, { scopes: ["FRAME_FILL"] }),
    // a composed colour whose colour side points back at itself
    mkVar("s_loop", "overlay/loop", S, { [sL]: K(A("s_loop"), 40), [sD]: K(A("s_loop"), 40) }, { scopes: ["FRAME_FILL"] }),
  ]));
  const acyclic = hits(rep, "alias-graph-acyclic-max-depth-2");
  assert.deepEqual(acyclic.map((f) => f.variableId), ["s_loop"]);
  assert.match(acyclic[0].message, /cyclic/);
  noFailures(rep);
});

test("multi-brand discipline follows a composed colour through the brand layer", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("s_brand", "brand/primary", S, { [sL]: A("p_g900"), [sD]: A("p_white") }, { scopes: ["FRAME_FILL"] }),
    mkVar("s_hover", "accent/hover", S, { [sL]: K(A("s_brand"), 80), [sD]: K(A("s_brand"), 80) }, { scopes: ["FRAME_FILL"] }),
    mkVar("s_direct", "accent/pressed", S, { [sL]: K(A("p_g900"), 80), [sD]: K(A("p_white"), 80) }, { scopes: ["FRAME_FILL"] }),
  ]), {
    enable: ["multi-brand-alias-discipline"],
    config: { "multi-brand-alias-discipline": { brandPrefix: "brand", roles: ["accent"] } },
  });
  const ids = hits(rep, "multi-brand-alias-discipline").map((f) => f.variableId);
  assert.deepEqual(ids, ["s_direct"]);
});

test("primitives: a same-collection composed alpha variant is allowed; identical ones are duplicates", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("p_ink_a", "gray/900-a40", P, { [pm]: K(A("p_g900"), 40) }, { hidden: true }),
    mkVar("p_ink_b", "gray/900-alpha40", P, { [pm]: K(A("p_g900"), 40) }, { hidden: true }),
  ]));
  assert.deepEqual(hits(rep, "primitive-raw-values-only"), []);
  assert.deepEqual(hits(rep, "duplicate-primitive-value").map((f) => f.variableId), ["p_ink_b"]);
});

// --- a11y --------------------------------------------------------------------

const a11ySnap = (fgValue) => snap([
  ...prims(),
  mkVar("p_g200", "gray/200", P, { [pm]: C(0.85, 0.85, 0.85) }, { hidden: true }),
  mkVar("s_surface", "surface/primary", S, { [sL]: A("p_white"), [sD]: A("p_white") }, { scopes: ["FRAME_FILL"] }),
  mkVar("s_fg", "foreground/on-primary", S, { [sL]: fgValue, [sD]: fgValue }, { scopes: ["TEXT_FILL"] }),
]);

test("an opaque composed foreground gets real contrast math", () => {
  // gray/200 on white is ~1.4:1.
  const rep = run(a11ySnap(K(A("p_g200"), 100)));
  assert.equal(forVar(rep, "fg-bg-pair-contrast", "s_fg"), true);
  assert.equal(forVar(rep, "contrast-fallback-export-sampling", "s_fg"), false);
  noFailures(rep);
});

test("a translucent composed foreground is never contrast-checked as a raw colour", () => {
  for (const fg of [K(A("p_g200"), 40), K(A("p_g200"), A("p_op40")), K(C(0.85, 0.85, 0.85), 40)]) {
    const rep = run(a11ySnap(fg));
    assert.equal(forVar(rep, "fg-bg-pair-contrast", "s_fg"), false, JSON.stringify(fg));
    const info = hits(rep, "contrast-fallback-export-sampling").filter((f) => f.variableId === "s_fg");
    assert.equal(info.length, 1, JSON.stringify(fg));
    assert.equal(info[0].severity, "info");
    assert.match(info[0].message, /alpha 0\.40/);
    noFailures(rep);
  }
});

test("malformed composed values never crash a detector", () => {
  const rep = run(snap([
    ...prims(),
    mkVar("s_junk", "foreground/on-junk", S, { [sL]: K(null, "x"), [sD]: K({}, {}) }, { scopes: ["TEXT_FILL"] }),
    mkVar("s_surface", "surface/junk", S, { [sL]: K(RAW(42), null), [sD]: A("p_white") }, { scopes: ["FRAME_FILL"] }),
  ], { nodeBindings: [], bindingsTruncated: false }));
  noFailures(rep);
});
