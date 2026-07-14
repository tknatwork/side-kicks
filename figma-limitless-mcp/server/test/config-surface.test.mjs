// Config-surface tests: the opt-in / parameterized rule mechanism on runLint.
// Proves backward-compat (opt-in rules OFF by default), enable/disable/only
// selection, per-rule config (defaults + overrides), config validation
// (bad/missing config -> config_errors, never a crash), report surfacing of
// available_optin, and that each config-driven detector fires when configured.
// Runs against compiled dist/ (pnpm test builds first).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runLint, ruleInventory, DETECTORS } from "../dist/lint/index.js";

const C = (r, g, b) => ({ r, g, b, a: 1 });
const mkVar = (id, name, coll, valuesByMode, opts = {}) => ({
  id, name, collectionId: coll, resolvedType: opts.resolvedType ?? "COLOR",
  scopes: opts.scopes ?? ["ALL_FILLS"],
  hiddenFromPublishing: opts.hidden ?? false,
  codeSyntax: opts.codeSyntax ?? {}, description: "",
  valuesByMode,
});

// Primitives (one un-padded numeric step), semantics (a role outside a typical
// allowlist + a token whose WEB codeSyntax is unrelated to its name), and a
// 50-cell variant set.
const snap = () => ({
  collections: [
    { id: "P", name: "Primitives", defaultModeId: "m", modes: [{ modeId: "m", name: "M" }] },
    { id: "S", name: "Semantic", defaultModeId: "m", modes: [{ modeId: "m", name: "M" }] },
  ],
  variables: [
    mkVar("p_g50", "gray/50", "P", { m: C(0.9, 0.9, 0.9) }, { hidden: true }),   // "50" not padded to 3
    mkVar("p_g500", "gray/500", "P", { m: C(0.5, 0.5, 0.5) }, { hidden: true }), // "500" ok
    mkVar("s_bg", "background/default", "S", { m: { alias: "p_g50" } }),
    mkVar("s_weird", "zzz/default", "S", { m: { alias: "p_g500" } }),            // role 'zzz'
    mkVar("s_web", "spacing/md", "S", { m: { alias: "p_g500" } }, { codeSyntax: { WEB: "colors.brand.primary" } }),
  ],
  styles: [],
  components: [
    { id: "btn", name: "Button", type: "COMPONENT_SET", propertyDefinitions: {
      Size: { type: "VARIANT", variantOptions: ["a", "b", "c", "d", "e"] },
      Tone: { type: "VARIANT", variantOptions: ["a", "b", "c", "d", "e"] },
      State: { type: "VARIANT", variantOptions: ["on", "off"] },
    } }, // 5*5*2 = 50
  ],
  nodeBindings: [],
  bindingsTruncated: false,
  meta: { pageCount: 1, scannedAllPages: true },
});

const has = (rep, id) => rep.findings.some((f) => f.rule_id === id);
const forVar = (rep, id, v) => rep.findings.some((f) => f.rule_id === id && f.variableId === v);
const OPT_IN = ["semantic-role-allowlist", "top-segment-in-tier-vocabulary", "numeric-scale-zero-padded", "codesyntax-web-matches-name"];

test("backward-compat: opt-in rules never run in a default lint", () => {
  const rep = runLint(snap());
  for (const id of OPT_IN) assert.ok(!has(rep, id), `${id} must be off by default`);
  // variant-count-ceiling-60 IS default-on; 50 < 60 default -> no finding.
  assert.ok(!has(rep, "variant-count-ceiling-60"));
});

test("available_optin surfaces every implemented opt-in rule with an enable hint", () => {
  const rep = runLint(snap());
  const ids = new Set(rep.available_optin.map((o) => o.rule_id));
  for (const id of OPT_IN) assert.ok(ids.has(id), `available_optin should list ${id}`);
  assert.equal(rep.summary.rules_opt_in_available, rep.available_optin.length);
  // config-required rules carry a config placeholder in the enable hint.
  const roleRule = rep.available_optin.find((o) => o.rule_id === "semantic-role-allowlist");
  assert.ok(roleRule.enable_hint.args.enable.includes("semantic-role-allowlist"));
  assert.ok(roleRule.enable_hint.args.config, "required-config rule must hint config");
  assert.ok(typeof roleRule.config_shape === "string");
});

test("enable turns an opt-in rule on; config default applies", () => {
  const rep = runLint(snap(), { enable: ["numeric-scale-zero-padded"] });
  assert.ok(forVar(rep, "numeric-scale-zero-padded", "p_g50")); // '50' < width 3
  assert.ok(!forVar(rep, "numeric-scale-zero-padded", "p_g500")); // '500' ok
});

test("only naming an opt-in rule runs it without enable", () => {
  const rep = runLint(snap(), { only: ["numeric-scale-zero-padded"] });
  assert.ok(has(rep, "numeric-scale-zero-padded"));
  assert.equal(rep.summary.rules_run, 1);
});

test("config parameterizes: width override changes behavior", () => {
  const strict = runLint(snap(), { enable: ["numeric-scale-zero-padded"], config: { "numeric-scale-zero-padded": { width: 2 } } });
  assert.ok(!has(strict, "numeric-scale-zero-padded")); // '50' length 2, not < 2
});

test("config parameterizes a default-on rule: variant ceiling", () => {
  const strict = runLint(snap(), { config: { "variant-count-ceiling-60": { ceiling: 40 } } });
  assert.ok(strict.findings.some((f) => f.rule_id === "variant-count-ceiling-60" && f.nodeId === "btn"));
});

test("required-config rule: enable without config -> config_errors, no crash, no finding", () => {
  const rep = runLint(snap(), { enable: ["semantic-role-allowlist"] });
  assert.ok(!has(rep, "semantic-role-allowlist"));
  assert.ok(rep.config_errors.some((e) => e.rule_id === "semantic-role-allowlist"));
});

test("semantic-role-allowlist fires on out-of-allowlist roles when configured", () => {
  const rep = runLint(snap(), { enable: ["semantic-role-allowlist"], config: { "semantic-role-allowlist": { allowlist: ["background", "spacing"] } } });
  assert.ok(forVar(rep, "semantic-role-allowlist", "s_weird")); // 'zzz' not allowed
  assert.ok(!forVar(rep, "semantic-role-allowlist", "s_bg"));   // 'background' allowed
  assert.ok(!forVar(rep, "semantic-role-allowlist", "s_web"));  // 'spacing' allowed
});

test("top-segment-in-tier-vocabulary fires per-tier when configured", () => {
  const rep = runLint(snap(), { enable: ["top-segment-in-tier-vocabulary"], config: { "top-segment-in-tier-vocabulary": { vocab: { semantic: ["background"] } } } });
  assert.ok(forVar(rep, "top-segment-in-tier-vocabulary", "s_weird")); // zzz
  assert.ok(forVar(rep, "top-segment-in-tier-vocabulary", "s_web"));   // spacing
  assert.ok(!forVar(rep, "top-segment-in-tier-vocabulary", "s_bg"));   // background allowed
  // primitives have no vocab list -> untouched
  assert.ok(!forVar(rep, "top-segment-in-tier-vocabulary", "p_g50"));
});

test("codesyntax-web-matches-name flags unrelated WEB codeSyntax when enabled", () => {
  const rep = runLint(snap(), { enable: ["codesyntax-web-matches-name"] });
  assert.ok(forVar(rep, "codesyntax-web-matches-name", "s_web")); // 'spacing/md' vs 'colors.brand.primary' -> 0 shared
});

test("disable turns off a default-on rule", () => {
  const withRule = runLint(snap());
  assert.ok(has(withRule, "primitive-hidden-from-publishing") === false); // primitives are hidden here -> no finding
  // make a primitive published so the rule fires, then disable it
  const s = snap();
  s.variables[0].hiddenFromPublishing = false;
  assert.ok(has(runLint(s), "primitive-hidden-from-publishing"));
  assert.ok(!has(runLint(s, { disable: ["primitive-hidden-from-publishing"] }), "primitive-hidden-from-publishing"));
});

test("invalid config -> config_errors, rule skipped, lint still completes", () => {
  const rep = runLint(snap(), { config: { "variant-count-ceiling-60": { ceiling: -5 } } });
  assert.ok(rep.config_errors.some((e) => e.rule_id === "variant-count-ceiling-60"));
  assert.ok(!has(rep, "variant-count-ceiling-60")); // skipped, not run with a bad ceiling
  assert.ok(Array.isArray(rep.findings)); // lint completed normally
});

test("ruleInventory now reports defaultOn per rule", () => {
  const inv = ruleInventory();
  assert.equal(inv.find((r) => r.id === "numeric-scale-zero-padded").defaultOn, false);
  assert.equal(inv.find((r) => r.id === "alias-target-resolves").defaultOn, true);
});

test("rule_failures: a throwing detector is isolated and NOT counted as passed", () => {
  const orig = DETECTORS["duplicate-primitive-value"];
  DETECTORS["duplicate-primitive-value"] = () => {
    throw new Error("boom");
  };
  try {
    const rep = runLint(snap());
    assert.ok(
      rep.rule_failures.some((e) => e.rule_id === "duplicate-primitive-value" && /boom/.test(e.message)),
      "the throw must surface under rule_failures"
    );
    // Invariant: passed + rules-with-findings + failures == rules_run (the
    // crashed rule must not be double-counted as passed).
    const withFindings = new Set(rep.findings.map((f) => f.rule_id)).size;
    assert.equal(rep.summary.passed + withFindings + rep.rule_failures.length, rep.summary.rules_run);
  } finally {
    DETECTORS["duplicate-primitive-value"] = orig;
  }
});

test("codesyntax-web-matches-name does NOT flag camelCase codeSyntax derived from the name", () => {
  const s = snap();
  s.variables.push(
    mkVar("s_cc", "button/background", "S", { m: { alias: "p_g500" } }, { codeSyntax: { WEB: "buttonBackground" } })
  );
  const rep = runLint(s, { enable: ["codesyntax-web-matches-name"] });
  assert.ok(!forVar(rep, "codesyntax-web-matches-name", "s_cc")); // buttonBackground -> {button, background}
  assert.ok(forVar(rep, "codesyntax-web-matches-name", "s_web")); // still flags the genuinely-unrelated one
});
