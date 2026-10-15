// registerTools runs every tool callback inside a CallContext: a client that
// asks for progress gets heartbeats as notifications/progress, and the client's
// cancel signal is what the bridge sees. Real SDK client + server, in memory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerTools } from "../dist/tools.js";
import { callContext } from "../dist/call-context.js";

async function connect(fakeNode) {
  const server = new McpServer({ name: "test", version: "0" });
  registerTools(server, fakeNode, 0);
  const client = new Client({ name: "test-client", version: "0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return { client, server };
}

const fakeNode = (onSend) => ({
  agentSupplier: null,
  listConnectedFiles: () => [],
  send: (...args) => onSend(...args),
  sendWithParams: (...args) => onSend(...args),
});

test("plugin heartbeats reach the client as progress notifications", async () => {
  const { client, server } = await connect(
    fakeNode(async () => {
      const ctx = callContext.getStore();
      ctx.onProgress();
      ctx.onProgress();
      return { type: "get_selection", requestId: "", data: [] };
    })
  );
  try {
    const seen = [];
    const result = await client.callTool({ name: "get_selection", arguments: {} }, undefined, {
      onprogress: (p) => seen.push(p.progress),
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(seen, [1, 2]);
  } finally {
    await client.close();
    await server.close();
  }
});

test("without a progress token no notifications are sent, and the signal is still there", async () => {
  let ctx;
  const { client, server } = await connect(
    fakeNode(async () => {
      ctx = callContext.getStore();
      return { type: "get_selection", requestId: "", data: [] };
    })
  );
  try {
    await client.callTool({ name: "get_selection", arguments: {} });
    assert.equal(ctx.onProgress, undefined);
    assert.ok(ctx.signal instanceof AbortSignal);
  } finally {
    await client.close();
    await server.close();
  }
});

test("cancelling the call aborts the signal the bridge sees", async () => {
  let aborted;
  const { client, server } = await connect(
    fakeNode(
      () =>
        new Promise((resolve) => {
          const { signal } = callContext.getStore();
          signal.addEventListener("abort", () => {
            aborted = true;
            resolve({ type: "get_selection", requestId: "", error: "cancelled" });
          });
        })
    )
  );
  try {
    const controller = new AbortController();
    const call = client.callTool({ name: "get_selection", arguments: {} }, undefined, {
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(call);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(aborted, true);
  } finally {
    await client.close();
    await server.close();
  }
});
