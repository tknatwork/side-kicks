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
