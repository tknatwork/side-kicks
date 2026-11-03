#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { connect, errorMessage } from "./client.js";

/**
 * figma-limitless-run: run one script against the leader and print one line
 * of JSON. The agent makes a single tool call; every step, retry, poll and
 * lock happens inside the script.
 *
 *   figma-limitless-run job.mjs [--agent name] [--file fileKey] [--url url] [-- args…]
 *
 * job.mjs default-exports `async (fig, args) => answer`, where `fig` is a
 * connected client (client.ts). The answer is printed as
 * {"ok":true,"result":…,"cost":{…}}; a throw prints {"ok":false,"error":…}
 * and exits 1. Return a summary, not raw data: the line is what the agent reads.
 */

const USAGE = "usage: figma-limitless-run <script.mjs> [--agent name] [--file fileKey] [--url url] [-- args…]";

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    options: {
      agent: { type: "string" },
      file: { type: "string" },
      url: { type: "string" },
    },
    allowPositionals: true,
  });
  const [script, ...args] = positionals;
  if (!script) {
    console.error(USAGE);
    return 2;
  }

  const scriptPath = path.resolve(script);
  const fig = connect({
    url: values.url,
    agent: values.agent ?? `run:${path.basename(scriptPath, path.extname(scriptPath))}`,
    fileKey: values.file,
  });
  const out: Record<string, unknown> = {};
  let code = 0;
  try {
    if (!(await fig.ping())) throw new Error(`no leader at ${fig.url}: start a figma-limitless-mcp session first`);
    const mod = (await import(pathToFileURL(scriptPath).href)) as { default?: unknown };
    if (typeof mod.default !== "function") throw new Error(`${script} has no default-exported function`);
    out.ok = true;
    out.result = await (mod.default as (f: typeof fig, a: string[]) => Promise<unknown>)(fig, args);
  } catch (err) {
    out.ok = false;
    out.error = errorMessage(err);
    code = 1;
  }
  const { calls, retries, bytesIn, startedAt } = fig.stats;
  out.cost = { calls, retries, bytesIn, ms: Date.now() - startedAt };
  process.stdout.write(JSON.stringify(out) + "\n");
  return code;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(errorMessage(err));
    process.exit(2);
  }
);
