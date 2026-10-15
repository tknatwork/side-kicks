// Code-Connect-style mappings: an instance's current Figma property values
// become a code snippet, its layers collapse, and unmapped components are
// reported. Pure functions over get_design_context-shaped trees.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCodeMappings, codeFor, renderJsx, resolveProps } from "../dist/code-mapping.js";

const buttonMapping = {
  source: "src/ui/button.tsx",
  language: "tsx",
  component: "Button",
  imports: ["import { Button } from '@/ui/button'"],
  props: {
    Size: { prop: "size", values: { Small: "sm", Large: "lg" } },
    Disabled: { prop: "disabled" },
    Icon: { prop: "icon", values: { None: null } },
  },
  children: "Label",
};

const instance = (properties, extra = {}) => ({
  id: "1:2",
  type: "INSTANCE",
  component: { name: "Button", variant: "Size=Small", key: "k-btn", setKey: "set-btn", properties },
  children: [{ id: "1:3", type: "TEXT" }, { id: "1:4", type: "FRAME" }],
  ...extra,
});

test("Figma values map to code values; unlisted values pass through", () => {
  assert.deepEqual(
    resolveProps(buttonMapping, { Size: "Small", Disabled: true, Icon: "None", Label: "Save", Other: "x" }),
    { size: "sm", disabled: true, icon: null }
  );
  assert.deepEqual(resolveProps(buttonMapping, { Size: "Medium" }), { size: "Medium" });
});

test("JSX rendering: true is a bare prop, false/null are omitted, odd strings are escaped", () => {
  assert.equal(renderJsx("Button", { size: "sm", disabled: true, icon: null, busy: false }, "Save"),
    '<Button size="sm" disabled>Save</Button>');
  assert.equal(renderJsx("Badge", { count: 3 }), "<Badge count={3} />");
  assert.equal(renderJsx("Tip", { text: 'say "hi"' }, "a <b>"), '<Tip text={"say \\"hi\\""}>{"a <b>"}</Tip>');
});

test("a mapped instance gets a resolved snippet and its layers collapse", () => {
  const tree = [{ id: "0:1", type: "FRAME", children: [instance({ Size: "Small", Disabled: true, Icon: "None", Label: "Save" })] }];
  const coverage = applyCodeMappings(tree, { "set-btn": buttonMapping });
  const node = tree[0].children[0];
  assert.deepEqual(node.code, {
    source: "src/ui/button.tsx",
    language: "tsx",
    imports: ["import { Button } from '@/ui/button'"],
    snippet: '<Button size="sm" disabled>Save</Button>',
    matchedBy: "set-btn",
  });
  assert.equal(node.children, undefined);
  assert.equal(node.childCount, 2);
  assert.deepEqual(coverage, { matched: 1, unmapped: [] });
});

test("expandMapped keeps the layers; the component key beats the set key and the name", () => {
  const tree = [instance({ Size: "Large" })];
  applyCodeMappings(tree, { "k-btn": { ...buttonMapping, component: "Exact" }, "set-btn": buttonMapping, Button: buttonMapping }, true);
  assert.equal(tree[0].code.matchedBy, "k-btn");
  assert.equal(tree[0].code.snippet, '<Exact size="lg" />');
  assert.equal(tree[0].children.length, 2);
});

test("a static legacy mapping still surfaces its snippet; other languages get resolved props", () => {
  assert.deepEqual(codeFor({ source: "Button.swift", snippet: "Button(...)" }, {}, "Button"), {
    source: "Button.swift", snippet: "Button(...)", matchedBy: "Button",
  });
  const swift = codeFor({ ...buttonMapping, language: "swift", snippet: undefined }, { Size: "Small", Label: "Go" }, "Button");
  assert.deepEqual(swift.props, { size: "sm" });
  assert.equal(swift.component, "Button");
  assert.equal(swift.children, "Go");
  assert.equal(swift.snippet, undefined);
});

test("unmapped components are counted, most-used first, nested ones included", () => {
  const card = (n) => ({ id: `c${n}`, type: "INSTANCE", component: { name: "Card", properties: {} },
    children: [{ id: `i${n}`, type: "INSTANCE", component: { name: "Icon", properties: {} } }] });
  const tree = [{ id: "p", type: "PAGE", children: [card(1), card(2), { id: "x", type: "INSTANCE", component: { name: "Avatar", properties: {} } }] }];
  const coverage = applyCodeMappings(tree, {});
  assert.deepEqual(coverage, {
    matched: 0,
    unmapped: [{ name: "Card", instances: 2 }, { name: "Icon", instances: 2 }, { name: "Avatar", instances: 1 }],
  });
});

test("mapping keys are looked up as own keys only", () => {
  const tree = [{ id: "1", type: "INSTANCE", component: { name: "constructor", properties: {} } }];
  assert.deepEqual(applyCodeMappings(tree, {}), { matched: 0, unmapped: [{ name: "constructor", instances: 1 }] });
});
