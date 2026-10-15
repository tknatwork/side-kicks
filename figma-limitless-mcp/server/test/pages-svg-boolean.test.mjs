// manage_pages / switch_page / create_svg / boolean_operation: each case goes
// through the gates a real call does — the refined toolInputSchemas entry (MCP
// boundary), validateRpc (leader re-validating a follower), and the MCP tool
// itself, which must forward the right request to the plugin.
// Runs against compiled dist/ (pnpm test builds first).
import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { toolInputSchemas, validateRpc } from "../dist/schema.js";
import { registerTools } from "../dist/tools.js";
import { JOURNALED_TOOLS } from "../dist/orchestration.js";

const ok = (tool, args) => {
  const r = toolInputSchemas[tool].safeParse(args);
  assert.equal(r.success, true, `${tool} ${JSON.stringify(args)}: ${JSON.stringify(r.error?.issues)}`);
};
const bad = (tool, args, message) => {
  const r = toolInputSchemas[tool].safeParse(args);
  assert.equal(r.success, false, `${tool} ${JSON.stringify(args)} should fail`);
  if (message) assert.match(r.error.issues[0].message, message);
};

test("manage_pages: each action requires exactly what it needs", () => {
  ok("manage_pages", { action: "create" });
  ok("manage_pages", { action: "create", name: "Archive", index: 0 });
  ok("manage_pages", { action: "rename", pageId: "0:1", name: "Cover" });
  ok("manage_pages", { action: "move", pageId: "0:1", index: 2 });
  ok("manage_pages", { action: "delete", pageId: "0:1", confirm: true });
  bad("manage_pages", { action: "rename", name: "x" }, /rename requires pageId/);
  bad("manage_pages", { action: "rename", pageId: "0:1" }, /rename requires name/);
  bad("manage_pages", { action: "move", pageId: "0:1" }, /move requires index/);
  bad("manage_pages", { action: "delete", pageId: "0:1" }, /delete requires confirm: true/);
  bad("manage_pages", { action: "delete", pageId: "0:1", confirm: false }, /confirm: true/);
  bad("manage_pages", { action: "move", pageId: "0:1", index: -1 });
  bad("manage_pages", { action: "duplicate", pageId: "0:1" });
});

test("switch_page needs a pageId or a name", () => {
  ok("switch_page", { pageId: "12:0" });
  ok("switch_page", { name: "Components" });
  bad("switch_page", {}, /pageId or name is required/);
  bad("switch_page", { pageId: "not-an-id" });
});

test("create_svg needs markup; boolean operations need two layers, flatten one", () => {
  ok("create_svg", { svg: "<svg xmlns='http://www.w3.org/2000/svg'/>", parentId: "1:2", x: 10, y: 20, name: "Icon" });
  bad("create_svg", { svg: "" });
  ok("boolean_operation", { operation: "UNION", nodeIds: ["1:2", "1:3"] });
  ok("boolean_operation", { operation: "FLATTEN", nodeIds: ["1:2"] });
  bad("boolean_operation", { operation: "SUBTRACT", nodeIds: ["1:2"] }, /need at least 2 nodes/);
  bad("boolean_operation", { operation: "DIVIDE", nodeIds: ["1:2", "1:3"] });
});

test("the leader re-validates follower calls with the same rules", () => {
  assert.equal(validateRpc("manage_pages", undefined, { action: "delete", pageId: "0:1", confirm: true }), null);
  assert.match(validateRpc("manage_pages", undefined, { action: "delete", pageId: "0:1" }), /confirm: true/);
  assert.equal(validateRpc("switch_page", undefined, { name: "Cover" }), null);
  assert.equal(validateRpc("create_svg", undefined, { svg: "<svg/>" }), null);
  assert.equal(validateRpc("boolean_operation", ["1:2", "1:3"], { operation: "EXCLUDE" }), null);
  assert.match(validateRpc("boolean_operation", ["1:2"], { operation: "UNION" }), /at least 2/);
});

test("edits are journaled; page switching is navigation and is not", () => {
  for (const tool of ["manage_pages", "create_svg", "boolean_operation"]) {
    assert.equal(JOURNALED_TOOLS.has(tool), true, tool);
  }
  assert.equal(JOURNALED_TOOLS.has("switch_page"), false);
});

test("the MCP tools forward the right request to the plugin", async () => {
  const sent = [];
  const fakeNode = {
    agentSupplier: null,
    listConnectedFiles: () => [],
    send: async () => ({ type: "", requestId: "", data: {} }),
    sendWithParams: async (tool, nodeIds, params, fileKey) => {
      sent.push({ tool, nodeIds, params, fileKey });
      return { type: tool, requestId: "", data: { ok: true } };
    },
  };
  const server = new McpServer({ name: "t", version: "0" });
  registerTools(server, fakeNode, 0);
  const client = new Client({ name: "c", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  try {
    const call = (name, args) => client.callTool({ name, arguments: args });
    assert.equal((await call("manage_pages", { action: "rename", pageId: "0:1", name: "Cover", fileKey: "f" })).isError, undefined);
    assert.equal((await call("switch_page", { name: "Cover" })).isError, undefined);
    assert.equal((await call("create_svg", { svg: "<svg/>", x: 4 })).isError, undefined);
    assert.equal((await call("boolean_operation", { operation: "SUBTRACT", nodeIds: ["1:2", "1:3"], name: "Cut" })).isError, undefined);
    const refused = await call("manage_pages", { action: "delete", pageId: "0:1" });
    assert.equal(refused.isError, true, "delete without confirm never reaches the plugin");

    assert.deepEqual(sent, [
      { tool: "manage_pages", nodeIds: undefined, params: { action: "rename", pageId: "0:1", name: "Cover" }, fileKey: "f" },
      { tool: "switch_page", nodeIds: undefined, params: { name: "Cover" }, fileKey: undefined },
      { tool: "create_svg", nodeIds: undefined, params: { svg: "<svg/>", x: 4 }, fileKey: undefined },
      { tool: "boolean_operation", nodeIds: ["1:2", "1:3"], params: { operation: "SUBTRACT", name: "Cut" }, fileKey: undefined },
    ]);
  } finally {
    await client.close();
    await server.close();
  }
});
