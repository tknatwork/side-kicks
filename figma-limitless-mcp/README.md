# Figma Limitless MCP

**A local Figma MCP server + Figma Desktop plugin that gives AI assistants
full, unthrottled access to your Figma files** — including everything the
official/remote Figma MCP can't reach: your locally-installed fonts, variable
authoring, prototype wiring, component mastery, and a persistent
journal/checkpoint layer so AI sessions survive crashes and context loss.

No Figma REST API calls. No rate limits. No plan-tier tooling locks. Runs
entirely on your machine: your AI client talks to a local MCP server, which
talks to a plugin running inside Figma Desktop over `ws://localhost:1994`.

```
AI client (Claude Code / Claude Desktop / Cursor / …)
        │  stdio (MCP)
        ▼
local server (:1994) ── journal · checkpoints · locks · digest cache
        │  WebSocket
        ▼
Figma Desktop plugin ── full Plugin API access to your open files
```

## Why local beats remote

| | Official/remote Figma MCP | Figma Limitless MCP |
|---|---|---|
| Rate limits | Plan-tiered, shared quota | None — it's your machine |
| Locally-installed fonts | Invisible (Google/shared fonts only) | Fully visible + loadable |
| Variable authoring | None (REST variables API is Enterprise-only) | Full create/edit/bind/alias |
| Prototype wiring | Read-only context | Author reactions, flows |
| Motion / shaders (2026 betas) | Read-only | Read + write (capability-guarded) |
| Session state | None — every conversation starts cold | Journal, checkpoints, locks, cached digests |
| Multiple files / agents | One context | Multi-file registry + multi-client leader/follower + TTL locks |

## Installation

Prereqs: [Figma Desktop](https://www.figma.com/downloads/), Node.js ≥ 20, [pnpm](https://pnpm.io).

This project lives in the public [`side-kicks`](https://github.com/tknatwork/side-kicks)
repository. Grab just this subproject:

```bash
# Clone only the figma-limitless-mcp subproject (sparse checkout)
git clone --depth 1 --filter=blob:none --sparse https://github.com/tknatwork/side-kicks.git
cd side-kicks && git sparse-checkout set figma-limitless-mcp && cd figma-limitless-mcp

# — or just clone the whole repo and cd in —
# git clone https://github.com/tknatwork/side-kicks.git && cd side-kicks/figma-limitless-mcp

# Build the server and the plugin
cd server && pnpm install && pnpm run build && cd ..
cd plugin && pnpm install && pnpm run build && cd ..
```

**2. Import the plugin into Figma Desktop** (once):
Figma menu → **Plugins → Development → Import plugin from manifest…** →
select `plugin/manifest.json`.

**3. Register the MCP server with your AI client:**

<details><summary><b>Claude Code</b></summary>

```bash
claude mcp add figma-limitless-mcp -s user -- node "$(pwd)/server/dist/index.js"
```
</details>

<details><summary><b>Claude Desktop / Cursor / Windsurf</b> (any MCP-config JSON)</summary>

```json
{
  "mcpServers": {
    "figma-limitless-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/figma-limitless-mcp/server/dist/index.js"]
    }
  }
}
```
</details>

**4. Use it:** open a Figma file, run **Plugins → Development → Figma Limitless
MCP**, and ask your AI to work in Figma. The plugin window shows the
connection state. Health check: `curl http://localhost:1994/ping`.

Multiple AI clients can register the same command — the first becomes the
leader on :1994, the rest proxy through it automatically. Multiple Figma files
connect simultaneously (run the plugin in each; target them by `fileKey`).

## How an AI should use this (the short version)

Point your AI at [docs/structural-conventions.md](docs/structural-conventions.md)
— it's written for AI consumption. The essentials:

1. **Orient first**: `get_workspace_status` → `get_file_digest` (token-lean file
   map, served from cache in ~1ms when nothing changed). Never start with
   `get_document`.
2. **Resume, don't redo**: `load_checkpoint` + `get_journal` reconstruct what a
   previous session already did. Write `save_checkpoint` after each milestone.
3. **Fonts**: `list_fonts` returns exact `{family, style}` strings — including
   your local/brand fonts the remote MCP can't see. Never guess style strings
   ('Semibold' vs 'Semi Bold' vs 'SemiBold' are all real, different values).
4. **Tokens before components**: author variables with `write_variables` (one
   batched call builds a collection via `$N.field` back-references), read them
   with `get_variables_deep` (ALL modes, aliases resolved to names).
5. **Structure over raw values**: bind variables > apply styles > raw values.
6. **Parallel agents**: `acquire_lock` on what you mutate; locks auto-expire.
7. **After a timeout, read before retrying** — the operation may have landed;
   the journal knows.

## Tool surface (72 tools)

**Reads**: file digest (cached), document/node/selection trees, styles (+ full
text/effect style detail), variables (deep, all modes, alias-resolved),
fonts, screenshots (base64 or saved to disk), annotations, reactions, motion,
shaders, library variable collections, dev resources, code mappings, journal,
checkpoints, workspace status.

**Writes**: frames/text/shapes/images, fills (solid/gradient), effects,
strokes, auto-layout **and CSS-grid layout**, node properties, visibility,
duplicate/reparent/group/ungroup, guarded delete, text content + properties,
**text styles (create/update/apply)**, paint + effect styles, **variables
(collections, modes, variables, values, aliases, node bindings)**, **master
components (create from node, combine as variants, component properties,
slots)**, **instances (one-call instantiate with properties + text overrides,
set properties, swap)**, **prototype reactions + flow starting points**,
annotations, dev resources, Motion animation styles (beta), WebGPU shaders
(beta), `execute_code` (arbitrary Plugin-API JS with top-level await — the
escape hatch for anything not yet a dedicated tool).

**Orchestration**: `save_checkpoint` / `load_checkpoint` (durable resume
ledgers), `get_journal` (every mutation logged with agent identity),
`acquire_lock` / `release_lock` (TTL mutexes for parallel agents),
`get_file_digest` (cached orientation), `get_workspace_status`,
`set_code_mapping` / `get_code_mappings` (durable design→code mappings — a
local Code-Connect equivalent).

All state lives in `~/.figma-limitless-mcp/` and survives restarts.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Plugin says "Waiting for server" | No MCP client has started the server yet — or check `lsof -i :1994` |
| `execute_code` fails with "Not available" | Turn OFF Plugins → Development → **Use developer VM** (it blocks the Function constructor) |
| "Multiple files connected. Specify a fileKey" | Pass `fileKey` (from `list_files`) — you have the plugin running in 2+ files |
| `list_library_variables` errors about permissions | Re-import the plugin — the manifest needs the `teamlibrary` permission (already declared) |
| Font load fails | The style string is wrong — `list_fonts` for exact values; never guess |
| A timeout error after a mutation | The op may still have applied — verify with a read (`get_journal` / `get_node`) before retrying |
| Renamed a Figma file and lost checkpoints | Unsaved/local files are bucketed by a name-derived key; renaming re-buckets. Mappings/checkpoints remain on disk under the old bucket |

## Security & privacy

- Everything is local: the plugin only talks to `ws://localhost:1994` (pinned
  in the manifest); the server binds localhost and never phones home.
- No telemetry, no accounts, no tokens. State root: `~/.figma-limitless-mcp/`.
- Write tools are rejected in Dev Mode; `delete_nodes` requires
  `confirm: true`; screenshot/image file paths are jailed to the server's
  working directory; remote image fetches have SSRF guards.
- `execute_code` runs arbitrary Plugin-API JavaScript **in your own file** —
  the same trust model as Figma's own `use_figma`. Review what your AI runs.

## What this does and doesn't unlock (honest version)

Figma gates some capabilities at the **tooling level** (REST API tiers, MCP
rate limits, Org/Enterprise-only developer tooling like Code Connect). The
public **Plugin API** offers most of those capabilities on every plan — this
project simply packages them as local tooling for your own files. That's what
"limitless" means here.

What it deliberately does **not** do: bypass anything Figma enforces inside
the editor runtime — extended variable collections, per-plan mode-count
limits, branching/merge, library access you don't have, publish rights. Those
limits surface as-is.

## Contributing

PRs welcome. The architecture notes for contributors (and AI builders) live in
[AGENTS.md](AGENTS.md); adding a tool touches 4 places (plugin handler, schema,
rpc mapping, registration) and the type system makes omissions compile errors.
Build with pnpm only. Keep examples generic — no user-specific fonts, file
keys, or accounts.

## License

MIT — see [LICENSE.md](LICENSE.md) (includes the retained notice from the
MIT-licensed bridge this project derived portions from).
