# DSB Architecture — Pre-Digested Summary

> This file exists so agents don't re-reason the architecture every session.
> Reading this (~500 tokens) replaces scanning 50+ files (~6,500 tokens).
> Source of truth: copilot-instructions.md Section A + CLAUDE.md

## What DSB Is

An 8-package pnpm monorepo that creates 3-tier design systems in Figma.
Users interact through Claude Code only. Developers build with the 3-tier agent workflow.

## Package Map (what owns what)

```
core              → Token engine, color utils, validators, style generator,
                    learning engine, crypto, monitoring, build state, telemetry
figma-api         → Thin ES2017-safe wrappers around Figma Plugin API
builder-plugin    → Headless Figma plugin, 59 command handlers (ES2017 ONLY — QuickJS sandbox)
mcp-server        → 86 dsb_* MCP tools (incl. pipeline + file-role), stdio transport
orchestration-server → HTTP bridge (port 9877), config UI, build status
licensing         → Gumroad validation, feature gating, admin auth (secp256k1)
guardrails        → Sandbox, path validation, audit logging, rollback, encryption
updater           → Secure OTA updates (Ed25519 signatures, atomic swap)
```

## Communication Flow

```
Agent → dsb_* MCP tools → MCP Server (stdio) → Orchestration Server (:9877)
                                 │                       ↓
                                 │              Builder Plugin (HTTP poll 50ms)
                                 │                       ↓
                                 │              Figma Design File (destination)
                                 │
                                 └── OpenPencil Adapter → OpenPencil MCP (:3100)
                                                                ↓
                                                        .fig File (source)
```

## Cross-File Pipeline (new)

OpenPencil reads source .fig natively (90 MCP tools). DSB plugin writes to destination
in Figma Desktop. Claude orchestrates between them via:

- **Impact Analyzer** — cascading 3-tier token + component hierarchy analysis before writes
- **Write Governor** — adaptive rate limiter (batch 5→10), circuit breaker (3 failures)
- **File Role Toggle** — source / destination / source+destination modes in plugin UI

## Critical Constraints

1. **ES2017 in builder-plugin** — No `?.`, `??`, spread, `for...of` on Maps, generators
2. **3-tier tokens** — Tier 1 (primitives) → Tier 2 (semantic, aliases Tier 1) → Tier 3 (mapped, aliases Tier 2). No skipping tiers, no circular aliases.
3. **pnpm only** — `pnpm install`, `pnpm run build`, `pnpm -r run build`
4. **Result<T,E>** — All fallible ops return Result, never throw for business logic
5. **Guardrails for I/O** — `safeWriteFile`/`safeReadJson` for files, `execFileNoThrow` for processes

## 3-Tier Agent Workflow

| Tier | Agent | Billing | When |
|------|-------|---------|------|
| 1 | Claude agent + @dsb-builder | Premium Requests (flat-rate) | 90% — building + MCP execution |
| 2 | Copilot Local | Premium Requests (1x Sonnet) | 5% — memory lookups |
| 3 | Claude Code tab | Anthropic API (per-token) | 5% — overflow when budget depleted |

## Token Cost Strategy

Copilot (flat-rate) does heavy reasoning → writes to `.gcc/` files.
Claude Code (per-token) reads `.gcc/` files → executes tasks directly.
Heavy thinking on flat-rate rail. Per-token rail gets pre-digested context only.
