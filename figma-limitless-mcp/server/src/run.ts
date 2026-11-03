#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { type Client, connect, errorMessage } from "./client.js";

/**
 * figma-limitless-run: run one script against the leader and print one line
 * of JSON. The agent makes a single tool call; every step, retry, poll and
 * lock happens inside the script.
 *
 *   figma-limitless-run job.mjs [--agent name] [--file fileKey] [--url url] [-- args…]
 *
 * job.mjs default-exports `async (fig, args) => answer`, where `fig` is a
 * connected client (client.ts). Return a summary, not raw data: the line is
 * what the agent reads. stdout carries that line and nothing else, whatever
 * happens; anything the job prints goes to stderr. Exit 0 iff ok:
 *
 *   {"ok":true,"result":…,"cost":{…}}                   0  the job returned
 *   {"ok":true,"result":null,"resultError":…,"cost":…}  0  it returned, but not JSON (a BigInt, a cycle)
 *   {"ok":false,"error":…,"cost":{…}}                   1  it threw, crashed, or never settled
 *   {"ok":false,"error":…}                              2  bad arguments or --url: nothing ran
 */

const USAGE = "usage: figma-limitless-run <script.mjs> [--agent name] [--file fileKey] [--url url] [-- args…]";

// The one line goes out through the real stdout; from here on, everything
// else written to stdout (console.log/info/debug included) lands on stderr.
const writeLine = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write;

let finished = false;
let fig: Client | undefined;

const cost = () => {
  if (!fig) return undefined;
  const { calls, retries, bytesIn, startedAt } = fig.stats;
  return { calls, retries, bytesIn, ms: Date.now() - startedAt };
};

function serialize(out: Record<string, unknown>): string {
  try {
    return JSON.stringify(out);
  } catch (err) {
    // The job ran; only its answer would not serialize. Saying it failed
    // would invite running it again.
    return JSON.stringify({ ...out, result: null, resultError: `the result is not JSON: ${errorMessage(err)}` });
  }
}

/** Print the line once and set the exit code; never cut the line short with process.exit. */
function finish(out: Record<string, unknown>, code: number): void {
  if (finished) return;
  finished = true;
  process.exitCode = code;
  writeLine(serialize(out) + "\n", () => {
    // The line is with the OS now. A job that left a timer or a socket open
    // must not hold the agent's tool call: end once it has had a moment.
    setTimeout(() => process.exit(), 1_000).unref();
  });
}

// A job's unawaited promise or stray callback is a crash, as it is for node
// itself, but it still ends in the one line.
process.on("uncaughtException", (err) => {
  console.error(err);
  finish({ ok: false, error: `the job crashed: ${errorMessage(err)}`, cost: cost() }, 1);
});
process.on("unhandledRejection", (err) => {
  console.error(err);
  finish({ ok: false, error: `the job crashed: ${errorMessage(err)}`, cost: cost() }, 1);
});
process.on("beforeExit", () => {
  finish({ ok: false, error: "the job's promise never settled", cost: cost() }, 1);
});

async function main(): Promise<void> {
  let values: { agent?: string; file?: string; url?: string };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      options: {
        agent: { type: "string" },
        file: { type: "string" },
        url: { type: "string" },
      },
      allowPositionals: true,
    }));
  } catch (err) {
    return finish({ ok: false, error: `${errorMessage(err)}; ${USAGE}` }, 2);
  }
  const [script, ...args] = positionals;
  if (!script) return finish({ ok: false, error: USAGE }, 2);
  if (values.agent !== undefined && !values.agent.trim()) {
    return finish({ ok: false, error: `--agent needs a name; ${USAGE}` }, 2);
  }

  const scriptPath = path.resolve(script);
  try {
    fig = connect({
      url: values.url,
      agent: values.agent ?? `run:${path.basename(scriptPath, path.extname(scriptPath))}`,
      fileKey: values.file,
    });
  } catch (err) {
    return finish({ ok: false, error: `--url: ${errorMessage(err)}` }, 2);
  }

  try {
    if (!(await fig.ping())) throw new Error(`no leader at ${fig.url}: start a figma-limitless-mcp session first`);
    const mod = (await import(pathToFileURL(scriptPath).href)) as { default?: unknown };
    if (typeof mod.default !== "function") throw new Error(`${script} has no default-exported function`);
    const result = await (mod.default as (f: Client, a: string[]) => Promise<unknown>)(fig, args);
    finish({ ok: true, result, cost: cost() }, 0);
  } catch (err) {
    finish({ ok: false, error: errorMessage(err), cost: cost() }, 1);
  }
}

main().catch((err) => finish({ ok: false, error: errorMessage(err), cost: cost() }, 1));
