# fusion-mcp

Workspace for work done in **Autodesk Fusion** through the **Fusion MCP server**: an AI
client (Claude) reads and edits the design open in Fusion, and anything worth keeping
(scripts, notes) lands in this folder.

**Status:** scaffold (10 Oct 2026). No code yet.

> Independent project, not affiliated with or endorsed by Autodesk. "Fusion" is used
> descriptively.

## Before you start

The Fusion MCP server runs inside Fusion **on your own computer**, so Claude has to run there
too: use Claude Desktop or Claude Code in a local terminal. A cloud session can edit the files
in this folder but cannot reach Fusion.

Setup and the online check: **[docs/CONNECTION.md](docs/CONNECTION.md)**.

## Layout

```
fusion-mcp/
├── AGENTS.md          ← AI rules for this project (canonical)
├── CLAUDE.md          ← Pointer to AGENTS.md
├── README.md          ← This file
├── LICENSE.md         ← MIT
├── CHANGELOG.md       ← Keep a Changelog
├── docs/
│   └── CONNECTION.md  ← Turn on the MCP server, check it is online, troubleshoot
├── scripts/           ← Fusion API Python scripts worth keeping
└── out/               ← Local exports (gitignored)
```

## License

[MIT](LICENSE.md)
