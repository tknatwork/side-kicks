// The scripted client (client.ts) and figma-limitless-run (run.ts), against a
// real leader and a paired fake plugin: the protocol is the follower's, so a
// change to /rpc fails here instead of in someone's script.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import http from "node:http";
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
const { connect, decideAfterFailure, isLoopbackHost, neverSent } = await import("../dist/client.js");

const RUN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "run.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MARKED = /^\/\*limitless-apply:[0-9a-f-]{36}\*\//;

let leader;
let url;
/** Sockets of /rpc requests, so a test can cut one mid-call. */
const rpcSockets = new Set();
before(async () => {
  leader = new Leader(0);
  await leader.start();
  url = `http://127.0.0.1:${leader.server.address().port}`;
  leader.server.on("request", (req) => req.url === "/rpc" && rpcSockets.add(req.socket));
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
  // DNS names that only look like loopback resolve wherever their DNS points.
  for (const bad of [
    "http://192.168.1.20:1994",
    "http://127.example.com:1994",
    "http://127.0.0.1.nip.io:1994",
    "http://localhost.example.com:1994",
    "http://[::ffff:127.0.0.1]:1994",
  ]) {
    assert.throws(() => connect({ url: bad }), /not loopback/, bad);
  }
  for (const good of ["http://localhost:1994", "http://127.0.0.1:1994", "http://127.4.5.6:1994", "http://[::1]:1994"]) {
    assert.doesNotThrow(() => connect({ url: good }), good);
  }
  assert.throws(() => connect({ url: "https://localhost:1994" }), /speaks http/);
  assert.equal(isLoopbackHost("[::1]"), true);
  assert.equal(isLoopbackHost("::1"), true);
  assert.equal(isLoopbackHost("127.0.0.1.nip.io"), false);
});

test("withLock releases the lock when the job throws, and names the holder it refuses", async () => {
  const fig = connect({ url, agent: "t3" });
  const other = connect({ url, agent: "t3-other" });
  await assert.rejects(
    other.withLock("page:3", async () => {
      const refused = await fig.withLock("page:3", async () => "never");
      assert.equal(refused.lockRefused, true);
      assert.match(refused.holder, /^t3-other#\d+-[0-9a-f]{8}$/);
      throw new Error("boom");
    }),
    /boom/
  );
  assert.equal(await fig.withLock("page:3", async () => "mine"), "mine");
});

test("two withLock calls under one agent name exclude each other", async () => {
  // Every nx-run process uses one agent name: the lock must still keep them apart.
  const a = connect({ url, agent: "nx-run" });
  const b = connect({ url, agent: "nx-run" });
  const probe = connect({ url, agent: "t11-probe" });
  const outer = await a.withLock("page:11", async () => {
    const inner = await b.withLock("page:11", async () => "never");
    assert.equal(inner.lockRefused, true);
    assert.match(inner.holder, /^nx-run#/);
    // The refused call released nothing: the lock is still a's.
    assert.equal((await probe.call("acquire_lock", { name: "page:11", agent: "probe" })).acquired, false);
    return "outer";
  });
  assert.equal(outer, "outer");
  assert.equal(await b.withLock("page:11", async () => "b"), "b");
});

test("withLock renews the lock while the job runs, and reports a lock it lost", async () => {
  const fig = connect({ url, agent: "t12" });
  const other = connect({ url, agent: "t12-other" });
  const expiry = async (name) => Date.parse((await other.call("acquire_lock", { name, agent: "probe" })).expiresAt);
  const [first, later] = await fig.withLock(
    "page:12",
    async () => {
      const at = await expiry("page:12");
      await sleep(300);
      return [at, await expiry("page:12")];
    },
    { ttlSeconds: 5, renewEveryMs: 50 }
  );
  assert.ok(later > first, "renewals push the expiry out");

  const r = await fig.withLock(
    "page:13",
    async () => {
      await other.call("release_lock", { name: "page:13", agent: "admin", force: true });
      await other.call("acquire_lock", { name: "page:13", agent: "thief" });
      await sleep(200);
      return "done";
    },
    { ttlSeconds: 5, renewEveryMs: 50 }
  );
  assert.deepEqual(r, { lockLost: true, reason: "held by thief", result: "done" });
  // Its release named its own holder, so the thief's lock stands.
  assert.equal((await other.call("acquire_lock", { name: "page:13", agent: "thief" })).renewed, true);
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
  assert.match(ws.requests[0].params.code, MARKED);
  assert.ok(ws.requests[0].params.code.endsWith("*/return 6"));
});

test("decideAfterFailure trusts only an ok row carrying this attempt's marker", () => {
  const marker = "/*limitless-apply:0b6a3f8e-2c41-4d7a-9f10-5e2d8c7b1a90*/";
  const preview = (code) => JSON.stringify({ code });
  const row = (over) => ({ seq: 1, ts: "2026-11-02T10:00:05Z", agent: "a", tool: "execute_code", fileKey: "f", ok: true, durMs: 5, ...over });
  const reset = new Error("fetch failed (ECONNRESET)");
  const timedOut = new Error("Request timed out after 30000ms: no response or progress from the plugin for 30000ms.");
  assert.equal(decideAfterFailure(reset, [row({ preview: preview(`${marker}figma.currentPage.name = 'x'`) })], marker), "ran");
  // The live miss: a read of the same agent, newer than the write, journaled ok.
  assert.equal(decideAfterFailure(reset, [row({ preview: preview("return figma.currentPage.name") })], marker), "stop");
  assert.equal(decideAfterFailure(reset, [row({ preview: preview("/*limitless-apply:another*/x") })], marker), "stop");
  assert.equal(decideAfterFailure(timedOut, [row({ ok: false, preview: preview(`${marker}x`) })], marker), "stop");
  assert.equal(decideAfterFailure(reset, [], marker), "stop");
  assert.equal(decideAfterFailure(new Error('No plugin connected for fileKey "f".'), [], marker), "retry");
  assert.equal(decideAfterFailure(new Error("Multiple files connected. Specify a fileKey…"), [], marker), "retry");
  assert.equal(neverSent(new Error("Bridge closed")), false);
});

test("a write cut off after it was sent is 'stop', even with a newer ok read of the same agent", async () => {
  // Marked code is a write: hold it. Anything else is a read: answer it.
  const ws = await plugin("f9", (req) => (MARKED.test(req.params.code) ? undefined : { result: "read" }));
  const fig = connect({ url, agent: "t9", fileKey: "f9" });
  const parallelJob = connect({ url, agent: "t9", fileKey: "f9" });
  const pending = fig.apply("figma.currentPage.name = 'x'");
  while (!ws.requests.some((q) => MARKED.test(q.params.code))) await sleep(20);
  assert.equal(await parallelJob.readCode("return 1"), "read");
  for (const socket of rpcSockets) socket.destroy(); // the write's connection dies mid-call
  const r = await pending;
  assert.equal(r.ok, false);
  assert.equal(r.decision, "stop");
  assert.equal(ws.requests.filter((q) => MARKED.test(q.params.code)).length, 1);
});

test("a write whose answer was lost comes back recovered when its own row is ok", async () => {
  const ws = await plugin("f10", () => ({ result: "x".repeat(20_000) }));
  const fig = connect({ url, agent: "t10", fileKey: "f10", maxAnswerBytes: 8_000 });
  await assert.rejects(fig.readCode("return 'big'"), /answer is over 8000 bytes/);
  assert.deepEqual(await fig.apply("return 'big'"), { ok: true, result: undefined, recovered: true });
  assert.equal(ws.requests.filter((q) => MARKED.test(q.params.code)).length, 1);
});

test("a call after the leader dropped an idle connection still goes through", async () => {
  const fig = connect({ url, agent: "t14" });
  for (let i = 0; i < 20; i++) {
    await fig.call("list_files");
    // What the leader's keep-alive timer does to an idle socket, at the worst
    // moment: just before the next call would go out on it.
    leader.server.closeIdleConnections();
  }
  assert.ok(Array.isArray(await fig.call("list_files")));
});

test("with several files connected and no fileKey, nothing is sent and nothing waits", async () => {
  await plugin("f15a", () => ({ result: 1 }));
  const fig = connect({ url, agent: "t15" });
  const t0 = Date.now();
  const r = await fig.apply("figma.currentPage.name = 'x'");
  assert.equal(r.ok, false);
  assert.equal(r.decision, "retry");
  assert.match(r.error, /^Multiple files connected/);
  await assert.rejects(fig.readCode("return 1"), /^Error: Multiple files connected/);
  assert.equal(fig.stats.retries, 0);
  assert.equal(fig.stats.calls, 2);
  assert.ok(Date.now() - t0 < 2_000);
});

test("an answer that is not {data} or {error} fails with a clear error", async () => {
  const fake = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => res.end("null"));
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  try {
    const fig = connect({ url: `http://127.0.0.1:${fake.address().port}` });
    await assert.rejects(fig.call("list_files"), (err) => {
      assert.ok(!(err instanceof TypeError));
      assert.match(err.message, /no \{data\} or \{error\}: null/);
      return true;
    });
  } finally {
    fake.close();
  }
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

/** Run figma-limitless-run; resolves on any exit with the code and both streams. */
const runCli = (args) =>
  new Promise((resolve) => {
    execFile("node", [RUN, ...args], { maxBuffer: 8 * 2 ** 20 }, (err, stdout, stderr) =>
      resolve({ code: err ? err.code : 0, stdout, stderr })
    );
  });

/** stdout must be exactly one JSON line. */
const oneLine = (stdout) => {
  assert.ok(stdout.endsWith("\n"), "the line ends with a newline");
  assert.equal(stdout.indexOf("\n"), stdout.length - 1, "one line, nothing else");
  return JSON.parse(stdout);
};

const job = (name, source) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "limitless-run-")), `${name}.mjs`);
  writeFileSync(file, source);
  return file;
};

test("figma-limitless-run prints a large answer whole when stdout is a pipe", async () => {
  const big = job("big", "export default async () => 'x'.repeat(400_000);\n");
  const { code, stdout } = await runCli([big, "--url", url]);
  assert.equal(code, 0);
  assert.equal(oneLine(stdout).result.length, 400_000);
});

test("figma-limitless-run prints one JSON line for bad arguments, and exits 2", async () => {
  const ok = job("ok", "export default async () => 1;\n");
  for (const [args, error] of [
    [[], /^usage:/],
    [[ok, "--nope"], /Unknown option '--nope'/],
    [[ok, "--agent"], /--agent/],
    [[ok, "--agent="], /--agent needs a name/],
    [[ok, "--url", "not a url"], /^--url: Invalid URL/],
    [[ok, "--url", "http://127.0.0.1.nip.io:1994"], /^--url: .*not loopback/],
  ]) {
    const { code, stdout } = await runCli(args);
    assert.equal(code, 2, args.join(" "));
    const out = oneLine(stdout);
    assert.equal(out.ok, false);
    assert.match(out.error, error);
  }
});

test("figma-limitless-run reports a result that is not JSON as ran, not as failed", async () => {
  for (const source of [
    "export default async () => ({ n: 1n });\n",
    "export default async () => { const a = {}; a.self = a; return a; };\n",
  ]) {
    const { code, stdout } = await runCli([job("odd", source), "--url", url]);
    assert.equal(code, 0);
    const out = oneLine(stdout);
    assert.equal(out.ok, true);
    assert.equal(out.result, null);
    assert.match(out.resultError, /^the result is not JSON: /);
    assert.equal(typeof out.cost.calls, "number");
  }
});

test("figma-limitless-run keeps the job's own output off stdout", async () => {
  const chatty = job(
    "chatty",
    "export default async () => { console.log('log'); console.info('info'); console.debug('debug'); console.warn('warn'); process.stdout.write('raw\\n'); setTimeout(() => console.log('late'), 50); return 'done'; };\n"
  );
  const { code, stdout, stderr } = await runCli([chatty, "--url", url]);
  assert.equal(code, 0);
  assert.equal(oneLine(stdout).result, "done");
  for (const line of ["log", "info", "debug", "warn", "raw", "late"]) assert.match(stderr, new RegExp(`^${line}$`, "m"));
});

test("figma-limitless-run ends in one line when the job crashes, hangs or leaves a timer", async () => {
  const crash = job("crash", "export default async () => { setTimeout(() => { throw new Error('late boom'); }, 10); await new Promise((r) => setTimeout(r, 200)); return 'x'; };\n");
  let r = await runCli([crash, "--url", url]);
  assert.equal(r.code, 1);
  assert.match(oneLine(r.stdout).error, /^the job crashed: late boom/);

  const stuck = job("stuck", "export default () => new Promise(() => {});\n");
  r = await runCli([stuck, "--url", url]);
  assert.equal(r.code, 1);
  assert.match(oneLine(r.stdout).error, /never settled/);

  const lingering = job("lingering", "export default async () => { setInterval(() => {}, 1000); return 'kept'; };\n");
  const t0 = Date.now();
  r = await runCli([lingering, "--url", url]);
  assert.equal(r.code, 0);
  assert.equal(oneLine(r.stdout).result, "kept");
  assert.ok(Date.now() - t0 < 5_000, "a leftover timer does not hold the call");
});
