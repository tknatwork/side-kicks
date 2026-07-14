// Regression tests for the accessibility contrast detectors. These run against
// the COMPILED dist/, so `pnpm build` must precede `pnpm test` (the test script
// chains them). They pin the deliberately-conservative pairing: a foreground is
// paired with a surface ONLY through the explicit on-<X> naming convention —
// never by loose suffix matching, which fabricated 53 findings on a real 3-tier
// DS that simply doesn't use on-<X>. See detectors/a11y.ts for the rationale.
import { test } from "node:test";
import assert from "node:assert/strict";
import { a11yDetectors } from "../dist/lint/detectors/a11y.js";

const fg = a11yDetectors["fg-bg-pair-contrast"];
const line = a11yDetectors["border-icon-graphical-contrast"];

const V = (id, name, collectionId, value) => ({
  id, name, collectionId, resolvedType: "COLOR",
  scopes: [], hiddenFromPublishing: false, codeSyntax: {}, description: "",
  valuesByMode: { [collectionId === "cP" ? "m1" : "mS"]: value },
});
const rgb = (r, g, b) => ({ r, g, b });
const A = (id) => ({ alias: id });

// A 3-tier snapshot: Primitives hold raw colour, Semantic holds the fg/bg/border
// tokens that alias them. gray0.6 on white = 2.85:1; black on white = 21:1.
const snap = () => ({
  collections: [
    { id: "cP", name: "Primitives", defaultModeId: "m1", modes: [{ modeId: "m1", name: "Mode" }] },
    { id: "cS", name: "Semantic", defaultModeId: "mS", modes: [{ modeId: "mS", name: "Light" }] },
  ],
  variables: [
    V("p_white", "white", "cP", rgb(1, 1, 1)),
    V("p_black", "black", "cP", rgb(0, 0, 0)),
    V("p_gray", "gray", "cP", rgb(0.6, 0.6, 0.6)),
    // on-<X> convention — the only shape that should pair
    V("s_fg_on_primary", "foreground/on-primary", "cS", A("p_gray")),   // vs surface/primary(white) = 2.85 -> FIRE
    V("s_surface_primary", "surface/primary", "cS", A("p_white")),
    V("s_fg_on_accent", "foreground/on-accent", "cS", A("p_white")),    // vs surface/accent(white) same colour -> skip
    V("s_surface_accent", "surface/accent", "cS", A("p_white")),
    V("s_fg_on_neutral", "foreground/on-neutral", "cS", A("p_black")),  // vs surface/neutral(white) = 21 -> pass
    V("s_surface_neutral", "surface/neutral", "cS", A("p_white")),
    // suffix-only, NO on- (Nectar-style) — must never be paired
    V("s_fg_primary_default", "foreground/primary/default", "cS", A("p_gray")),
    V("s_surface_primary_default", "surface/primary/default", "cS", A("p_white")),
    // border on-<X>
    V("s_border_on_primary", "border/on-primary", "cS", A("p_gray")),   // = 2.85 (<3) -> FIRE
    V("s_border_on_neutral", "border/on-neutral", "cS", A("p_black")),  // = 21 -> pass
  ],
  styles: [], components: [],
  meta: { pageCount: 1, scannedAllPages: true },
});

test("fg-bg contrast: only the on-<X> pair below 4.5:1 fires", () => {
  const f = fg(snap());
  assert.equal(f.length, 1);
  assert.equal(f[0].variableId, "s_fg_on_primary");
  assert.match(f[0].message, /2\.85:1/); // WCAG math intact
});

test("fg-bg contrast: same-colour on-<X> pair is skipped (no 1.00:1 noise)", () => {
  assert.ok(!fg(snap()).some((x) => x.variableId === "s_fg_on_accent"));
});

test("fg-bg contrast: a well-contrasted pair (21:1) passes", () => {
  assert.ok(!fg(snap()).some((x) => x.variableId === "s_fg_on_neutral"));
});

test("fg-bg contrast: suffix-only (no on-) pairs are never fabricated", () => {
  assert.ok(!fg(snap()).some((x) => x.variableId === "s_fg_primary_default"));
});

test("border/icon contrast: only the on-<X> pair below 3:1 fires", () => {
  const f = line(snap());
  assert.equal(f.length, 1);
  assert.equal(f[0].variableId, "s_border_on_primary");
});
