// The read guard accepts exactly VariableComposedColor's two shapes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isComposedColorValue, referencedVariableIds } from "../src/main/composed-color.ts";

const A = (id) => ({ type: "VARIABLE_ALIAS", id });
const rgb = { r: 1, g: 0, b: 0 };

test("aliased color with any opacity, or raw color with aliased opacity", () => {
  assert.equal(isComposedColorValue({ color: A("c"), opacity: 60 }), true);
  assert.equal(isComposedColorValue({ color: A("c"), opacity: A("o") }), true);
  assert.equal(isComposedColorValue({ color: rgb, opacity: A("o") }), true);
});

test("a raw color with a raw opacity, plain colors and aliases are not composed colors", () => {
  assert.equal(isComposedColorValue({ color: rgb, opacity: 60 }), false);
  assert.equal(isComposedColorValue({ r: 1, g: 0, b: 0, a: 1 }), false);
  assert.equal(isComposedColorValue(A("x")), false);
  assert.equal(isComposedColorValue({ color: "red", opacity: A("o") }), false);
});

test("referenced ids cover plain aliases and both composed sides", () => {
  assert.deepEqual(referencedVariableIds(A("x")), ["x"]);
  assert.deepEqual(referencedVariableIds({ color: A("c"), opacity: A("o") }), ["c", "o"]);
  assert.deepEqual(referencedVariableIds({ color: rgb, opacity: A("o") }), ["o"]);
  assert.deepEqual(referencedVariableIds(rgb), []);
});
