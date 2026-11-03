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
  /** Journaled with every call; also the lock holder name. */
  agent?: string;
  /** Default file for every call; required when several files are connected. */
  fileKey?: string;
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

export interface ConnectedFile {
  fileKey: string;
  fileName: string;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Failures raised before the request reached the plugin (bridge.ts
 *  resolveConnection / sendWithParams), or before the leader got it at all. */
const NEVER_SENT = [
  /^No plugin connected/,
  /^Plugin not connected/,
  /^Cancelled by the MCP client before it was sent/,
  /ECONNREFUSED/,
];

export const neverSent = (err: unknown): boolean => {
  const message = errorMessage(err);
  return NEVER_SENT.some((re) => re.test(message));
};

/**
 * Decide what a failed write did, from its error and the journal the leader
 * keeps. The leader journals a call when it answers it (leader.ts), so a row
 * newer than the call with ok:true means it finished even though this side
 * lost the answer. A timeout or a cancel journals ok:false and may still be
 * running in the plugin: that is "stop", never a guess.
 */
export function decideAfterFailure(
  err: unknown,
  entries: JournalEntry[],
  call: { agent: string; startedAt: number }
): FailureDecision {
  if (neverSent(err)) return "retry";
  const mine = entries.filter(
    (e) => e.agent === call.agent && e.tool === "execute_code" && Date.parse(e.ts) >= call.startedAt
  );
  const newest = mine[mine.length - 1];
  return newest && newest.ok ? "ran" : "stop";
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
  const parsed = new URL(url);
  if (!LOOPBACK_HOSTS.has(parsed.hostname) && !parsed.hostname.startsWith("127.")) {
    throw new Error(`the leader serves this machine only; ${parsed.hostname} is not loopback`);
  }
  const agent = options.agent ?? "script";
  const stats: ClientStats = { calls: 0, retries: 0, bytesIn: 0, startedAt: Date.now() };

  /** One RPC. Throws on a transport failure or an {error} answer. */
  async function call(tool: string, params?: Record<string, unknown>, opts: CallOptions = {}): Promise<unknown> {
    const req: RPCRequest = { tool, agent };
    if (params && Object.keys(params).length > 0) req.params = params;
    const fileKey = opts.fileKey ?? options.fileKey;
    if (fileKey) req.fileKey = fileKey;
    if (opts.timeoutMs) req.timeoutMs = opts.timeoutMs;
    stats.calls++;
    // The leader always answers by its hard cap (follower.ts waits the same).
    const res = await fetch(`${url}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(HARD_CAP_MS + 5_000),
    });
    const text = await res.text();
    stats.bytesIn += text.length;
    let body: { data?: unknown; error?: string };
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`leader returned status ${res.status}: ${text.slice(0, 200)}`);
    }
    if (body.error) throw new Error(body.error);
    if (!res.ok) throw new Error(`leader returned status ${res.status}`);
    return body.data;
  }

  async function ping(): Promise<{ status: string; version: string } | null> {
    try {
      const res = await fetch(`${url}/ping`, { signal: AbortSignal.timeout(2_000) });
      return res.ok ? ((await res.json()) as { status: string; version: string }) : null;
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
        if (!neverSent(err) || i >= attempts) throw err;
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
      const startedAt = Date.now() - 1_000; // journal timestamps are the leader's clock, same machine
      try {
        const data = (await call("execute_code", { code }, opts)) as { result?: unknown } | undefined;
        return { ok: true, result: data?.result };
      } catch (err) {
        const message = errorMessage(err);
        let entries: JournalEntry[] = [];
        if (!neverSent(err)) {
          const journal = (await read("get_journal", { agent, tool: "execute_code", limit: 20 }, opts).catch(
            () => null
          )) as { entries?: JournalEntry[] } | null;
          entries = journal?.entries ?? [];
        }
        const decision = decideAfterFailure(err, entries, { agent, startedAt });
        if (decision === "ran") return { ok: true, result: undefined, recovered: true };
        if (decision === "stop" || i >= attempts) return { ok: false, error: message, decision };
        stats.retries++;
        await waitForPlugin({ deadlineMs: waitMs, fileKey: opts.fileKey ?? options.fileKey });
      }
    }
  }

  /** Hold a TTL lock while fn runs; released in finally. */
  async function withLock<T>(
    name: string,
    fn: () => Promise<T>,
    { ttlSeconds = 120 } = {}
  ): Promise<T | { lockRefused: true; holder: string }> {
    const got = (await call("acquire_lock", { name, ttlSeconds })) as { acquired: boolean; holder?: string };
    if (!got.acquired) return { lockRefused: true, holder: got.holder ?? "unknown" };
    try {
      return await fn();
    } finally {
      await call("release_lock", { name }).catch(() => undefined); // the TTL frees it anyway
    }
  }

  return { url, agent, stats, call, ping, waitForPlugin, read, readCode, apply, withLock };
}

export type Client = ReturnType<typeof connect>;
