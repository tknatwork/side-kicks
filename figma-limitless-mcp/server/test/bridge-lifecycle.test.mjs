// Request lifecycle over the plugin WebSocket: the timeout measures silence
// (heartbeats keep long jobs alive), a timeout cancels the request, and a
// dropped socket gets a reconnect grace period instead of failing at once.
// A fake plugin speaks the wire protocol; no Figma needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { Bridge } from "../dist/bridge.js";
import { callContext } from "../dist/call-context.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setup(options = {}) {
  const bridge = new Bridge({
    reconnectGraceMs: 300,
    pingIntervalMs: 60_000,
    ...options,
  });
  const server = http.createServer();
  server.on("upgrade", (req, socket, head) => bridge.handleUpgrade(req, socket, head));
  server.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  const plugins = [];
  const connect = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?fileKey=file-1&fileName=Test`);
    const inbox = [];
    const waiters = [];
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      const w = waiters.shift();
      if (w) w(msg);
      else inbox.push(msg);
    });
    ws.next = () =>
      inbox.length > 0 ? Promise.resolve(inbox.shift()) : new Promise((r) => waiters.push(r));
    ws.sendJson = (obj) => ws.send(JSON.stringify(obj));
    await once(ws, "open");
    plugins.push(ws);
    return ws;
  };
  const cleanup = () => {
    for (const ws of plugins) ws.terminate();
    bridge.close();
    server.close();
  };
  return { bridge, connect, cleanup };
}

const heartbeat = (ws, requestIds, sync) =>
  ws.sendJson({ type: "progress", payload: { requestIds, ...(sync ? { sync: true } : {}) } });

test("heartbeats keep a long request alive past its stall window", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const plugin = await connect();
    const result = bridge.sendWithParams("lint_run", undefined, undefined, undefined, 150);
    const req = await plugin.next();
    for (let i = 0; i < 10; i++) {
      await sleep(50);
      heartbeat(plugin, [req.requestId]);
    } // 500ms of work, more than 3x the 150ms window
    plugin.sendJson({ type: req.type, requestId: req.requestId, data: { ok: true } });
    assert.deepEqual((await result).data, { ok: true });
  } finally {
    cleanup();
  }
});

test("each request carries a run budget: 4x its silence window, at least a minute", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const plugin = await connect();
    void bridge.sendWithParams("get_node", ["1:2"], undefined, undefined, 120_000).catch(() => {});
    void bridge.send("get_selection").catch(() => {});
    assert.equal((await plugin.next()).budgetMs, 480_000);
    assert.equal((await plugin.next()).budgetMs, 120_000);
  } finally {
    cleanup();
  }
});

test("silence fails the request and tells the plugin to cancel it", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const plugin = await connect();
    const result = bridge.sendWithParams("set_text_content", ["1:2"], { text: "x" }, undefined, 100);
    const req = await plugin.next();
    await assert.rejects(result, /no response or progress from the plugin for 100ms/);
    assert.deepEqual(await plugin.next(), { type: "cancel", requestId: req.requestId });
  } finally {
    cleanup();
  }
});

test("a heartbeat for another request does not keep this one alive", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const plugin = await connect();
    const result = bridge.sendWithParams("get_node", ["1:2"], undefined, undefined, 100);
    await plugin.next();
    const beat = setInterval(() => heartbeat(plugin, ["someone-else"]), 30);
    try {
      await assert.rejects(result, /no response or progress/);
    } finally {
      clearInterval(beat);
    }
  } finally {
    cleanup();
  }
});

test("the hard cap ends a request even while heartbeats continue", async () => {
  const { bridge, connect, cleanup } = await setup({ hardCapMs: 200 });
  try {
    const plugin = await connect();
    const result = bridge.sendWithParams("lint_run", undefined, undefined, undefined, 100);
    const req = await plugin.next();
    const beat = setInterval(() => heartbeat(plugin, [req.requestId]), 30);
    try {
      await assert.rejects(result, /ran past the 200ms hard cap/);
    } finally {
      clearInterval(beat);
    }
  } finally {
    cleanup();
  }
});

test("a response buffered across a reconnect still settles the request", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const first = await connect();
    const result = bridge.sendWithParams("create_frame", undefined, { name: "A" }, undefined, 2_000);
    const req = await first.next();
    first.close();
    await sleep(50);
    const second = await connect();
    // The UI flushes its outbox first, then the sync heartbeat (nothing left live).
    second.sendJson({ type: req.type, requestId: req.requestId, data: { id: "9:9" } });
    heartbeat(second, [], true);
    assert.deepEqual((await result).data, { id: "9:9" });
  } finally {
    cleanup();
  }
});

test("a reconnected plugin still running the request re-adopts it past the grace period", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const first = await connect();
    const result = bridge.sendWithParams("write_variables", undefined, { ops: [] }, undefined, 2_000);
    const req = await first.next();
    first.close();
    await sleep(50);
    const second = await connect();
    heartbeat(second, [req.requestId], true);
    await sleep(450); // longer than the 300ms reconnect grace
    second.sendJson({ type: req.type, requestId: req.requestId, data: { written: 0 } });
    assert.deepEqual((await result).data, { written: 0 });
  } finally {
    cleanup();
  }
});

test("a reconnected plugin that doesn't know the request fails it at once", async () => {
  const { bridge, connect, cleanup } = await setup({ reconnectGraceMs: 5_000 });
  try {
    const first = await connect();
    const result = bridge.sendWithParams("delete_nodes", ["1:2"], { confirm: true }, undefined, 10_000);
    await first.next();
    first.close();
    await sleep(50);
    const second = await connect();
    const t0 = Date.now();
    heartbeat(second, [], true);
    await assert.rejects(result, /Plugin reconnected without this request/);
    assert.ok(Date.now() - t0 < 1_000, "fails on the sync heartbeat, not after the 5s grace");
  } finally {
    cleanup();
  }
});

test("a request sent after the reconnect is not failed by the sync heartbeat", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const plugin = await connect();
    const result = bridge.sendWithParams("get_selection", undefined, undefined, undefined, 2_000);
    const req = await plugin.next();
    heartbeat(plugin, [], true); // sync races ahead of the new request reaching the plugin's main thread
    await sleep(50);
    plugin.sendJson({ type: req.type, requestId: req.requestId, data: [] });
    assert.deepEqual((await result).data, []);
  } finally {
    cleanup();
  }
});

test("no reconnect within the grace period fails the request", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const plugin = await connect();
    const result = bridge.sendWithParams("set_solid_fill", ["1:2"], { color: "#fff" }, undefined, 10_000);
    await plugin.next();
    plugin.close();
    await assert.rejects(result, /did not reconnect within 300ms/);
  } finally {
    cleanup();
  }
});

test("a cancel from the MCP client is passed on to the plugin", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const plugin = await connect();
    const client = new AbortController();
    const result = callContext.run({ signal: client.signal }, () =>
      bridge.sendWithParams("set_auto_layout", ["1:2"], { mode: "VERTICAL" }, undefined, 10_000)
    );
    const req = await plugin.next();
    client.abort();
    await assert.rejects(result, /Cancelled by the MCP client/);
    assert.deepEqual(await plugin.next(), { type: "cancel", requestId: req.requestId });
  } finally {
    cleanup();
  }
});

test("a call the MCP client already cancelled is never sent", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const plugin = await connect();
    const client = new AbortController();
    client.abort();
    await assert.rejects(
      callContext.run({ signal: client.signal }, () => bridge.send("get_selection")),
      /before it was sent/
    );
    const arrived = await Promise.race([plugin.next(), sleep(100).then(() => "nothing")]);
    assert.equal(arrived, "nothing");
  } finally {
    cleanup();
  }
});

test("plugin heartbeats are forwarded as MCP progress", async () => {
  const { bridge, connect, cleanup } = await setup();
  try {
    const plugin = await connect();
    let progress = 0;
    const result = callContext.run({ onProgress: () => progress++ }, () =>
      bridge.sendWithParams("lint_run", undefined, undefined, undefined, 2_000)
    );
    const req = await plugin.next();
    heartbeat(plugin, [req.requestId]);
    heartbeat(plugin, [req.requestId]);
    await sleep(50);
    plugin.sendJson({ type: req.type, requestId: req.requestId, data: {} });
    await result;
    assert.equal(progress, 2);
  } finally {
    cleanup();
  }
});
