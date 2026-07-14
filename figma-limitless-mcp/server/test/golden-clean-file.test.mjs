// Golden fixture: a correctly-built 3-tier design system that MUST pass the
// full detector suite with zero findings. This is the linter's anti-noise
// ratchet — proof it stays silent on a clean DS rather than crying wolf. If a
// newly-added detector fires here, either the fixture needs to encode the new
// "correct" criterion, or the rule is over-strict — both are worth catching.
// Runs against compiled dist/ (pnpm test builds first).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runLint, ruleInventory } from "../dist/lint/index.js";

const C = (r, g, b) => ({ r, g, b, a: 1 });
const A = (id) => ({ alias: id });

const P = "cPrim", S = "cSem", K = "cComp";
const pm = "pm", sL = "sLight", sD = "sDark", km = "km";

const mkVar = (id, name, coll, valuesByMode, scopes, hidden = false) => ({
  id, name, collectionId: coll, resolvedType: "COLOR",
  scopes, hiddenFromPublishing: hidden, codeSyntax: {}, description: "",
  valuesByMode,
});

const FILL = ["ALL_FILLS"];
const TEXT = ["TEXT_FILL"];
const STROKE = ["STROKE_COLOR"];

// The three tiers, each aliasing exactly one tier down. Primitives hold raw
// colour and are hidden from publishing; semantics are role-named and cover
// every mode (Light + Dark); components alias semantics. Role-named tokens
// carry the narrow scope the linter expects (fg->TEXT_FILL, border->STROKE_COLOR).
const goldenSnapshot = () => ({
  collections: [
    { id: P, name: "Primitives", defaultModeId: pm, modes: [{ modeId: pm, name: "Value" }] },
    { id: S, name: "Semantic", defaultModeId: sL, modes: [{ modeId: sL, name: "Light" }, { modeId: sD, name: "Dark" }] },
    { id: K, name: "Component", defaultModeId: km, modes: [{ modeId: km, name: "Value" }] },
  ],
  variables: [
    // primitives (raw, hidden)
    mkVar("p_white", "gray/0", P, { [pm]: C(1, 1, 1) }, FILL, true),
    mkVar("p_g100", "gray/100", P, { [pm]: C(0.96, 0.96, 0.96) }, FILL, true),
    mkVar("p_g900", "gray/900", P, { [pm]: C(0.08, 0.08, 0.08) }, FILL, true),
    mkVar("p_blue500", "blue/500", P, { [pm]: C(0.13, 0.38, 0.92) }, FILL, true),
    mkVar("p_blue600", "blue/600", P, { [pm]: C(0.10, 0.30, 0.80) }, FILL, true),
    // semantic (alias one tier down; both modes; role-scoped)
    mkVar("s_bg", "background/default", S, { [sL]: A("p_white"), [sD]: A("p_g900") }, FILL),
    mkVar("s_bg_muted", "background/muted", S, { [sL]: A("p_g100"), [sD]: A("p_g900") }, FILL),
    mkVar("s_fg", "foreground/default", S, { [sL]: A("p_g900"), [sD]: A("p_white") }, TEXT),
    mkVar("s_border", "border/default", S, { [sL]: A("p_g900"), [sD]: A("p_white") }, STROKE),
    mkVar("s_accent", "accent/default", S, { [sL]: A("p_blue500"), [sD]: A("p_blue500") }, FILL),
    // component (alias one tier down into semantic)
    mkVar("c_btn_bg", "button/background", K, { [km]: A("s_accent") }, FILL),
    mkVar("c_btn_fg", "button/foreground", K, { [km]: A("s_bg") }, FILL),
  ],
  styles: [], components: [],
  meta: { pageCount: 1, scannedAllPages: true },
});

test("golden clean DS produces zero findings across the full suite", () => {
  const report = runLint(goldenSnapshot(), { severity: "all" });
  assert.equal(
    report.findings.length,
    0,
    `expected 0 findings, got:\n${report.findings.map((f) => `  ${f.severity} ${f.rule_id}: ${f.message}`).join("\n")}`
  );
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.warnings, 0);
});

test("every default-on implemented detector ran on the golden DS (no silent skips)", () => {
  const report = runLint(goldenSnapshot(), { severity: "all" });
  // Opt-in (defaultOn:false) rules don't run in a default lint, so the invariant
  // is: rules_run == implemented AND default-on.
  const defaultOnImpl = ruleInventory().filter((r) => r.implemented && r.defaultOn).length;
  assert.equal(report.summary.rules_run, defaultOnImpl);
  assert.ok(defaultOnImpl >= 30, `expected >=30 default-on detectors, got ${defaultOnImpl}`);
});
