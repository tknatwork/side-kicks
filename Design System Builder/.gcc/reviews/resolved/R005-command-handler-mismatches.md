# R005: Command handler mismatches between MCP tools, orchestrator, and plugin registry

**Raised by:** claude-code | **Date:** 2026-02-25 | **Status:** open
**Target:** `packages/builder-plugin/src/code.ts`, `packages/core/src/build/build-orchestrator.ts`, `packages/mcp-server/src/tools/`
**Severity:** concern

## What Was Found

The plugin command registry (31 commands), the build orchestrator's generated commands, and the MCP tool bridge commands don't fully align. Several command types may be sent by the MCP server or orchestrator but have no handler in the plugin:

### Commands the orchestrator may generate (from build-tools.ts) that need plugin handlers:
- `batch_set_values` — batch value assignment (orchestrator generates this for tier steps)
- `batch_create_styles` — batch style creation
- `generate_report` — validation/reporting
- `get_collection` (singular) — the plugin has `get_collections` (plural) but individual lookup may differ

### Plugin registry (31 commands verified in tests):
Token: `create_collection`, `get_collections`, `delete_collection`, `batch_create_variables`, `set_variable_value`, `set_variable_alias`, `set_scopes`, `get_variables`
Style: `create_color_style`, `create_text_style`, `create_effect_style`, `create_grid_style`, `get_styles`
Page: `create_page`, `create_pages`, `get_pages`, `set_current_page`, `delete_page`, `find_page_by_name`
Node: `create_frame`, `create_section`, `create_text`, `create_rectangle`, `append_child`, `remove_node`
Query: `get_file_info`, `get_collection_details`, `get_selection_info`, `check_fonts`, `load_font`, `load_fonts`

### Missing from plugin but potentially sent by orchestrator:
- `batch_set_values` — for bulk mode value assignment after variables are created
- `batch_set_aliases` — for bulk alias creation (MCP tool `dsb_batch_set_aliases` exists)

## Why It Matters

If the build orchestrator generates a `StepCommand` with `type: "batch_set_values"` and sends it through the bridge to the plugin, the plugin's command dispatcher will hit the default/unknown case. Depending on implementation, this could:
1. Silently ignore the command (data loss)
2. Return an error that the orchestrator treats as a critical failure (build aborts)
3. Crash the plugin

## Suggested Fix

1. Audit `build-orchestrator.ts` — list every unique `command.type` value it generates across all step plans
2. Verify each generated type has a matching handler in `code.ts`
3. For any mismatches, either add the handler to the plugin or adjust the orchestrator to use existing command names
4. Add an integration test that runs `planBuild()` and verifies all generated command types are in the plugin's supported-commands list

## Resolution

**Resolved by:** claude-code | **Date:** 2026-03-16
**Action:** Two-sided fix: (1) Added `batch-handlers.ts` with `handleBatchSetValues` and `handleBatchSetAliases` to plugin, registered in `code.ts` (61 handlers total). (2) Fixed orchestrator to use existing commands: `batch_create_styles` → individual `create_color_style`/`create_text_style`, `get_collection` → `get_collection_details`, `generate_report` → `get_file_info`.
