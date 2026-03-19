> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

# Nectar Design Toolkit - Changelog

All notable changes to this project will be documented in this file.

---

## [2.0.0] - 2026-02-18

### Build System
- **`build-figma-ds.js`**: Automated Figma Design System builder — reads `seed.json`, `alias.json`, `mapped.json` and creates the full design system via orchestration server
  - `--step variables` / `--step styles` / `--step pages` / `--step visual` / `--step all`
  - `--dry-run` flag for previewing commands without executing
  - Zero external dependencies — uses Node.js built-ins only
  - Dependency chain: Seed → Alias → Mapped → Styles → Visual Hierarchy

### Plugin Enhancements (`figma-plugin/code.ts`)
- **Batch commands**: `batch_create_variables`, `batch_set_variable_aliases`, `batch_create_styles` — reduces 580+ round-trips to ~14 commands
- **`createFrame` with `parentId`**: Frames now nest inside sections/frames via `appendChild` (previously all frames landed at page level)
- **`autoLayout` shorthand**: New format `{ mode, itemSpacing, paddingLeft, ... }` alongside legacy `{ layoutMode, padding: {...} }` format
- **`primaryAxisSizingMode` / `counterAxisSizingMode`**: Frame sizing modes supported on `createFrame`
- **`cornerRadius` on frames**: Previously silently dropped
- **`clear_page_children` command**: Delete all children from a named page (for clean rebuilds)
- **Visual hierarchy commands**: `create_color_swatches_group`, `create_typography_group`, `create_effect_group`, `create_grid_group` — pre-built layout components for design system documentation pages

### Design System Created
- 90 seed variables (37 color palettes + spacing + typography + borders)
- 39 alias variables (semantic tokens referencing seed)
- 32 mapped variables (light/dark mode theme tokens)
- 14 text styles (headings, titles, body, caption, code)
- 4 effect styles (hard shadows: sm/md/lg/xl)
- 5 pages with emoji prefixes
- 5 visual hierarchy sections with nested content frames, auto-layout, color swatches, typography specimens

### Bug Fixes
- **Fixed**: `createFrame` ignoring `parentId` — content frames orphaned at page level instead of nesting inside sections
- **Fixed**: `autoLayout` format mismatch between build script and plugin — auto-layout silently not applied
- **Fixed**: `cornerRadius` silently dropped due to missing TypeScript interface field
- **Fixed**: Content frames not auto-sizing — missing `primaryAxisSizingMode: 'AUTO'`
- **Fixed**: `delete_node` failing across pages — payload field name mismatch (`id` vs `nodeId`)

### Documentation (publishable quality)
- **`docs/BEST_PRACTICES.md`**: 11-section guide covering token architecture, Figma API rules, variable/style patterns, visual hierarchy, build pipeline, plugin development, orchestration patterns, error recovery, performance, and field lessons
- **`docs/COMMAND_REFERENCE.md`**: Complete catalog of 80+ plugin commands organized into 18 categories with payload tables, response formats, and examples
- **`docs/AI_OPTIMIZATION_GUIDE.md`**: 12-section guide for AI model efficiency — context loading, prompt engineering, command batching, error recovery, ID manifests, multi-agent workflows, model-specific tips

---

## [1.0.0] - 2025-12-27

### Added
- **Project Migration**: Moved from `Portfolio/My Portfolio/_archive/NDS (planned)/AI_TOOLING/` to `Side-Kicks/nectar-design-toolkit/`
- **Standard Documentation**: Added AI_CONTEXT.md, CHANGELOG.md, TASKS.md
- **GitHub Templates**: Added copilot-instructions.md, ISSUE_TEMPLATE/

### Components Included
- **figma-plugin**: Main Portfolio DS Builder plugin
- **nds-builder**: Standalone NDS bootstrapper plugin
- **nectar-style-generator**: Style generation from variable modes
- **orchestration-server**: HTTP polling server for AI communication
- **bridge-server**: WebSocket bridge alternative
- **mcp-server**: VS Code MCP integration

### Documentation
- Migrated: WALKTHROUGH.md, FIGMA_PLUGIN_SETUP.md, PROJECT_STRUCTURE.md
- Migrated: DESIGN_SYSTEM_STRUCTURE.md, NECTAR_DESIGN_SYSTEM.md

---

## Pre-Migration History

### [0.x] - Pre-2025-12-27 (from original AI_TOOLING)

#### Infrastructure Completed
- ✅ Figma Plugin for AI control (`figma-plugin/`)
- ✅ Bridge Server (WebSocket/HTTP) (`bridge-server/`)
- ✅ MCP Server with write tools (`mcp-server/`)
- ✅ Orchestration Server with HTTP polling (`orchestration-server/`)
- ✅ PM2 process management (`nectar-server`)

#### Plugins Completed
- ✅ Portfolio DS Builder v2.0 (HTTP Polling architecture)
- ✅ NDS Builder (standalone page/style bootstrapper)
- ✅ Nectar Style Generator (variable mode → styles)

#### Major Milestones
- Mobile-first migration (Alias = mobile base values)
- Mapped→Breakpoints migration (FLOAT tokens consolidated)
- 2620 icon import from Central Icon System
- TEXT_FILL scope fix for fg/ variables
- Grid style generation (8 responsive layouts)

#### Architecture
```
VS Code/AI → MCP Server → Orchestration Server → Figma Plugin → Figma
                              │
                         HTTP Polling (9877)
```

---

## Version Format

`[MAJOR.MINOR.PATCH]` where:
- **MAJOR**: Breaking changes or major feature additions
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, documentation updates

---

*Maintained by AI Agents - Last AI: Claude Code (Claude Opus 4.6) — 2026-02-18*
