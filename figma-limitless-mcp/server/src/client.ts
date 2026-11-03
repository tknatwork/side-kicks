import { randomUUID } from "node:crypto";
import http from "node:http";
import { isIP } from "node:net";
import { HARD_CAP_MS } from "./bridge.js";
import type { JournalEntry } from "./orchestration.js";
import { PORT } from "./port.js";
import type { RPCRequest } from "./types.js";

/**
 * Scripted client: drive the leader from a script, so a multi-step job is one
 * tool call for the agent instead of one per step.
 *
 * It speaks the followers' protocol (follower.ts): POST /rpc with a JSON
 * RPCRequest, no Origin header (access.ts refuses browsers), answered with
 * {data} or {error}. Results stay in the script; it returns only what the
 * agent needs to see.
 *
 * Reads and writes fail differently. A read is retried after a failure that
 * means "the plugin wasn't there". A write is never re-sent blindly: a
 * timeout means it may still finish (bridge.ts), so `apply` re-sends only
 * when the request provably never reached the plugin.
 */

export interface ClientOptions {
  /** Leader URL. Loopback only — the leader serves nothing else. */
  url?: string;
  /** Journaled with every call; the start of every lock holder name. */
  agent?: string;
  /** Default file for every call; required when several files are connected. */
  fileKey?: string;
  /** Largest answer read from the leader; a bigger one fails the call. */
  maxAnswerBytes?: number;
}

export interface CallOptions {
  fileKey?: string;
  /** Stall window on the leader (bridge.ts), not a total deadline. */
  timeoutMs?: number;
}

export interface ClientStats {
  calls: number;
  retries: number;
  bytesIn: number;
  startedAt: number;
}

export type ApplyResult =
  /** `recovered`: this side lost the answer, the journal says it finished — verify with a read. */
  | { ok: true; result: unknown; recovered?: true }
  | { ok: false; error: string; decision?: FailureDecision };

/** After a write failed: it finished, it can be sent again, or nobody can tell. */
export type FailureDecision = "ran" | "retry" | "stop";

/** withLock did not run the job: someone else holds the lock. */
export interface LockRefused {
  lockRefused: true;
  holder: string;
}

/** withLock ran the job, but a renewal found the lock gone part-way through. */
export interface LockLost<T> {
  lockLost: true;
  reason: string;
  result: T;
}

export interface ConnectedFile {
  fileKey: string;
  fileName: string;
}

/** Above the most the leader can relay: ws caps a plugin message at 100 MiB. */
const MAX_ANSWER_BYTES = 128 * 2 ** 20;

/** Journal rows read back after a failed write; its own row is among the newest. */
const JOURNAL_SCAN = 200;

/** Failures raised before the request reached the plugin (bridge.ts
 *  resolveConnection / sendWithParams), or before the leader got it at all. */
const NEVER_SENT = [
  /^No plugin connected/,
  /^Plugin not connected/,
  /^Cancelled by the MCP client before it was sent/,
  /^Multiple files connected/,
  /^leader not reachable at /,
];

/** Never sent, but waiting for a plugin cannot fix it: the call must name a file. */
const NEEDS_FILE_KEY = /^Multiple files connected/;

export const neverSent = (err: unknown): boolean => {
  const message = errorMessage(err);
  return NEVER_SENT.some((re) => re.test(message));
};

const needsFileKey = (err: unknown): boolean => NEEDS_FILE_KEY.test(errorMessage(err));

/**
 * Marks one `apply` attempt. It leads the code, so it leads the journal's
 * preview of the call (JSON of the params, cut at 500 chars), and has nothing
 * JSON escapes, so the preview holds it verbatim.
 */
const applyMarker = (): string => `/*limitless-apply:${randomUUID()}*/`;

/**
 * Decide what a failed write did, from its error and the journal the leader
 * keeps. The leader journals a call when it answers it (leader.ts), so an
 * ok:true row carrying this attempt's marker means it finished even though
 * this side lost the answer. Any other row proves nothing: reads are
 * journaled as execute_code too, and a parallel job may share the agent
 * name. A timeout or a cancel journals ok:false and may still be running in
 * the plugin: that is "stop", never a guess.
 */
export function decideAfterFailure(err: unknown, entries: JournalEntry[], marker: string): FailureDecision {
  if (neverSent(err)) return "retry";
  const ran = entries.some((e) => e.ok && e.tool === "execute_code" && e.preview?.includes(marker));
  return ran ? "ran" : "stop";
}

/** localhost, or an IP literal in 127.0.0.0/8 or ::1. A name that only looks
 *  like one (127.0.0.1.nip.io) resolves wherever its DNS points. */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[(.*)\]$/, "$1");
  if (host === "localhost") return true;
  switch (isIP(host)) {
    case 4:
      return host.split(".")[0] === "127";
    case 6:
      return host === "::1";
    default:
      return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: { code?: string } }).cause;
    return cause?.code ? `${err.message} (${cause.code})` : err.message;
  }
  return String(err);
}

export function connect(options: ClientOptions = {}) {
  const url = options.url ?? `http://localhost:${PORT}`;
  const base = new URL(url);
  if (base.protocol !== "http:") {
    throw new Error(`the leader speaks http, not ${base.protocol.replace(/:$/, "")}`);
  }
  if (!isLoopbackHost(base.hostname)) {
    throw new Error(`the leader serves this machine only; ${base.hostname} is not loopback`);
  }
  const agent = options.agent ?? "script";
  const maxAnswerBytes = options.maxAnswerBytes ?? MAX_ANSWER_BYTES;
  const stats: ClientStats = { calls: 0, retries: 0, bytesIn: 0, startedAt: Date.now() };

  /**
   * One HTTP exchange on a fresh connection, closed after the answer. A
   * pooled keep-alive socket the leader has already closed (its idle timeout,
   * a sleeping Mac, a blocked event loop here) fails the next call after it
   * was sent, which `apply` must then call "stop". On loopback a new
   * connection costs next to nothing.
   */
  function exchange(
    method: "GET" | "POST",
    path: string,
    body: string | undefined,
    timeoutMs: number
  ): Promise<{ status: number; text: string; bytes: number }> {
    return new Promise((resolve, reject) => {
      const signal = AbortSignal.timeout(timeoutMs);
      let connected = false;
      let settled = false;
      const settle = (err: Error | null, answer?: { status: number; text: string; bytes: number }) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve(answer!);
      };
      const req = http.request(new URL(path, base), {
        method,
        agent: false,
        headers: body === undefined ? {} : { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        signal,
      });
      req.on("socket", (socket) => {
        if (socket.connecting) socket.once("connect", () => (connected = true));
        else connected = true;
      });
      req.on("error", (err) => {
        // Nothing was written before the connection opened: the leader never saw it.
        if (!connected) settle(new Error(`leader not reachable at ${base.origin}: ${err.message}`));
        else settle(signal.aborted ? new Error(`no answer from the leader in ${timeoutMs} ms`) : err);
      });
      req.on("response", (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxAnswerBytes) {
            settle(new Error(`the leader's answer is over ${maxAnswerBytes} bytes; ask for less in one call`));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => settle(null, { status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8"), bytes }));
        res.on("error", (err) => settle(err));
        res.on("close", () => settle(new Error("the leader closed the connection before it finished answering")));
      });
      req.end(body);
    });
  }

  /** One RPC. Throws on a transport failure or an {error} answer. */
  async function call(tool: string, params?: Record<string, unknown>, opts: CallOptions = {}): Promise<unknown> {
    const req: RPCRequest = { tool, agent };
    if (params && Object.keys(params).length > 0) req.params = params;
    const fileKey = opts.fileKey ?? options.fileKey;
    if (fileKey) req.fileKey = fileKey;
    if (opts.timeoutMs) req.timeoutMs = opts.timeoutMs;
    stats.calls++;
    // The leader always answers by its hard cap (follower.ts waits the same).
    const { status, text, bytes } = await exchange("POST", "/rpc", JSON.stringify(req), HARD_CAP_MS + 5_000);
    stats.bytesIn += bytes;
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`leader returned status ${status}: ${text.slice(0, 200)}`);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error(`leader returned status ${status} and no {data} or {error}: ${text.slice(0, 200)}`);
    }
    const answer = body as { data?: unknown; error?: unknown };
    if (answer.error) throw new Error(String(answer.error));
    if (status !== 200) throw new Error(`leader returned status ${status}`);
    return answer.data;
  }

  async function ping(): Promise<{ status: string; version: string } | null> {
    try {
      const { status, text } = await exchange("GET", "/ping", undefined, 2_000);
      return status === 200 ? (JSON.parse(text) as { status: string; version: string }) : null;
    } catch {
      return null;
    }
  }

  /** Poll until the file (or, with no fileKey, any file) is connected; [] at the deadline. */
  async function waitForPlugin({
    deadlineMs = 20_000,
    everyMs = 500,
    fileKey = options.fileKey,
  }: { deadlineMs?: number; everyMs?: number; fileKey?: string } = {}): Promise<ConnectedFile[]> {
    const until = Date.now() + deadlineMs;
    for (;;) {
      try {
        const files = ((await call("list_files")) as ConnectedFile[] | undefined) ?? [];
        if (fileKey ? files.some((f) => f.fileKey === fileKey) : files.length > 0) return files;
      } catch (err) {
        if (!neverSent(err)) throw err;
      }
      if (Date.now() >= until) return [];
      await sleep(everyMs);
    }
  }

  /** A read: safe to repeat, so a never-sent failure waits for the plugin and retries. */
  async function read(
    tool: string,
    params?: Record<string, unknown>,
    opts: CallOptions = {},
    { attempts = 3, waitMs = 10_000 } = {}
  ): Promise<unknown> {
    for (let i = 1; ; i++) {
      try {
        return await call(tool, params, opts);
      } catch (err) {
        if (!neverSent(err) || needsFileKey(err) || i >= attempts) throw err;
        stats.retries++;
        await waitForPlugin({ deadlineMs: waitMs, fileKey: opts.fileKey ?? options.fileKey });
      }
    }
  }

  /** Plugin API code that must not change the document. Returns its value. */
  async function readCode(code: string, opts: CallOptions = {}): Promise<unknown> {
    const data = (await read("execute_code", { code }, opts)) as { result?: unknown } | undefined;
    return data?.result;
  }

  /** Plugin API code that changes the document. Never re-sent unless it never left. */
  async function apply(code: string, opts: CallOptions = {}, { attempts = 3, waitMs = 10_000 } = {}): Promise<ApplyResult> {
    for (let i = 1; ; i++) {
      const marker = applyMarker(); // a new one per attempt: only this send's row can vouch for it
      try {
        const data = (await call("execute_code", { code: marker + code }, opts)) as { result?: unknown } | undefined;
        return { ok: true, result: data?.result };
      } catch (err) {
        const message = errorMessage(err);
        let entries: JournalEntry[] = [];
        if (!neverSent(err)) {
          const journal = (await read("get_journal", { agent, tool: "execute_code", limit: JOURNAL_SCAN }, opts).catch(
            () => null
          )) as { entries?: JournalEntry[] } | null;
          entries = journal?.entries ?? [];
        }
        const decision = decideAfterFailure(err, entries, marker);
        if (decision === "ran") return { ok: true, result: undefined, recovered: true };
        if (decision === "stop" || needsFileKey(err) || i >= attempts) return { ok: false, error: message, decision };
        stats.retries++;
        await waitForPlugin({ deadlineMs: waitMs, fileKey: opts.fileKey ?? options.fileKey });
      }
    }
  }

  /**
   * Hold a TTL lock while fn runs, renewed every half TTL, released in finally.
   * The holder is unique to this call, so two jobs under one agent name exclude
   * each other, and neither can release the other's lock.
   */
  async function withLock<T>(
    name: string,
    fn: () => Promise<T>,
    { ttlSeconds = 120, renewEveryMs = ttlSeconds * 500 }: { ttlSeconds?: number; renewEveryMs?: number } = {}
  ): Promise<T | LockRefused | LockLost<T>> {
    type LockAnswer = { acquired: boolean; renewed?: boolean; holder?: string };
    const holder = `${agent}#${process.pid}-${randomUUID().slice(0, 8)}`;
    const take = () => call("acquire_lock", { name, agent: holder, ttlSeconds }) as Promise<LockAnswer>;

    const got = await take();
    if (!got.acquired) return { lockRefused: true, holder: got.holder ?? "unknown" };

    let lost: string | undefined;
    let done = false;
    let timer: NodeJS.Timeout | undefined;
    let renewing: Promise<void> | undefined;
    const renew = async () => {
      try {
        const again = await take();
        if (!again.acquired) lost = `held by ${again.holder ?? "unknown"}`;
        else if (!again.renewed) lost = "it lapsed before it was renewed";
      } catch {
        // No answer: the next renewal tries again before the TTL runs out.
      }
      if (!lost && !done) schedule();
    };
    const schedule = () => {
      timer = setTimeout(() => (renewing = renew()), renewEveryMs);
      timer.unref();
    };
    schedule();
    try {
      const result = await fn();
      return lost ? { lockLost: true, reason: lost, result } : result;
    } finally {
      done = true;
      clearTimeout(timer);
      await renewing; // a renewal landing after the release would take the lock back
      await call("release_lock", { name, agent: holder }).catch(() => undefined); // the TTL frees it anyway
    }
  }

  return { url, agent, stats, call, ping, waitForPlugin, read, readCode, apply, withLock };
}

export type Client = ReturnType<typeof connect>;
