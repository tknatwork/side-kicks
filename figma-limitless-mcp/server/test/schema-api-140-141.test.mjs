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
  setSolidFillShape,
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
  rejected("update_animation_style", { styleId: "S:abc,", delete: true, moveFolder: { folder: "Motion", after: null } }, /delete cannot be combined/);
  assert.match(validateRpc("update_animation_style", undefined, { styleId: "S:abc,", delete: true, addEntries: [{ styleId: "Scale" }] }), /delete cannot be combined/);
});

test("a style change and a folder move go together", () => {
  ok("update_animation_style", { styleId: "S:abc,", name: "New/Fade", moveFolder: { folder: "New", after: null } });
});

test("the registered (unrefined) shapes advertise the new fields", () => {
  for (const k of ["type", "props"]) assert.ok(k in applyAnimationStyleShape.shape, k);
  for (const k of ["styleId", "removeEntryIds", "addEntries", "moveAfter", "moveFolder", "delete"]) {
    assert.ok(k in updateAnimationStyleShape.shape, k);
  }
});

// --- Update 141: colours in their authored space ----------------------------

const OKLCH = { space: "OKLCH", l: 0.7, c: 0.12, h: 60 };

test("set_solid_fill takes a colour in any of the six spaces, instead of hex", () => {
  for (const color of [
    OKLCH,
    { space: "OKLAB", l: 0.7, a: 0.05, b: -0.1 },
    { space: "DISPLAY_P3", r: 1, g: 0.2, b: 0.1 },
    { space: "SRGB", r: 1, g: 0.5, b: 0 },
    { space: "HSL", h: 200, s: 0.5, l: 0.5 },
    { space: "HSB", h: 200, s: 0.5, b: 0.8 },
  ]) {
    ok("set_solid_fill", { nodeId: NODE, color });
  }
  ok("set_solid_fill", { nodeId: NODE, hex: "#FFAA00" });
  assert.equal(validateRpc("set_solid_fill", [NODE], { color: OKLCH, target: "stroke" }), null);
});

test("set_solid_fill needs exactly one of hex and color", () => {
  rejected("set_solid_fill", { nodeId: NODE }, /hex or color/);
  rejected("set_solid_fill", { nodeId: NODE, hex: "#000000", color: OKLCH }, /hex or color/);
  rejected("set_solid_fill", { nodeId: NODE, hex: "#000000", color: "#000000" }, /hex or color/);
  assert.match(validateRpc("set_solid_fill", [NODE], {}), /hex or color/);
});

test("color takes hex too, so what a read returns can be written back", () => {
  // Reads report a paint or stop colour as `color: "<hex>"` (and `sourceColor` when authored).
  ok("set_solid_fill", { nodeId: NODE, color: "#ff8800" });
  ok("set_solid_fill", { nodeId: NODE, color: OKLCH });
  ok("set_gradient_fill", { nodeId: NODE, gradientStops: [{ position: 0, color: "#ff0000", opacity: 1 }, { position: 1, color: "#0000ff", opacity: 0.5 }] });
  ok("create_paint_style", { name: "Brand/Ink", color: "#080705" });
  rejected("set_solid_fill", { nodeId: NODE, color: "orange" });
});

test("components outside the ranges Figma enforces are refused before they reach it", () => {
  // Each of these threw in figma.util.rgb live (2026-11-02).
  rejected("set_solid_fill", { nodeId: NODE, color: { space: "HSL", h: 200, s: 50, l: 50 } });
  rejected("set_solid_fill", { nodeId: NODE, color: { space: "OKLCH", l: 70, c: 0.12, h: 60 } });
  rejected("set_solid_fill", { nodeId: NODE, color: { space: "DISPLAY_P3", r: 1.5, g: 0.2, b: 0.1 } });
  rejected("set_solid_fill", { nodeId: NODE, color: { space: "LAB", l: 0.5, a: 0, b: 0 } });
  rejected("set_solid_fill", { nodeId: NODE, color: { space: "OKLCH", l: 0.7, c: -0.1, h: 60 } });
});

test("gradient stops, shadows and paint styles take authored colours too", () => {
  ok("set_gradient_fill", { nodeId: NODE, gradientStops: [{ position: 0, color: OKLCH }, { position: 1, hex: "#000000" }] });
  rejected("set_gradient_fill", { nodeId: NODE, gradientStops: [{ position: 0 }, { position: 1, hex: "#000000" }] }, /hex or color/);
  ok("set_effects", { nodeId: NODE, effects: [{ type: "DROP_SHADOW", color: OKLCH, offset: { x: 0, y: 2 }, radius: 4 }] });
  ok("set_effects", { nodeId: NODE, effects: [{ type: "DROP_SHADOW", color: "#000000", offset: { x: 0, y: 2 }, radius: 4 }] });
  ok("create_paint_style", { name: "Brand/Honey", color: OKLCH });
  ok("create_paint_style", { name: "Brand/Ramp", gradientStops: [{ position: 0, color: OKLCH }, { position: 1, color: OKLCH }] });
  ok("create_paint_style", { name: "Brand/Both", hex: "#000000", gradientStops: [{ position: 0, hex: "#000000" }, { position: 1, hex: "#ffffff" }] });
  rejected("create_paint_style", { name: "Brand/Clash", hex: "#000000", color: OKLCH }, /not both/);
  assert.equal(validateRpc("create_effect_style", undefined, { name: "E", effects: [{ type: "INNER_SHADOW", color: OKLCH, offset: { x: 0, y: 1 }, radius: 2 }] }), null);
});

test("the registered set_solid_fill shape advertises color", () => {
  assert.ok("color" in setSolidFillShape.shape);
  assert.ok("hex" in setSolidFillShape.shape);
});
