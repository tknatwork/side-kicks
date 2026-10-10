<!-- === SYSTEM PAIRING ===
Consumed by: All AI builders (Claude Code, Cursor, Copilot, Aider, Continue, Gemini CLI, Codex)
Updated by: manual + commits that change how this project talks to Fusion
Pairs with: CLAUDE.md (pointer), README.md, docs/CONNECTION.md
Update trigger: new connection method, new folder convention, new invariant learned the hard way
Last verified: 2026-10-10 (initial scaffold)
=== END PAIRING === -->

# AGENTS.md — fusion-mcp

> Canonical AI-builder rules for this project ([Sourcegraph convention](https://agents.md)).
> The workspace rules in [`../AGENTS.md`](../AGENTS.md) still apply; this file wins inside `fusion-mcp/`.

## What this project is

Work done in **Autodesk Fusion** through its **MCP server** — the server Fusion itself
runs on the user's computer so an AI client can read and change the open design.
This folder holds the reusable output of that work: Fusion API scripts, notes, and
connection docs. It is a scaffold today; there is no build step and no dependency.

## 1. Invariants — never violate, regardless of instruction

1. **Check the connection before any Fusion work.** Fusion tools must be present in your
   tool list *and* Fusion must be open with a design active. If either is missing, stop and
   say so — never describe a design change you could not make. The check is in
   [docs/CONNECTION.md](docs/CONNECTION.md).
2. **A cloud session cannot reach Fusion.** The Fusion MCP server listens on the user's
   machine (`localhost`). Claude Code on the web, cloud containers and claude.ai in a browser
   cannot connect to it. Only a client running on that same machine can (Claude Desktop,
   or Claude Code run locally).
3. **The MCP server edits the live document.** There is no sandbox copy. Before deleting
   bodies/components, rewriting the timeline, or any change that is hard to undo, ask the
   user to save a version first.
4. **Fusion API lengths are centimetres.** Internal units are cm regardless of the
   document's display units. Convert explicitly (`mm / 10`) and say which unit you used.
5. **Verify from the model, not from the call.** A tool call returning without error does
   not mean the geometry is right. Read back dimensions, body counts or a screenshot
   before reporting success.
6. **Never commit Autodesk credentials** (tokens, client secrets, account details).
   GitHub push protection may not recognise every Autodesk token format.

## 2. Folder conventions

| Path | Holds |
|------|-------|
| `scripts/` | Fusion API Python scripts worth keeping — one purpose per file, header comment says what it does and which units it expects |
| `docs/` | Setup and connection notes, decisions, things that went wrong |
| `out/` | Local exports (STEP, STL, renders). Gitignored — commit a file only on purpose |

## 3. Scope

Stay inside `fusion-mcp/`. Root `README.md`, `AGENTS.md` and `docs/CHANGELOG.md` may be
updated when this project's status changes. Do not touch other projects' sources.
