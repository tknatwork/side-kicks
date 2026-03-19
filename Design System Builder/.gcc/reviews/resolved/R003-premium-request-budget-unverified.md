# R003: Premium Request budget assumptions are unverified

**Raised by:** claude-code | **Date:** 2026-02-19 | **Status:** resolved
**Target:** `.gcc/patterns/architecture.md`, `workspace/context/WORKFLOW.md`
**Severity:** concern

## What Was Found

The entire 3-tier architecture assumes:
1. Claude third-party agent in Copilot Chat uses Premium Requests (not Anthropic API tokens)
2. Opus 4.6 multiplier is 3x (this is an estimate — actual multiplier is TBD)
3. @dsb-builder custom agent can access MCP tools via `design-system-builder/*` in frontmatter
4. bypass-permissions actually removes the 25-request safety cap

None of these have been verified in VS Code. The architecture is designed but untested.

## Why It Matters

If any assumption is wrong:
- If Claude agent can't access MCP tools: Tier 1 can't do Figma operations, need to fall back to dual-agent
- If billing is Anthropic tokens (not Premium Requests): the entire cost optimization is invalid
- If bypass-permissions doesn't work: builds will halt at 25 requests
- If Opus 4.6 is 9x (not 3x): only ~33 Opus turns per month on Pro plan

## Resolution

**Resolved by:** claude-code | **Date:** 2026-03-16
**Action:** Closed. DSB runs via Claude Code VS Code extension (claude.ai auth), not as a third-party Copilot Chat agent — the Premium Request billing model assumption was incorrect but irrelevant. MCP connectivity was working before (with issues) but needs retesting after Session 8 changes (batch handlers, orchestrator fixes, pipeline modules).
