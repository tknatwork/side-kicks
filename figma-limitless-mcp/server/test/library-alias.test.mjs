// Aliases to imported team-library variables through the lint suite.
// getLocalVariablesAsync() leaves library variables out of the snapshot, so the
// plugin's lint_run resolves every non-local id an alias (or a composed
// colour's alias side) references with getVariableByIdAsync and ships the ones
// that resolved as externalVariableIds, plus externalRefScanTruncated when its
// lookup cap cut the scan short. These pin that a library alias is a live
// reference (alias-target-resolves stays an ERROR only for a provably dangling
// one), that no other rule asserts anything about a target it can't see, and
// that an old plugin build (no externalVariableIds) keeps the old behaviour.
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
const PRIM = { id: P, name: "Primitives", defaultModeId: pm, modes: [{ modeId: pm, name: "Value" }] };
const SEM = { id: S, name: "Semantic", defaultModeId: sL, modes: [{ modeId: sL, name: "Light" }, { modeId: sD, name: "Dark" }] };
const COMP = { id: CO, name: "Component", defaultModeId: km, modes: [{ modeId: km, name: "Value" }] };

const snap = (collections, variables, extra = {}) => ({
  collections, variables, styles: [], components: [],
  meta: { pageCount: 1, scannedAllPages: true }, ...extra,
});

// Library variables the file consumes: they resolve, but aren't local.
const LIB = ["lib_gray900", "lib_white", "lib_blue500", "lib_op40"];
const NEW_PLUGIN = { externalVariableIds: LIB, externalRefScanTruncated: false };
// The lookup cap was hit before any id was checked.
const TRUNCATED = { externalVariableIds: [], externalRefScanTruncated: true };

const prims = () => [
  mkVar("p_g900", "gray/900", P, { [pm]: C(0.08, 0.08, 0.08) }, { hidden: true }),
  mkVar("p_white", "gray/0", P, { [pm]: C(1, 1, 1) }, { hidden: true }),
];

const run = (s, opts = {}) => runLint(s, { severity: "all", ...opts });
const hits = (rep, id) => rep.findings.filter((f) => f.rule_id === id);
const forVar = (rep, id, v) => rep.findings.some((f) => f.rule_id === id && f.variableId === v);
const noFailures = (rep) =>
  assert.deepEqual(rep.rule_failures, [], `rule_failures: ${JSON.stringify(rep.rule_failures)}`);
const listFindings = (rep) =>
  rep.findings.map((f) => `  ${f.severity} ${f.rule_id}: ${f.message}`).join("\n");

// --- alias-target-resolves ---------------------------------------------------

test("a plain alias to a resolved library variable is not dangling", () => {
  const rep = run(snap([PRIM, SEM], [
    ...prims(),
    mkVar("s_bg", "background/default", S, { [sL]: A("lib_white"), [sD]: A("lib_gray900") }, { scopes: ["FRAME_FILL"] }),
  ], NEW_PLUGIN));
  assert.deepEqual(hits(rep, "alias-target-resolves"), []);
  noFailures(rep);
});

test("composed-colour sides that are library variables are not dangling, in both nested forms", () => {
  const rep = run(snap([PRIM, SEM], [
    ...prims(),
    mkVar("s_scrim", "overlay/scrim", S, {
      [sL]: K(A("lib_gray900"), A("lib_op40")), [sD]: K(RAW("lib_white"), RAW("lib_op40")),
    }, { scopes: ["FRAME_FILL"] }),
    // one library side, one local or raw side
    mkVar("s_veil", "overlay/veil", S, {
      [sL]: K(A("p_g900"), A("lib_op40")), [sD]: K(A("lib_white"), 40),
    }, { scopes: ["FRAME_FILL"] }),
  ], NEW_PLUGIN));
  assert.deepEqual(hits(rep, "alias-target-resolves"), []);
  noFailures(rep);
});

test("a truly dangling reference is still an ERROR next to library ones", () => {
  const rep = run(snap([PRIM, SEM], [
    ...prims(),
    mkVar("s_bg", "background/default", S, { [sL]: A("lib_white"), [sD]: A("gone") }, { scopes: ["FRAME_FILL"] }),
    mkVar("s_scrim", "overlay/scrim", S, {
      [sL]: K(A("lib_gray900"), A("gone_op")), [sD]: K(A("lib_white"), 40),
    }, { scopes: ["FRAME_FILL"] }),
  ], NEW_PLUGIN));
  const errs = hits(rep, "alias-target-resolves");
  assert.deepEqual(errs.map((f) => f.variableId).sort(), ["s_bg", "s_scrim"]);
  for (const f of errs) assert.equal(f.severity, "error");
  const msg = Object.fromEntries(errs.map((f) => [f.variableId, f.message]));
  assert.equal(msg.s_bg, "'background/default' has a dangling alias in mode sDark (target gone not found).");
  assert.equal(msg.s_scrim, "'overlay/scrim' has a dangling composed-color reference in mode sLight (target gone_op not found).");
  noFailures(rep);
});

test("a truncated library scan leaves an unchecked non-local id silent", () => {
  const rep = run(snap([PRIM, SEM], [
    ...prims(),
    mkVar("s_bg", "background/default", S, { [sL]: A("lib_white"), [sD]: A("unchecked_1") }, { scopes: ["FRAME_FILL"] }),
    mkVar("s_scrim", "overlay/scrim", S, { [sL]: K(A("unchecked_2"), 40), [sD]: K(A("p_g900"), 40) }, { scopes: ["FRAME_FILL"] }),
  ], { externalVariableIds: ["lib_white"], externalRefScanTruncated: true }));
  assert.deepEqual(hits(rep, "alias-target-resolves"), []);
  noFailures(rep);
});

test("an old plugin build (no externalVariableIds) keeps the old behaviour", () => {
  const rep = run(snap([PRIM, SEM], [
    ...prims(),
    mkVar("s_bg", "background/default", S, { [sL]: A("lib_white"), [sD]: A("p_g900") }, { scopes: ["FRAME_FILL"] }),
    mkVar("s_scrim", "overlay/scrim", S, { [sL]: K(A("lib_gray900"), 40), [sD]: K(A("p_g900"), 40) }, { scopes: ["FRAME_FILL"] }),
  ]));
  const errs = hits(rep, "alias-target-resolves");
  const msg = Object.fromEntries(errs.map((f) => [f.variableId, f.message]));
  assert.deepEqual(Object.keys(msg).sort(), ["s_bg", "s_scrim"]);
  assert.equal(msg.s_bg, "'background/default' has a dangling alias in mode sLight (target lib_white not found).");
  assert.equal(msg.s_scrim, "'overlay/scrim' has a dangling composed-color reference in mode sLight (target lib_gray900 not found).");
  for (const f of errs) assert.equal(f.severity, "error");
});

// --- the other rules that look up alias targets ------------------------------

test("a file whose tiers alias library variables lints clean", () => {
  // The primitives live in the library: a local Semantic over them, a local
  // Component over the Semantic, a node bound straight to a library variable.
  const vars = [
    mkVar("s_bg", "background/default", S, { [sL]: A("lib_white"), [sD]: A("lib_gray900") }, { scopes: ["ALL_FILLS"] }),
    mkVar("s_fg", "foreground/default", S, { [sL]: A("lib_gray900"), [sD]: A("lib_white") }, { scopes: ["TEXT_FILL"] }),
    mkVar("s_accent", "accent/default", S, { [sL]: A("lib_blue500"), [sD]: A("lib_blue500") }, { scopes: ["ALL_FILLS"] }),
    mkVar("s_scrim", "overlay/scrim", S, {
      [sL]: K(A("lib_gray900"), A("lib_op40")), [sD]: K(A("lib_gray900"), A("lib_op40")),
    }, { scopes: ["ALL_FILLS"] }),
    mkVar("k_btn_bg", "button/background", CO, { [km]: A("s_accent") }, { scopes: ["ALL_FILLS"] }),
    mkVar("k_btn_fg", "button/foreground", CO, { [km]: A("s_bg") }, { scopes: ["ALL_FILLS"] }),
  ];
  const extra = {
    nodeBindings: [
      { nodeId: "n1", nodeName: "Card", nodeType: "FRAME", field: "fills", variableId: "lib_white" },
      { nodeId: "n2", nodeName: "Button", nodeType: "FRAME", field: "fills", variableId: "k_btn_bg" },
      { nodeId: "n3", nodeName: "Button", nodeType: "FRAME", field: "fills", variableId: "k_btn_bg" },
      { nodeId: "n4", nodeName: "Label", nodeType: "FRAME", field: "fills", variableId: "k_btn_fg" },
      { nodeId: "n5", nodeName: "Label", nodeType: "FRAME", field: "fills", variableId: "k_btn_fg" },
    ],
    bindingsTruncated: false,
  };
  for (const scan of [NEW_PLUGIN, TRUNCATED]) {
    const rep = run(snap([SEM, COMP], vars, { ...extra, ...scan }));
    assert.equal(rep.findings.length, 0, `${JSON.stringify(scan)}:\n${listFindings(rep)}`);
    noFailures(rep);
  }
  // The same file from an old plugin build: the old false findings stand.
  const old = run(snap([SEM, COMP], vars, extra));
  assert.equal(hits(old, "alias-target-resolves").length, 4);
  assert.equal(hits(old, "three-tier-collections-exist").length, 1);
});

test("a collection whose values alias the library isn't tiered as primitive", () => {
  // No tier word in the name, so the classifier reads the references: they
  // leave the file, so the tier is unknown and the tier rules stay silent.
  const theme = { id: "cTheme", name: "Theme", defaultModeId: "L", modes: [{ modeId: "L", name: "Light" }, { modeId: "D", name: "Dark" }] };
  const vars = [
    mkVar("t_bg", "surface/default", "cTheme", { L: A("lib_white"), D: A("lib_gray900") }),
    mkVar("t_blue", "blue/500", "cTheme", { L: A("lib_blue500"), D: A("lib_blue500") }),
  ];
  const extra = {
    nodeBindings: [{ nodeId: "n1", nodeName: "Card", nodeType: "FRAME", field: "fills", variableId: "t_bg" }],
    bindingsTruncated: false,
  };
  const TIER_RULES = [
    "primitive-raw-values-only",
    "primitive-hidden-from-publishing",
    "primitive-component-single-mode",
    "no-node-binds-primitive",
    "three-tier-collections-exist",
    "hue-ramp-words-primitives-only",
  ];
  for (const scan of [NEW_PLUGIN, TRUNCATED]) {
    const rep = run(snap([theme], vars, { ...extra, ...scan }));
    for (const id of TIER_RULES) assert.deepEqual(hits(rep, id), [], `${id} ${JSON.stringify(scan)}`);
    noFailures(rep);
  }
  // An old plugin build still tiers it primitive, exactly as before.
  const old = run(snap([theme], vars, extra));
  assert.equal(forVar(old, "primitive-raw-values-only", "t_bg"), true);
  assert.equal(forVar(old, "primitive-hidden-from-publishing", "t_bg"), true);
});

test("tier rules don't guess the tier of a collection that also aliases the library", () => {
  // An unnamed colour collection with raw values, an alpha variant and one
  // library alias: its tier is unknown. The semantic's chain through the
  // alpha variant is 2 hops (the variant adds none, as a primitive's would),
  // and a component aliasing it proves no skipped tier.
  const colour = { id: "cColour", name: "Colour", defaultModeId: "m", modes: [{ modeId: "m", name: "Value" }] };
  const rep = run(snap([colour, SEM, COMP], [
    mkVar("x_ink", "gray/900", "cColour", { m: C(0.08, 0.08, 0.08) }, { hidden: true }),
    mkVar("x_ink_a40", "gray/900-a40", "cColour", { m: K(A("x_ink"), 40) }, { hidden: true }),
    mkVar("x_brand", "brand/500", "cColour", { m: A("lib_blue500") }, { hidden: true }),
    mkVar("s_scrim", "overlay/scrim", S, { [sL]: A("x_ink_a40"), [sD]: A("x_ink_a40") }, { scopes: ["FRAME_FILL"] }),
    mkVar("k_scrim", "dialog/scrim", CO, { [km]: A("s_scrim") }, { scopes: ["FRAME_FILL"] }),
    mkVar("k_ink", "dialog/ink", CO, { [km]: A("x_ink") }, { scopes: ["FRAME_FILL"] }),
  ], NEW_PLUGIN));
  for (const id of [
    "alias-graph-acyclic-max-depth-2",
    "component-token-must-alias-semantic",
    "alias-one-tier-down",
    "primitive-raw-values-only",
    "three-tier-collections-exist",
  ]) {
    assert.deepEqual(hits(rep, id), [], id);
  }
  noFailures(rep);
});

test("a collection over local primitives and the library isn't assumed semantic", () => {
  // Its local targets are primitive, but a library target may be semantic
  // (which would make it component): the semantic-only rules skip it.
  const roles = { id: "cRoles", name: "Roles", defaultModeId: "D", modes: [{ modeId: "D", name: "Dark" }, { modeId: "L", name: "Light" }] };
  const vars = [
    ...prims(),
    mkVar("r_bg", "background/default", "cRoles", { D: A("p_g900"), L: A("p_white") }, { scopes: ["FRAME_FILL"] }),
    mkVar("r_accent", "accent/default", "cRoles", { D: A("lib_blue500"), L: A("lib_blue500") }, { scopes: ["FRAME_FILL"] }),
  ];
  const rep = run(snap([PRIM, roles], vars, NEW_PLUGIN));
  assert.deepEqual(hits(rep, "semantic-default-mode-is-base"), []);
  noFailures(rep);
  // An old plugin build sees only the local targets and tiers it semantic.
  const old = run(snap([PRIM, roles], vars));
  assert.equal(hits(old, "semantic-default-mode-is-base").length, 1);
});

test("component and cross-tier checks stay silent on a library target", () => {
  const rep = run(snap([PRIM, SEM, COMP], [
    ...prims(),
    mkVar("s_bg", "background/default", S, { [sL]: A("p_white"), [sD]: A("p_g900") }, { scopes: ["FRAME_FILL"] }),
    mkVar("k_card", "card/background", CO, { [km]: A("lib_white") }, { scopes: ["FRAME_FILL"] }),
    mkVar("k_scrim", "dialog/scrim", CO, { [km]: K(A("lib_gray900"), A("lib_op40")) }, { scopes: ["FRAME_FILL"] }),
    // a semantic over a library variable, and a component over that semantic
    mkVar("s_accent", "accent/default", S, { [sL]: A("lib_blue500"), [sD]: A("lib_blue500") }, { scopes: ["FRAME_FILL"] }),
    mkVar("k_btn", "button/background", CO, { [km]: A("s_accent") }, { scopes: ["FRAME_FILL"] }),
  ], NEW_PLUGIN));
  for (const id of [
    "component-token-must-alias-semantic",
    "alias-one-tier-down",
    "alias-graph-acyclic-max-depth-2",
    "alias-target-resolves",
  ]) {
    assert.deepEqual(hits(rep, id), [], id);
  }
  noFailures(rep);
});

test("contrast rules don't resolve through a library variable", () => {
  const rep = run(snap([PRIM, SEM], [
    ...prims(),
    mkVar("s_surface", "surface/primary", S, { [sL]: A("p_white"), [sD]: A("p_white") }, { scopes: ["FRAME_FILL"] }),
    mkVar("s_fg", "foreground/on-primary", S, { [sL]: A("lib_white"), [sD]: K(A("lib_white"), 100) }, { scopes: ["TEXT_FILL"] }),
    mkVar("s_border", "border/on-primary", S, { [sL]: K(A("p_g900"), A("lib_op40")), [sD]: A("lib_white") }, { scopes: ["STROKE_COLOR"] }),
  ], NEW_PLUGIN));
  for (const id of ["fg-bg-pair-contrast", "border-icon-graphical-contrast", "contrast-fallback-export-sampling"]) {
    assert.deepEqual(hits(rep, id), [], id);
  }
  noFailures(rep);
});

test("multi-brand discipline doesn't guess whether a library variable is the brand layer", () => {
  const vars = [
    ...prims(),
    mkVar("s_brand", "brand/primary", S, { [sL]: A("p_g900"), [sD]: A("p_white") }, { scopes: ["FRAME_FILL"] }),
    mkVar("s_lib", "accent/default", S, { [sL]: A("lib_blue500"), [sD]: K(A("lib_blue500"), 80) }, { scopes: ["FRAME_FILL"] }),
    mkVar("s_direct", "accent/pressed", S, { [sL]: A("p_g900"), [sD]: A("p_white") }, { scopes: ["FRAME_FILL"] }),
  ];
  const opts = {
    enable: ["multi-brand-alias-discipline"],
    config: { "multi-brand-alias-discipline": { brandPrefix: "brand", roles: ["accent"] } },
  };
  const rep = run(snap([PRIM, SEM], vars, NEW_PLUGIN), opts);
  assert.deepEqual(hits(rep, "multi-brand-alias-discipline").map((f) => f.variableId), ["s_direct"]);
  noFailures(rep);
  // An old plugin build reports it, as before.
  const old = run(snap([PRIM, SEM], vars), opts);
  assert.deepEqual(hits(old, "multi-brand-alias-discipline").map((f) => f.variableId).sort(), ["s_direct", "s_lib"]);
});
