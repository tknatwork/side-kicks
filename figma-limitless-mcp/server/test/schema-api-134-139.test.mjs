// Tool input schemas for the surface adopted from Figma Plugin API Updates
// 134-139. Each case goes through the same gates a real call does: the refined
// toolInputSchemas entry (MCP boundary, parseToolInput) and validateRpc (the
// leader re-validating a follower's /rpc call). A new value or field is only
// usable if both accept it — and a new field on a tool with an "at least one
// property" refine must pass when sent on its own.
// Runs against compiled dist/ (pnpm test builds first).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toolInputSchemas,
  setAutoLayoutInput,
  writeVariablesInput,
  setTextPropertiesShape,
  createTextShape,
  createTextStyleInput,
  updateTextStyleShape,
  validateRpc,
} from "../dist/schema.js";

const NODE = "1:2";

// --- Update 137: primaryAxisAlignItems SPACE_EVENLY / SPACE_AROUND ----------

test("set_auto_layout accepts SPACE_EVENLY/SPACE_AROUND alongside the original four", () => {
  for (const v of ["MIN", "MAX", "CENTER", "SPACE_BETWEEN", "SPACE_EVENLY", "SPACE_AROUND"]) {
    // Sent alone, so this also proves the "at least one property" refine passes.
    const r = toolInputSchemas.set_auto_layout.safeParse({ nodeId: NODE, primaryAxisAlignItems: v });
    assert.equal(r.success, true, `${v}: ${JSON.stringify(r.error?.issues)}`);
  }
});

test("set_auto_layout still rejects unknown primary-axis values", () => {
  for (const v of ["SPACE_FOO", "space-evenly", "BASELINE", ""]) {
    const r = toolInputSchemas.set_auto_layout.safeParse({ nodeId: NODE, primaryAxisAlignItems: v });
    assert.equal(r.success, false, `${v} must be rejected`);
  }
});

test("follower->leader validateRpc accepts the Update 137 values", () => {
  for (const v of ["SPACE_EVENLY", "SPACE_AROUND"]) {
    assert.equal(validateRpc("set_auto_layout", [NODE], { primaryAxisAlignItems: v }), null, v);
  }
  assert.equal(
    typeof validateRpc("set_auto_layout", [NODE], { primaryAxisAlignItems: "SPACE_FOO" }),
    "string"
  );
});

test("counterAxisAlignItems is unchanged by Update 137", () => {
  assert.deepEqual(setAutoLayoutInput.shape.counterAxisAlignItems.unwrap().options, [
    "MIN", "MAX", "CENTER", "BASELINE",
  ]);
  for (const v of ["SPACE_BETWEEN", "SPACE_EVENLY", "SPACE_AROUND"]) {
    const r = toolInputSchemas.set_auto_layout.safeParse({ nodeId: NODE, counterAxisAlignItems: v });
    assert.equal(r.success, false, `counter axis must reject ${v}`);
  }
});

// --- TIMING variables: values are seconds ----------------------------------

test("write_variables documents TIMING values in seconds, not ms", () => {
  const { resolvedType, value } = writeVariablesInput.shape.actions.element.shape;
  for (const field of [resolvedType, value]) {
    assert.match(field.description, /TIMING[^.;]*seconds/);
    assert.doesNotMatch(field.description, /in ms\b/);
  }
});

// --- Update 134 textWrapStyle + Update 138 variable fonts --------------------

const STYLE = "S:abc,1:0";
const BODY_STYLE = { name: "Body", fontFamily: "Inter", fontStyle: "Regular" };

const accepts = (tool, args) => {
  const r = toolInputSchemas[tool].safeParse(args);
  assert.equal(r.success, true, `${tool} ${JSON.stringify(args)}: ${JSON.stringify(r.error?.issues)}`);
};
const rejects = (tool, args) => {
  assert.equal(toolInputSchemas[tool].safeParse(args).success, false, `${tool} must reject ${JSON.stringify(args)}`);
};

test("textWrapStyle alone passes the 'at least one property' refines", () => {
  for (const v of ["AUTO", "BALANCE", "PRETTY"]) {
    accepts("set_text_properties", { nodeId: NODE, textWrapStyle: v });
    accepts("update_text_style", { styleId: STYLE, textWrapStyle: v });
    accepts("create_text", { textWrapStyle: v });
    accepts("create_text_style", { ...BODY_STYLE, textWrapStyle: v });
  }
  assert.equal(validateRpc("set_text_properties", [NODE], { textWrapStyle: "BALANCE" }), null);
  assert.equal(validateRpc("update_text_style", undefined, { styleId: STYLE, textWrapStyle: "PRETTY" }), null);
});

test("textWrapStyle rejects values outside AUTO|BALANCE|PRETTY", () => {
  for (const v of ["BALANCED", "balance", "NONE", ""]) {
    rejects("set_text_properties", { nodeId: NODE, textWrapStyle: v });
    rejects("update_text_style", { styleId: STYLE, textWrapStyle: v });
    rejects("create_text", { textWrapStyle: v });
  }
});

test("variationSettings alone passes the refines, on the MCP and follower paths", () => {
  accepts("set_text_properties", { nodeId: NODE, variationSettings: { wght: 550, slnt: -5 } });
  accepts("set_text_properties", { nodeId: NODE, variationSettings: { GRAD: 10 } });
  accepts("update_text_style", { styleId: STYLE, variationSettings: { wght: 600 } });
  accepts("create_text", { variationSettings: { wght: 550 } });
  accepts("create_text_style", { ...BODY_STYLE, variationSettings: { wdth: 87.5 } });
  assert.equal(validateRpc("set_text_properties", [NODE], { variationSettings: { wght: 600 } }), null);
  assert.equal(
    validateRpc("update_text_style", undefined, { styleId: STYLE, variationSettings: { wght: 600 } }),
    null
  );
});

test("variationSettings rejects bad axis tags, non-finite values and {}", () => {
  const bad = [
    { weight: 400 }, // 5 characters
    { wg: 400 }, // 2 characters
    { "wghé": 400 }, // non-ASCII
    { wght: "550" },
    { wght: NaN },
    { wght: Infinity },
    {},
  ];
  for (const vs of bad) {
    rejects("set_text_properties", { nodeId: NODE, variationSettings: vs });
    rejects("update_text_style", { styleId: STYLE, variationSettings: vs });
    rejects("create_text", { variationSettings: vs });
    rejects("create_text_style", { ...BODY_STYLE, variationSettings: vs });
  }
  assert.equal(typeof validateRpc("set_text_properties", [NODE], { variationSettings: { wg: 1 } }), "string");
});

test("an empty patch is still rejected by both text refines", () => {
  rejects("set_text_properties", { nodeId: NODE });
  rejects("update_text_style", { styleId: STYLE });
  assert.equal(typeof validateRpc("set_text_properties", [NODE], {}), "string");
  assert.equal(typeof validateRpc("update_text_style", undefined, { styleId: STYLE }), "string");
});

test("create_text_style keeps fontStyle required alongside variationSettings", () => {
  rejects("create_text_style", { name: "Body", fontFamily: "Inter", variationSettings: { wght: 550 } });
});

test("load_fonts accepts a style-less entry (whole family) and still validates the rest", () => {
  accepts("load_fonts", { fonts: [{ family: "Inter" }] });
  accepts("load_fonts", { fonts: [{ family: "Inter", style: "Regular" }, { family: "Roboto" }] });
  rejects("load_fonts", { fonts: [{ family: "" }] });
  rejects("load_fonts", { fonts: [{ style: "Regular" }] });
  rejects("load_fonts", { fonts: [{ family: "Inter", style: "" }] });
  assert.equal(validateRpc("load_fonts", undefined, { fonts: [{ family: "Inter" }] }), null);
});

test("the registered (unrefined) shapes advertise the new fields", () => {
  for (const schema of [setTextPropertiesShape, createTextShape, createTextStyleInput, updateTextStyleShape]) {
    assert.ok("variationSettings" in schema.shape);
    assert.ok("textWrapStyle" in schema.shape);
  }
});
