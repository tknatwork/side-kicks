// The leader on :1994 serves this machine's plugin and MCP clients only.
// /rpc runs any tool (execute_code included), so the network and web pages
// open in the user's browser must be refused, while the real follower and the
// Figma plugin (sandboxed iframe, Origin "null") still get through.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { WebSocket } from "ws";

// Keep the orchestrator's journal/checkpoint state out of the real home dir.
process.env.HOME = mkdtempSync(path.join(tmpdir(), "limitless-access-"));
const { Leader } = await import("../dist/leader.js");
const { Follower } = await import("../dist/follower.js");
const { isLoopbackAddress, rpcDenial, upgradeDenial } = await import("../dist/access.js");

let leader;
let base;
before(async () => {
  leader = new Leader(0);
  await leader.start();
  base = `http://127.0.0.1:${leader.server.address().port}`;
});
after(() => leader.stop());

const rpc = (headers, body = JSON.stringify({ tool: "list_files" })) =>
  fetch(`${base}/rpc`, { method: "POST", headers, body });

const wsOutcome = (origin) =>
  new Promise((resolve) => {
    const ws = new WebSocket(`${base.replace("http", "ws")}/ws?fileKey=f&fileName=F`, {
      ...(origin === undefined ? {} : { origin }),
    });
    ws.on("open", () => {
      ws.terminate();
      resolve("open");
    });
    ws.on("unexpected-response", (_req, res) => resolve(res.statusCode));
    ws.on("error", () => resolve("error"));
  });

test("the follower's own requests still work", async () => {
  const follower = new Follower(base);
  assert.deepEqual(await follower.listConnectedFiles(), []);
  assert.equal(await follower.ping(), true);
});

test("a cross-site browser POST to /rpc is refused", async () => {
  const res = await rpc({ "Content-Type": "application/json", Origin: "https://evil.example" });
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /browser requests are not accepted/);
});

test("a no-preflight text/plain POST to /rpc is refused", async () => {
  const res = await rpc({ "Content-Type": "text/plain" });
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /Content-Type must be application\/json/);
});

test("a web page cannot open the plugin socket; the plugin and local clients can", async () => {
  assert.equal(await wsOutcome("https://evil.example"), 403);
  assert.equal(await wsOutcome("https://www.figma.com.evil.example"), 403);
  assert.equal(await wsOutcome("null"), "open");
  assert.equal(await wsOutcome("https://www.figma.com"), "open");
  assert.equal(await wsOutcome(undefined), "open");
});

test("peers on the network are refused", () => {
  for (const addr of ["127.0.0.1", "127.0.1.1", "::1", "::ffff:127.0.0.1"]) {
    assert.equal(isLoopbackAddress(addr), true, addr);
  }
  for (const addr of ["192.168.1.20", "10.0.0.5", "::ffff:192.168.1.20", "fe80::1", undefined]) {
    assert.equal(isLoopbackAddress(addr), false, String(addr));
  }
  const fromLan = {
    socket: { remoteAddress: "192.168.1.20" },
    headers: { "content-type": "application/json" },
  };
  assert.match(rpcDenial(fromLan), /not on this machine/);
  assert.match(upgradeDenial(fromLan), /not on this machine/);
});
