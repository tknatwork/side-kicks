// The plugin socket is only trusted once the plugin presents the pairing code.
// Origin can't tell the real plugin from a web page (both send "null"), so a
// socket without the code is held apart: never routed to, never replacing the
// real plugin, its messages ignored, and callers told how to pair.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { WebSocket } from "ws";

// The code lives under HOME: keep it (and the journal) out of the real one.
process.env.HOME = mkdtempSync(path.join(tmpdir(), "limitless-pairing-"));
delete process.env.LIMITLESS_PAIRING;
const pairing = await import("../dist/pairing.js");
const { Leader } = await import("../dist/leader.js");
const { Follower } = await import("../dist/follower.js");

const CODE_SHAPE = /^[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){3}$/;

let leader;
let base;
let follower;
before(async () => {
  leader = new Leader(0);
  await leader.start();
  base = `http://127.0.0.1:${leader.server.address().port}`;
  follower = new Follower(base);
});
after(() => leader.stop());

const sockets = [];
after(() => sockets.forEach((ws) => ws.terminate()));

/** A fake plugin: resolves once open, with an inbox of server messages. */
const plugin = async ({ fileKey = "f1", fileName = "File", token } = {}) => {
  const query = new URLSearchParams({ fileKey, fileName });
  if (token !== undefined) query.set("token", token);
  const ws = new WebSocket(`${base.replace("http", "ws")}/ws?${query}`);
  sockets.push(ws);
  const inbox = [];
  const waiters = [];
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    const w = waiters.shift();
    if (w) w(msg);
    else inbox.push(msg);
  });
  ws.next = (ms = 1000) =>
    inbox.length > 0
      ? Promise.resolve(inbox.shift())
      : new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error("no message")), ms);
          waiters.push((m) => {
            clearTimeout(t);
            resolve(m);
          });
        });
  ws.sendJson = (obj) => ws.send(JSON.stringify(obj));
  await once(ws, "open");
  return ws;
};

const closed = async (ws) => {
  if (ws.readyState !== WebSocket.CLOSED) {
    const done = once(ws, "close");
    ws.terminate();
    await done;
  }
  // Let the leader see the close before the next test looks at connections.
  await new Promise((r) => setTimeout(r, 30));
};

test("the code is created once, private to the user, and stable", () => {
  const code = pairing.getPairingCode();
  assert.match(code, CODE_SHAPE);
  assert.equal(pairing.getPairingCode(), code);
  const file = pairing.pairingTokenPath();
  assert.equal(file, path.join(process.env.HOME, ".figma-limitless-mcp", "pairing-token"));
  assert.equal(readFileSync(file, "utf8").trim(), code);
  if (process.platform !== "win32") assert.equal(statSync(file).mode & 0o777, 0o600);
});

test("a code is accepted however it is typed, and nothing else is", () => {
  const code = pairing.getPairingCode();
  assert.equal(pairing.isValidPairingCode(code), true);
  assert.equal(pairing.isValidPairingCode(code.toLowerCase()), true);
  assert.equal(pairing.isValidPairingCode(code.replace(/-/g, "")), true);
  assert.equal(pairing.isValidPairingCode(` ${code.replace(/-/g, " ")} `), true);
  assert.equal(pairing.isValidPairingCode(code.slice(0, -1)), false);
  assert.equal(pairing.isValidPairingCode(""), false);
  assert.equal(pairing.isValidPairingCode(null), false);
  assert.equal(pairing.isValidPairingCode(undefined), false);
});

test("a garbled file is replaced, and an unusable one fails closed", async () => {
  const file = pairing.pairingTokenPath();
  const before = pairing.getPairingCode();
  writeFileSync(file, "??\n");
  const replaced = pairing.getPairingCode();
  assert.match(replaced, CODE_SHAPE);
  assert.equal(readFileSync(file, "utf8").trim(), replaced);
  assert.equal(pairing.isValidPairingCode(before), false);

  // A directory where the file should be: no code can be read or made.
  rmSync(file);
  mkdirSync(file);
  try {
    assert.equal(pairing.isValidPairingCode(replaced), false);
    const ws = await plugin({ fileKey: "f0", token: replaced });
    assert.deepEqual(await ws.next(), { type: "pairing-required" });
    await closed(ws);
  } finally {
    rmSync(file, { recursive: true });
  }
  pairing.getPairingCode();
});

test("the paired plugin is told so and gets requests", async () => {
  const ws = await plugin({ token: pairing.getPairingCode() });
  try {
    assert.deepEqual(await ws.next(), { type: "paired" });
    assert.deepEqual(await follower.listConnectedFiles(), [{ fileKey: "f1", fileName: "File" }]);
    const result = follower.send("get_metadata", undefined, "f1");
    const req = await ws.next();
    assert.equal(req.type, "get_metadata");
    ws.sendJson({ type: req.type, requestId: req.requestId, data: { ok: true } });
    assert.deepEqual((await result).data, { ok: true });
  } finally {
    await closed(ws);
  }
});

test("a socket with a wrong or no code is held apart and callers learn why", async () => {
  for (const token of ["WRNG-CODE-WRNG-CODE", undefined]) {
    const ws = await plugin({ fileKey: "f2", fileName: "Page posing as plugin", token });
    try {
      assert.deepEqual(await ws.next(), { type: "pairing-required" });
      assert.deepEqual(await follower.listConnectedFiles(), []);
      await assert.rejects(follower.send("get_metadata", undefined, "f2"), (err) => {
        assert.match(err.message, /No plugin connected for fileKey "f2"/);
        assert.match(err.message, /"Page posing as plugin" but isn't paired/);
        assert.match(err.message, /get_pairing_code/);
        return true;
      });
      await assert.rejects(follower.send("get_metadata"), /isn't paired/);
    } finally {
      await closed(ws);
    }
  }
  // Gone once the socket closes.
  await assert.rejects(follower.send("get_metadata"), (err) => {
    assert.match(err.message, /No plugin connected/);
    assert.doesNotMatch(err.message, /isn't paired/);
    return true;
  });
});

test("an unpaired socket can't displace the plugin or answer its requests", async () => {
  const real = await plugin({ fileKey: "f3", fileName: "Real", token: pairing.getPairingCode() });
  assert.deepEqual(await real.next(), { type: "paired" });
  const imposter = await plugin({ fileKey: "f3", fileName: "Imposter" });
  try {
    assert.deepEqual(await imposter.next(), { type: "pairing-required" });
    assert.equal(real.readyState, WebSocket.OPEN);
    assert.deepEqual(await follower.listConnectedFiles(), [{ fileKey: "f3", fileName: "Real" }]);

    const result = follower.send("get_metadata", undefined, "f3");
    const req = await real.next();
    // Even knowing the request id, a forged answer is dropped...
    imposter.sendJson({ type: req.type, requestId: req.requestId, data: { forged: true } });
    imposter.sendJson({ type: "progress", payload: { requestIds: [req.requestId] } });
    await new Promise((r) => setTimeout(r, 50));
    // ...and the real plugin's answer is the one the caller gets.
    real.sendJson({ type: req.type, requestId: req.requestId, data: { real: true } });
    assert.deepEqual((await result).data, { real: true });
  } finally {
    await closed(imposter);
    await closed(real);
  }
});

test("a rotated code locks out plugins paired with the old one", async () => {
  const old = pairing.getPairingCode();
  const fresh = pairing.rotatePairingCode();
  assert.match(fresh, CODE_SHAPE);
  assert.notEqual(fresh, old);
  assert.equal(pairing.isValidPairingCode(old), false);
  const ws = await plugin({ fileKey: "f4", token: old });
  try {
    assert.deepEqual(await ws.next(), { type: "pairing-required" });
  } finally {
    await closed(ws);
  }
});

test("LIMITLESS_PAIRING=off trusts every plugin, without telling old ones anything", async () => {
  process.env.LIMITLESS_PAIRING = "off";
  try {
    assert.equal(pairing.isValidPairingCode(undefined), true);
    const legacy = await plugin({ fileKey: "f5", fileName: "Legacy" });
    try {
      await assert.rejects(legacy.next(150), /no message/);
      assert.deepEqual(await follower.listConnectedFiles(), [{ fileKey: "f5", fileName: "Legacy" }]);
    } finally {
      await closed(legacy);
    }
  } finally {
    delete process.env.LIMITLESS_PAIRING;
  }
});

// ---- the get_pairing_code tool, through the MCP SDK ------------------------
const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
const { registerTools } = await import("../dist/tools.js");

const fakeNode = {
  agentSupplier: null,
  listConnectedFiles: () => [],
  send: async () => {
    throw new Error("no plugin round-trip expected");
  },
  sendWithParams: async () => {
    throw new Error("no plugin round-trip expected");
  },
};

test("get_pairing_code returns the file's code, and rotate replaces it", async () => {
  const server = new McpServer({ name: "t", version: "0" });
  registerTools(server, fakeNode, 0);
  const client = new Client({ name: "c", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  const call = async (args) => {
    const res = await client.callTool({ name: "get_pairing_code", arguments: args });
    assert.equal(res.isError, undefined, res.content?.[0]?.text);
    return JSON.parse(res.content[0].text);
  };
  try {
    const got = await call({});
    assert.equal(got.code, readFileSync(pairing.pairingTokenPath(), "utf8").trim());
    assert.equal(got.file, pairing.pairingTokenPath());
    assert.match(got.howTo, /plugin/);

    const rotated = await call({ rotate: true });
    assert.equal(rotated.rotated, true);
    assert.notEqual(rotated.code, got.code);
    assert.equal(pairing.isValidPairingCode(got.code), false);
    assert.equal(pairing.isValidPairingCode(rotated.code), true);

    process.env.LIMITLESS_PAIRING = "off";
    try {
      assert.equal((await call({})).pairing, "off");
    } finally {
      delete process.env.LIMITLESS_PAIRING;
    }
  } finally {
    await client.close();
    await server.close();
  }
});
