> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

# Nectar Design Toolkit - Tasks

**Project**: Nectar Design Toolkit  
**Status**: Active Development 🔄  
**Last Updated**: 2025-12-27

---

## Task Status Legend

| Status | Meaning |
|--------|---------|
| ⬜ | Not Started |
| 🔄 | In Progress |
| ✅ | Completed |
| ⏸️ | Blocked/Paused |
| ❌ | Cancelled |

---

## In Progress 🔄

| ID | Task | Status | Notes |
|----|------|--------|-------|
| SETUP-001 | Install dependencies | 🔄 | Post-migration setup |
| SETUP-002 | Verify TypeScript builds | 🔄 | All plugins need compilation |
| SETUP-003 | Test plugin loading in Figma | ⬜ | Validate manifests |

---

## Backlog ⬜

### Infrastructure
| ID | Task | Priority | Notes |
|----|------|----------|-------|
| INFRA-001 | Update manifest names | Medium | Consider renaming from "Portfolio DS Builder" |
| INFRA-002 | Consolidate package.json scripts | Low | Create root-level npm scripts |
| INFRA-003 | Add TypeScript watch mode | Low | `npm run dev` for all plugins |

### Feature Development
| ID | Task | Priority | Notes |
|----|------|----------|-------|
| FEAT-001 | Component text variable binding | High | Bind fg/ variables to text nodes |
| FEAT-002 | Component library export | Medium | Export components for reuse |
| FEAT-003 | Token sync to CSS | Medium | Generate CSS variables from Figma |

### Documentation
| ID | Task | Priority | Notes |
|----|------|----------|-------|
| DOCS-001 | Update README.md | High | Create project overview |
| DOCS-002 | API documentation | Medium | Document all MCP tools |
| DOCS-003 | Video walkthrough | Low | Setup and usage tutorial |

---

## Completed ✅

### Migration (2025-12-27)
| ID | Task | Status | Notes |
|----|------|--------|-------|
| MIG-001 | Move AI_TOOLING to Side-Kicks | ✅ | New name: nectar-design-toolkit |
| MIG-002 | Copy related documentation | ✅ | WALKTHROUGH, FIGMA_PLUGIN_SETUP, etc. |
| MIG-003 | Create standard docs | ✅ | AI_CONTEXT, CHANGELOG, TASKS |
| MIG-004 | Add GitHub templates | ✅ | copilot-instructions, ISSUE_TEMPLATE |

### Pre-Migration (from original AI_TOOLING)

#### Phase 1: Foundation ✅
- ✅ Create Figma Plugin for AI control
- ✅ Create Bridge Server (WebSocket/HTTP)
- ✅ Enhance MCP Server with write tools
- ✅ Create orchestration server (HTTP polling)
- ✅ Setup documentation structure

#### Phase 2: Plugins ✅
- ✅ Portfolio DS Builder v2.0
- ✅ NDS Builder (standalone bootstrapper)
- ✅ Nectar Style Generator

#### Phase 3: Migrations ✅
- ✅ Mobile-first migration
- ✅ Mapped→Breakpoints migration
- ✅ TEXT_FILL scope fix

---

## Notes

### Dependencies Between Tasks
- SETUP-001 must complete before SETUP-002
- SETUP-002 must complete before SETUP-003
- FEAT-001 depends on working plugin (SETUP-003)

### AI Agent Instructions
1. Update this file when starting/completing tasks
2. Add notes for any blockers
3. Reference WALKTHROUGH.md for implementation details

---

*Maintained by AI Agents - Last AI: GitHub Copilot (Claude Opus 4.5)*
