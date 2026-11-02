// Custom animation styles (Plugin API Update 140): the config each kind of
// style takes, the entries a custom style is built from, and the read-back.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  animationConfig,
  animationEntries,
  describeCustomAnimationStyle,
} from "../src/main/animation-style.ts";

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
