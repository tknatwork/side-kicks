# Claude Code Tab — Agent Memory

> What the Claude Code extension tab has learned across sessions.
> Updated at the end of each Claude Code session.
> This agent is Tier 3 (overflow) — used sparingly when Premium Requests run out.

## MCP Tool Execution Patterns

- All dsb_* tools are available via `.vscode/mcp.json` (stdio transport)
- `dsb_check_connection` is the first tool to call — verifies orchestration server + plugin
- Tool calls return structured JSON with `ok` field for success/failure
- Heavy Figma sequences (creating all 3 tiers) can take 30+ sequential tool calls

## Figma API Learnings

- Variable collections have a maximum name length
- Aliases must reference existing variables (create Tier 1 before Tier 2)
- Mode names in collections must be unique
- Plugin poll cycle is 500ms — allow time between rapid commands

## Token Usage Observations

- Architecture re-reasoning on cold start: ~3,000-6,500 tokens (read .gcc/ to avoid)
- Single MCP tool call + response: ~500-800 tokens
- Full 3-tier build sequence: ~15,000-25,000 tokens
- Reading .gcc/patterns/architecture.md: ~500 tokens (85% savings on context load)

## Session History

| Date | Task | Tokens (est.) | Outcome |
|------|------|--------------|---------|
| 2026-02-19 | HOPE infrastructure setup, .gcc creation | — | Architecture + memory system established |

<!-- CLAUDE CODE: Append new learnings below -->
