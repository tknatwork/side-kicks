// End to end through the MCP SDK: set_code_mapping accepts the
// Code-Connect-style fields, the orchestrator stores them, and
// get_design_context resolves them into the plugin's design context.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.HOME = mkdtempSync(path.join(tmpdir(), "limitless-codemap-"));
const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
const { registerTools } = await import("../dist/tools.js");
const { Orchestrator } = await import("../dist/orchestration.js");

const orchestrator = new Orchestrator();
const designContext = {
  fileName: "F",
  currentPage: { id: "0:1", name: "Page" },
  selectionCount: 0,
  context: [{
    id: "0:1", type: "PAGE", name: "Page",
    children: [
      { id: "1:2", type: "INSTANCE", name: "Button", childCount: 0,
        component: { name: "Button", variant: "Size=Small", key: "k-btn", setKey: "set-btn",
          properties: { Size: "Small", Label: "Save", Disabled: false } },
        children: [{ id: "1:3", type: "TEXT", name: "Label" }] },
      { id: "1:9", type: "INSTANCE", name: "Avatar", component: { name: "Avatar", properties: {} } },
    ],
  }],
};

// A node that answers meta tools with the real orchestrator and plugin reads with a fixture.
const fakeNode = {
  agentSupplier: null,
  listConnectedFiles: () => [],
  send: (tool, ids, fileKey) => fakeNode.sendWithParams(tool, ids, {}, fileKey),
  sendWithParams: async (tool, _ids, params) => {
    if (tool === "set_code_mapping" || tool === "get_code_mappings") {
      return { type: tool, requestId: "", data: orchestrator.handleMeta(tool, { ...params, fileKey: "file-1" }, []) };
    }
    if (tool === "get_design_context") {
      return { type: tool, requestId: "", data: structuredClone(designContext) };
    }
    throw new Error(`unexpected tool ${tool}`);
  },
};

const server = new McpServer({ name: "t", version: "0" });
registerTools(server, fakeNode, 0);
const client = new Client({ name: "c", version: "0" });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(b), client.connect(a)]);
const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  assert.equal(res.isError, undefined, res.content?.[0]?.text);
  return JSON.parse(res.content[0].text);
};

test("a prop mapping turns each instance into a snippet for its current values", async () => {
  await call("set_code_mapping", {
    target: "set-btn",
    source: "src/ui/button.tsx",
    language: "tsx",
    component: "Button",
    imports: ["import { Button } from '@/ui/button'"],
    props: { Size: { prop: "size", values: { Small: "sm" } }, Disabled: { prop: "disabled" } },
    children: "Label",
  });
  const stored = await call("get_code_mappings", { targets: ["set-btn"] });
  assert.equal(stored.mappings["set-btn"].component, "Button");
  assert.deepEqual(stored.mappings["set-btn"].props.Size, { prop: "size", values: { Small: "sm" } });

  const ctx = await call("get_design_context", {});
  const [button, avatar] = ctx.context[0].children;
  assert.equal(button.code.snippet, '<Button size="sm">Save</Button>');
  assert.deepEqual(button.code.imports, ["import { Button } from '@/ui/button'"]);
  assert.equal(button.children, undefined, "the snippet replaces the layers");
  assert.equal(button.childCount, 1);
  assert.equal(avatar.code, undefined);
  assert.deepEqual(ctx.codeMappings, { matched: 1, unmapped: [{ name: "Avatar", instances: 1 }] });

  const expanded = await call("get_design_context", { expandMapped: true });
  assert.equal(expanded.context[0].children[0].children.length, 1);
});

test("invalid prop mappings are rejected by the schema", async () => {
  const res = await client.callTool({
    name: "set_code_mapping",
    arguments: { target: "x", source: "a.tsx", props: { Size: { values: {} } } },
  });
  assert.equal(res.isError, true);
});

test.after(async () => {
  await client.close();
  await server.close();
});
