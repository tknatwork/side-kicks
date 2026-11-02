// Tool input schemas for the surface adopted from Figma Plugin API Updates
// 140-141. As in schema-api-134-139: every case goes through the refined
// toolInputSchemas entry (the MCP boundary) and validateRpc (the leader
// re-validating a follower's /rpc call), so a field is usable only if both take it.
// Runs against compiled dist/ (pnpm test builds first).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toolInputSchemas,
  applyAnimationStyleShape,
  updateAnimationStyleShape,
  validateRpc,
} from "../dist/schema.js";

const NODE = "1:2";
const ok = (tool, value) => {
  const r = toolInputSchemas[tool].safeParse(value);
  assert.equal(r.success, true, `${tool} ${JSON.stringify(value)}: ${JSON.stringify(r.error?.issues)}`);
};
const rejected = (tool, value, message) => {
  const r = toolInputSchemas[tool].safeParse(value);
  assert.equal(r.success, false, `${tool} ${JSON.stringify(value)} must be rejected`);
  if (message) assert.match(r.error.issues[0].message, message);
};

// --- Update 140: custom animation styles ------------------------------------

test("apply_animation_style takes a type and props for a Figma style", () => {
  ok("apply_animation_style", { nodeId: NODE, styleId: "Position", props: { direction: "right", distance: 80 } });
  ok("apply_animation_style", { nodeId: NODE, styleId: "Position", type: "FIGMA", duration: 0.4 });
  ok("apply_animation_style", { nodeId: NODE, styleId: "S:abc,", type: "CUSTOM", timelineOffset: 0.2 });
  rejected("apply_animation_style", { nodeId: NODE, styleId: "Position", type: "SPRING" });
});

test("a custom style is refused duration and props, on both paths", () => {
  rejected("apply_animation_style", { nodeId: NODE, styleId: "S:abc,", type: "CUSTOM", duration: 1 }, /takes only timelineOffset/);
  rejected("apply_animation_style", { nodeId: NODE, styleId: "S:abc,", type: "CUSTOM", props: { a: 1 } }, /takes only timelineOffset/);
  assert.match(validateRpc("apply_animation_style", [NODE], { styleId: "S:abc,", type: "CUSTOM", duration: 1 }), /timelineOffset/);
  assert.equal(validateRpc("apply_animation_style", [NODE], { styleId: "S:abc,", type: "CUSTOM" }), null);
});

test("create_animation_style takes a name and entries of Figma style ids", () => {
  ok("create_animation_style", { name: "Motion/Enter" });
  ok("create_animation_style", { name: "Motion/Enter", entries: [{ styleId: "Position", props: { direction: "left" } }, { styleId: "Opacity" }] });
  rejected("create_animation_style", { name: "" });
  rejected("create_animation_style", { name: "Motion/Enter", entries: [{ props: {} }] });
  assert.equal(validateRpc("create_animation_style", undefined, { name: "Motion/Enter", skipIfExists: true }), null);
});

test("update_animation_style needs a change, and a styleId for any change to a style", () => {
  rejected("update_animation_style", { styleId: "S:abc," }, /nothing to update/);
  rejected("update_animation_style", {}, /nothing to update/);
  rejected("update_animation_style", { name: "Motion/Exit" }, /styleId is required/);
  ok("update_animation_style", { styleId: "S:abc,", name: "Motion/Exit" });
  ok("update_animation_style", { styleId: "S:abc,", removeEntryIds: ["e1"], addEntries: [{ styleId: "Scale" }] });
  ok("update_animation_style", { styleId: "S:abc,", moveAfter: null });
  ok("update_animation_style", { moveFolder: { folder: "Motion", after: null } });
});

test("delete stands alone", () => {
  ok("update_animation_style", { styleId: "S:abc,", delete: true });
  rejected("update_animation_style", { styleId: "S:abc,", delete: true, name: "x" }, /delete cannot be combined/);
  assert.match(validateRpc("update_animation_style", undefined, { styleId: "S:abc,", delete: true, addEntries: [{ styleId: "Scale" }] }), /delete cannot be combined/);
});

test("the registered (unrefined) shapes advertise the new fields", () => {
  for (const k of ["type", "props"]) assert.ok(k in applyAnimationStyleShape.shape, k);
  for (const k of ["styleId", "removeEntryIds", "addEntries", "moveAfter", "moveFolder", "delete"]) {
    assert.ok(k in updateAnimationStyleShape.shape, k);
  }
});
