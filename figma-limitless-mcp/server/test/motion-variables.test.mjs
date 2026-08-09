// Motion variables (EASING / TIMING — Figma typings 1.131+) through the lint
// suite. Ground truth, measured against a live Figma file: motion variables are
// created with scopes ["ALL_SCOPES"] and Figma REJECTS any set_scopes call on
// them ("Cannot set scopes on this variable type") — so ALL_SCOPES is their only
// legal state. These tests pin both directions: legal motion variables stay
// silent, and a snapshot claiming an impossible scope fires the ERROR rule
// (fail-open lookup would previously have skipped unknown types entirely).
// Runs against compiled dist/ (pnpm test builds first).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runLint } from "../dist/lint/index.js";

const EASE = { type: "EASE_IN_AND_OUT" };
const BEZIER = {
  type: "CUSTOM_CUBIC_BEZIER",
  easingFunctionCubicBezier: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
};
const mkMotion = (id, name, resolvedType, valuesByMode, scopes = ["ALL_SCOPES"]) => ({
  id, name, collectionId: "M", resolvedType,
  scopes, hiddenFromPublishing: false, codeSyntax: {}, description: "",
  valuesByMode,
});
const base = (variables) => ({
  collections: [
    { id: "M", name: "Motion", defaultModeId: "m", modes: [{ modeId: "m", name: "M" }] },
  ],
  variables, styles: [], components: [],
  meta: { pageCount: 1, scannedAllPages: true },
});
const has = (findings, id) => findings.some((f) => f.rule_id === id);

test("legal motion variables (ALL_SCOPES) produce no scope errors", () => {
  const snap = base([
    mkMotion("e1", "motion/ease-standard", "EASING", { m: EASE }),
    mkMotion("e2", "motion/ease-entrance", "EASING", { m: BEZIER }),
    mkMotion("t1", "motion/duration-fast", "TIMING", { m: 150 }),
  ]);
  const report = runLint(snap, { severity: "all" });
  assert.equal(
    has(report.findings, "scope-legal-for-resolved-type"),
    false,
    `unexpected scope errors: ${JSON.stringify(report.findings.filter((f) => f.rule_id === "scope-legal-for-resolved-type"))}`
  );
});

test("a motion variable with an impossible scope fires the ERROR rule", () => {
  // Cannot occur through the plugin (Figma rejects set_scopes on motion types),
  // but a stale or hand-built snapshot can claim it — the linter must not be
  // fail-open on the new types.
  const snap = base([
    mkMotion("e_bad", "motion/ease-broken", "EASING", { m: EASE }, ["EFFECT_FLOAT"]),
    mkMotion("t_bad", "motion/duration-broken", "TIMING", { m: 200 }, ["WIDTH_HEIGHT"]),
  ]);
  const report = runLint(snap, { severity: "all" });
  const hits = report.findings.filter((f) => f.rule_id === "scope-legal-for-resolved-type");
  assert.equal(hits.length >= 2, true, `expected 2+ scope errors, got ${JSON.stringify(hits)}`);
  for (const f of hits) {
    assert.equal(f.severity, "error");
  }
});

test("timing numbers and easing objects survive the duplicate-value keyer", () => {
  // tokens.ts dedupes on resolvedType + JSON.stringify(value); two structurally
  // identical easing values must be seen as duplicates without throwing.
  const snap = base([
    mkMotion("d1", "motion/ease-a", "EASING", { m: BEZIER }),
    mkMotion("d2", "motion/ease-b", "EASING", { m: BEZIER }),
  ]);
  const report = runLint(snap, { severity: "all" });
  assert.ok(report, "lint must not throw on structured easing values");
});
