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
