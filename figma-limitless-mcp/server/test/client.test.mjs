// The scripted client (client.ts) and figma-limitless-run (run.ts), against a
// real leader and a paired fake plugin: the protocol is the follower's, so a
// change to /rpc fails here instead of in someone's script.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { WebSocket } from "ws";

// The pairing code and the journal live under HOME: keep them out of the real one.
process.env.HOME = mkdtempSync(path.join(tmpdir(), "limitless-client-"));
delete process.env.LIMITLESS_PAIRING;
const pairing = await import("../dist/pairing.js");
const { Leader } = await import("../dist/leader.js");
const { connect, decideAfterFailure, neverSent } = await import("../dist/client.js");

const RUN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "run.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let leader;
let url;
before(async () => {
  leader = new Leader(0);
  await leader.start();
  url = `http://127.0.0.1:${leader.server.address().port}`;
});
const sockets = [];
after(() => {
  sockets.forEach((ws) => ws.terminate());
  leader.stop();
});

/** A paired fake plugin for one file. `answer(req)` returns data, or undefined to stay silent. */
const plugin = async (fileKey, answer) => {
  const query = new URLSearchParams({ fileKey, fileName: fileKey, token: pairing.getPairingCode() });
  const ws = new WebSocket(`${url.replace("http", "ws")}/ws?${query}`);
  sockets.push(ws);
  ws.requests = [];
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (!msg.requestId || msg.type === "cancel") return;
    ws.requests.push(msg);
    const data = answer(msg);
    if (data !== undefined) ws.send(JSON.stringify({ type: msg.type, requestId: msg.requestId, data }));
  });
  await new Promise((resolve) => ws.on("message", (raw) => JSON.parse(raw.toString()).type === "paired" && resolve()));
  return ws;
};

test("readCode reaches a paired plugin through the real leader and returns its value", async () => {
  const ws = await plugin("f1", (req) => ({ result: { saw: req.params.code } }));
  const fig = connect({ url, agent: "t1", fileKey: "f1" });
  assert.deepEqual(await fig.readCode("return 1"), { saw: "return 1" });
  assert.equal(ws.requests.length, 1);
  const journal = await fig.call("get_journal", { agent: "t1" });
  assert.equal(journal.entries.at(-1).tool, "execute_code");
  assert.equal(journal.entries.at(-1).ok, true);
});

test("the client refuses a leader that is not on this machine", () => {
  assert.throws(() => connect({ url: "http://192.168.1.20:1994" }), /not loopback/);
  assert.doesNotThrow(() => connect({ url: "http://[::1]:1994" }));
});

test("withLock releases the lock when the job throws, and names the holder it refuses", async () => {
  const fig = connect({ url, agent: "t3" });
  const other = connect({ url, agent: "t3-other" });
  await assert.rejects(
    other.withLock("page:3", async () => {
      assert.deepEqual(await fig.withLock("page:3", async () => "never"), { lockRefused: true, holder: "t3-other" });
      throw new Error("boom");
    }),
    /boom/
  );
  assert.equal(await fig.withLock("page:3", async () => "mine"), "mine");
});

test("a read waits for its file and retries a call that never reached the plugin", async () => {
  const fig = connect({ url, agent: "t4", fileKey: "f4" });
  const pending = fig.readCode("return 4");
  await sleep(300);
  await plugin("f4", () => ({ result: 4 }));
  assert.equal(await pending, 4);
  assert.ok(fig.stats.retries >= 1);
});

test("apply never re-sends a write that may still be running", async () => {
  const ws = await plugin("f5", () => undefined); // takes the edit, never answers
  const fig = connect({ url, agent: "t5", fileKey: "f5" });
  const r = await fig.apply("figma.currentPage.name = 'x'", { timeoutMs: 1000 });
  assert.equal(r.ok, false);
  assert.equal(r.decision, "stop");
  assert.match(r.error, /timed out/);
  assert.equal(ws.requests.filter((q) => q.type === "execute_code").length, 1);
});

test("apply re-sends a write that never left, exactly once", async () => {
  const fig = connect({ url, agent: "t6", fileKey: "f6" });
  const pending = fig.apply("return 6");
  await sleep(300);
  const ws = await plugin("f6", () => ({ result: 6 }));
  assert.deepEqual(await pending, { ok: true, result: 6 });
  assert.equal(ws.requests.length, 1);
});

test("decideAfterFailure trusts only a newer ok row of this agent", () => {
  const call = { agent: "a", startedAt: Date.parse("2026-11-02T10:00:00Z") };
  const row = (over) => ({ seq: 1, ts: "2026-11-02T10:00:05Z", agent: "a", tool: "execute_code", fileKey: "f", ok: true, durMs: 5, ...over });
  const timedOut = new Error("Request timed out after 30000ms: no response or progress from the plugin for 30000ms.");
  assert.equal(decideAfterFailure(timedOut, [row({})], call), "ran");
  assert.equal(decideAfterFailure(timedOut, [row({ ok: false })], call), "stop");
  assert.equal(decideAfterFailure(timedOut, [row({ agent: "b" })], call), "stop");
  assert.equal(decideAfterFailure(timedOut, [row({ ts: "2026-11-02T09:59:00Z" })], call), "stop");
  assert.equal(decideAfterFailure(new Error('No plugin connected for fileKey "f".'), [], call), "retry");
  assert.equal(neverSent(new Error("Bridge closed")), false);
});

test("figma-limitless-run prints the script's answer as one line, and a throw as ok:false", async () => {
  await plugin("f8", () => ({ result: 8 }));
  const dir = mkdtempSync(path.join(tmpdir(), "limitless-run-"));
  const job = path.join(dir, "job.mjs");
  writeFileSync(job, "export default async (fig, args) => ({ args, v: await fig.readCode('return 8') });\n");
  const { stdout } = await promisify(execFile)("node", [RUN, job, "--url", url, "--file", "f8", "--", "a", "b"]);
  const out = JSON.parse(stdout);
  assert.deepEqual(out.result, { args: ["a", "b"], v: 8 });
  assert.equal(out.ok, true);
  assert.equal(out.cost.calls, 1);

  const bad = path.join(dir, "bad.mjs");
  writeFileSync(bad, "export default async () => { throw new Error('nope'); };\n");
  await assert.rejects(promisify(execFile)("node", [RUN, bad, "--url", url]), (err) => {
    assert.equal(err.code, 1);
    assert.deepEqual(JSON.parse(err.stdout).error, "nope");
    return true;
  });
});
