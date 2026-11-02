// serializeNode runs on the sources (Node type stripping): reads are
// depth-bounded, and FigJam content that lives outside TEXT nodes is reported.
import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeNode } from "../src/main/serializer.ts";

const frame = (id, children = []) => ({ id, name: id, type: "FRAME", visible: true, x: 0, y: 0, width: 1, height: 1, children });
const text = (characters) => ({ characters });

test("maxDepth stops at the limit and reports childCount instead", () => {
  const tree = frame("root", [frame("a", [frame("a1"), frame("a2", [frame("deep")])]), { ...frame("hidden"), visible: false }]);
  const out = serializeNode(tree, 1);
  assert.equal(out.children.length, 1, "hidden children are skipped");
  assert.equal(out.children[0].children, undefined);
  assert.equal(out.children[0].childCount, 2);
  assert.equal(serializeNode(tree, 0).childCount, 1);
  assert.equal(serializeNode(tree).children[0].children[1].children[0].id, "deep", "no limit by default");
});

test("FigJam stickies, shapes, connectors, code blocks and tables carry their content", () => {
  const board = { id: "0:1", name: "Board", type: "PAGE", children: [
    { id: "1:1", name: "s", type: "STICKY", visible: true, text: text("Ship it") },
    { id: "1:2", name: "d", type: "SHAPE_WITH_TEXT", visible: true, shapeType: "ENG_DATABASE", text: text("Users") },
    { id: "1:3", name: "e", type: "CONNECTOR", visible: true, text: text(""), connectorLineType: "STRAIGHT",
      connectorStart: { endpointNodeId: "1:1", magnet: "AUTO" }, connectorEnd: { position: { x: 5, y: 6 } } },
    { id: "1:4", name: "c", type: "CODE_BLOCK", visible: true, code: "SELECT 1", codeLanguage: "SQL" },
    { id: "1:5", name: "t", type: "TABLE", visible: true, numRows: 300, numColumns: 2,
      cellAt: (r, c) => ({ text: text(`${r},${c}`) }) },
  ] };
  const [sticky, shape, edge, code, table] = serializeNode(board).children;
  assert.equal(sticky.text, "Ship it");
  assert.deepEqual([shape.shapeType, shape.text], ["ENG_DATABASE", "Users"]);
  assert.deepEqual(edge.connector, {
    start: { nodeId: "1:1", magnet: "AUTO" }, end: { position: { x: 5, y: 6 } }, lineType: "STRAIGHT",
  });
  assert.equal(edge.text, undefined, "an unlabeled connector has no text");
  assert.deepEqual(code.codeBlock, { language: "SQL", code: "SELECT 1" });
  assert.deepEqual([table.table.rows, table.table.cells.length, table.table.truncated], [300, 200, true]);
  assert.deepEqual(table.table.cells[1], ["1,0", "1,1"]);
});

test("a colour authored in a colour space reads back with its sourceColor; others are unchanged", () => {
  const oklch = { space: "OKLCH", l: 0.7, c: 0.12, h: 60 };
  const p3 = { space: "DISPLAY_P3", r: 1, g: 0.2, b: 0.1 };
  const node = {
    ...frame("1:9"),
    fills: [
      { type: "SOLID", visible: true, opacity: 1, color: { r: 0.83, g: 0.55, b: 0.3, sourceColor: oklch } },
      { type: "SOLID", visible: true, opacity: 1, color: { r: 0, g: 0, b: 0 } },
      { type: "GRADIENT_LINEAR", visible: true, opacity: 1, gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1, sourceColor: p3 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 0.5 } },
      ] },
    ],
    effects: [
      { type: "DROP_SHADOW", visible: true, color: { r: 0, g: 0, b: 0, a: 0.25, sourceColor: oklch }, offset: { x: 0, y: 2 }, radius: 4, spread: 0, blendMode: "NORMAL" },
    ],
  };
  const { fills, effects } = serializeNode(node).styles;
  assert.deepEqual(fills[0], { type: "SOLID", color: "#d48c4d", sourceColor: oklch, opacity: 1 });
  assert.deepEqual(fills[1], { type: "SOLID", color: "#000000", opacity: 1 }, "no sourceColor key at all");
  assert.deepEqual(fills[2].gradientStops[0].sourceColor, p3);
  assert.equal("sourceColor" in fills[2].gradientStops[1], false);
  assert.deepEqual(effects[0].sourceColor, oklch);
});
