// Custom animation styles (Plugin API Update 140): the config each kind of
// style takes, the entries a custom style is built from, and the read-back.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  animationConfig,
  animationEntries,
  appliedInstanceFor,
  describeCustomAnimationStyle,
} from "../src/main/animation-style.ts";

// Shapes as Figma returned them live on 2026-11-02: an applied Figma style reads
// back with an internal styleId, and only its name links it to the listed style.
const LISTED = [
  { styleId: "Position", name: "motion.preset_name.position" },
  { styleId: "Scale", name: "motion.preset_name.scale" },
];
const POSITION = { id: "AnimationPresetId:1:9", styleId: "CodeComponentId:1:8", name: "motion.preset_name.position", type: "FIGMA" };
const CUSTOM = { id: "1:12", styleId: "S:291a,", name: "Test/Enter", type: "CUSTOM" };

test("a listed Figma style id finds its applied instance by name", () => {
  assert.equal(appliedInstanceFor([CUSTOM, POSITION], "Position", LISTED, "1:5"), "AnimationPresetId:1:9");
});

test("an exact styleId still wins: a custom style, or an internal id read back", () => {
  assert.equal(appliedInstanceFor([CUSTOM, POSITION], "S:291a,", LISTED, "1:5"), "1:12");
  assert.equal(appliedInstanceFor([CUSTOM, POSITION], "CodeComponentId:1:8", LISTED, "1:5"), "AnimationPresetId:1:9");
});

test("a custom style is never matched by a listed style's name", () => {
  const lookalike = { ...CUSTOM, name: "motion.preset_name.scale" };
  assert.throws(() => appliedInstanceFor([lookalike], "Scale", LISTED, "1:5"), /No applied animation style matches styleId "Scale" on 1:5/);
});

test("two matches are refused with their instance ids, not guessed", () => {
  const again = { ...POSITION, id: "AnimationPresetId:1:20" };
  assert.throws(
    () => appliedInstanceFor([POSITION, again], "Position", LISTED, "1:5"),
    /applied 2 times on 1:5; pass appliedStyleInstanceId, one of: AnimationPresetId:1:9, AnimationPresetId:1:20/
  );
});

test("no match names what is applied", () => {
  assert.throws(() => appliedInstanceFor([], "Position", LISTED, "1:5"), /Applied: \(none\)/);
  assert.throws(() => appliedInstanceFor([POSITION], "Nope", LISTED, "1:5"), /CodeComponentId:1:8 \(instance AnimationPresetId:1:9\)/);
});

test("a Figma style with nothing overridden passes no config, as before Update 140", () => {
  assert.equal(animationConfig("FIGMA", {}), undefined);
});

test("a Figma style carries duration, timelineOffset and props", () => {
  assert.deepEqual(animationConfig("FIGMA", { duration: 0.4, timelineOffset: 0.1, props: { direction: "right" } }), {
    duration: 0.4,
    timelineOffset: 0.1,
    props: { direction: "right" },
  });
});

test("a custom style always says CUSTOM, and takes only timelineOffset", () => {
  assert.deepEqual(animationConfig("CUSTOM", {}), { type: "CUSTOM" });
  assert.deepEqual(animationConfig("CUSTOM", { timelineOffset: 0.2 }), { type: "CUSTOM", timelineOffset: 0.2 });
  assert.throws(() => animationConfig("CUSTOM", { duration: 1 }), /takes only timelineOffset/);
  assert.throws(() => animationConfig("CUSTOM", { props: { distance: 4 } }), /takes only timelineOffset/);
});

test("entries need a styleId, and props must be an object", () => {
  assert.deepEqual(animationEntries(undefined), []);
  assert.deepEqual(animationEntries([{ styleId: "Position" }, { styleId: "Opacity", props: { opacityAmount: 0 } }]), [
    { styleId: "Position" },
    { styleId: "Opacity", props: { opacityAmount: 0 } },
  ]);
  assert.throws(() => animationEntries([{ props: {} }]), /entries\[0\] needs a styleId/);
  assert.throws(() => animationEntries([{ styleId: "Position", props: "x" }], "addEntries"), /addEntries\[0\]\.props/);
  assert.throws(() => animationEntries({ styleId: "Position" }), /must be an array/);
});

test("a custom style reads back with its entries, and an empty description is left out", () => {
  const style = {
    id: "S:abc,",
    key: "abc",
    name: "Motion/Enter",
    description: "",
    remote: false,
    animationEntries: [
      { id: "e1", styleId: "Position", name: "motion.preset_name.position", type: "FIGMA", duration: 0.5, timelineOffset: 0, props: { direction: "left" } },
    ],
  };
  assert.deepEqual(describeCustomAnimationStyle(style), {
    styleId: "S:abc,",
    key: "abc",
    name: "Motion/Enter",
    description: undefined,
    remote: false,
    entries: [{ id: "e1", styleId: "Position", name: "motion.preset_name.position", duration: 0.5, timelineOffset: 0, props: { direction: "left" } }],
  });
});
