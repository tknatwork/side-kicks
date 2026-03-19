# Command Reference

All MCP tools exposed by the Design System Builder. These are called by Claude, not by users directly.

**Total: 86 tools** across 24 modules.

---

## Connection & Infrastructure

### dsb_check_connection

Check if the builder plugin is connected and responding.

- **Parameters:** none
- **Returns:** `{ connected: boolean, pluginId: string, uptime: number }`
- **License:** Free

### dsb_get_license_status

Check the current license tier and activation status.

- **Parameters:** none
- **Returns:** `{ tier: "free" | "pro" | "team", activated: boolean, expiresAt: string }`
- **License:** Free

### dsb_restart_server

Restart the orchestration server.

- **Parameters:** none
- **Returns:** `{ restarted: boolean }`
- **License:** Free

---

## Token Creation

### dsb_create_tier1_primitives

Create the Primitives (Tier 1) variable collection with raw values.

- **Parameters:**
  - `collectionName` (string, default: "Primitives")
  - `modes` (string[], default: ["Value"])
  - `colors` (object) — Color palette (e.g., `{ "blue/500": "#3b82f6" }`)
  - `spacing` (object) — Spacing scale (e.g., `{ "4": 16, "6": 24 }`)
  - `fontSize` (object) — Type scale
  - `radius` (object) — Border radius values
  - `shadows` (object) — Elevation values
  - `fontFamilies` (object) — Font family strings
- **Returns:** `{ collectionId: string, variableCount: number }`
- **License:** Pro

### dsb_create_tier2_semantic

Create the Semantic (Tier 2) collection with purpose-driven aliases.

- **Parameters:**
  - `collectionName` (string, default: "Semantic")
  - `modes` (string[], default: ["Value"])
  - `aliases` (object) — Map of semantic name to primitive name
- **Returns:** `{ collectionId: string, aliasCount: number }`
- **License:** Pro

### dsb_create_tier3_component

Create the Mapped (Tier 3) collection with theme modes.

- **Parameters:**
  - `collectionName` (string, default: "Mapped")
  - `modes` (string[], default: ["Light", "Dark"])
  - `modeValues` (object) — Per-mode alias mappings
- **Returns:** `{ collectionId: string, modeCount: number, variableCount: number }`
- **License:** Pro

### dsb_create_tier3_breakpoints

Create the Breakpoints collection with responsive modes.

- **Parameters:**
  - `collectionName` (string, default: "Breakpoints")
  - `modes` (string[], default: ["Desktop", "Tablet", "Mobile"])
  - `modeValues` (object) — Per-breakpoint values
- **Returns:** `{ collectionId: string, modeCount: number, variableCount: number }`
- **License:** Pro

### dsb_batch_create_variables

Batch create variables in an existing collection.

- **Parameters:**
  - `collectionId` (string)
  - `variables` (array) — `[{ name, type, values }]`
- **Returns:** `{ created: number, errors: string[] }`
- **License:** Pro

### dsb_batch_set_aliases

Batch set alias references after all variables exist.

- **Parameters:**
  - `aliases` (array) — `[{ sourceCollection, sourceName, targetCollection, targetName, mode }]`
- **Returns:** `{ set: number, errors: string[] }`
- **License:** Pro

---

## Style Generation

### dsb_generate_color_styles

Generate color styles from a variable collection's resolved values.

- **Parameters:**
  - `collectionName` (string) — Source collection (typically "Mapped")
  - `modes` (string[]) — Which modes to generate for
  - `prefix` (string, optional) — Style name prefix
- **Returns:** `{ created: number, styles: string[] }`
- **License:** Pro

### dsb_generate_text_styles

Generate text styles from typography variables.

- **Parameters:**
  - `collectionName` (string) — Source collection (typically "Breakpoints")
  - `modes` (string[])
  - `defaultFontFamily` (string, default: "Inter")
- **Returns:** `{ created: number, fontsLoaded: string[], fontsMissing: string[] }`
- **License:** Pro

### dsb_generate_effect_styles

Generate drop shadow effect styles from elevation variables.

- **Parameters:**
  - `collectionName` (string)
  - `modes` (string[])
- **Returns:** `{ created: number }`
- **License:** Pro

### dsb_generate_grid_styles

Generate grid layout styles from grid variables.

- **Parameters:**
  - `collectionName` (string)
  - `modes` (string[])
- **Returns:** `{ created: number }`
- **License:** Pro

---

## Layout

### dsb_create_page_structure

Create the full page hierarchy from a design system spec.

- **Parameters:**
  - `pages` (array) — `[{ name, category, description }]`
- **Returns:** `{ created: number, pageIds: string[] }`
- **License:** Pro

### dsb_create_foundation_pages

Create standard foundation pages: Colors, Typography, Spacing, Shadows.

- **Parameters:**
  - `includeSwatches` (boolean, default: true)
  - `includeTypeScale` (boolean, default: true)
- **Returns:** `{ pages: string[] }`
- **License:** Pro

### dsb_create_component_pages

Create categorized component placeholder pages.

- **Parameters:**
  - `components` (string[]) — Component names
  - `categories` (object, optional) — Group by category
- **Returns:** `{ pages: string[] }`
- **License:** Pro

---

## Queries

### dsb_get_file_info

Get overview of the current Figma file.

- **Parameters:** none
- **Returns:** `{ pageCount, collectionCount, variableCount, styleCount }`
- **License:** Free

### dsb_get_collection_details

Get detailed info about all variable collections.

- **Parameters:** none
- **Returns:** `{ collections: [{ id, name, modes, variableIds }] }`
- **License:** Free

### dsb_get_collections

List all variable collections.

- **Parameters:** none
- **Returns:** `{ collections: [{ id, name, modeCount, variableCount }] }`
- **License:** Free

### dsb_get_variables

List all variables with IDs, names, types, and collection associations.

- **Parameters:** none
- **Returns:** `{ variables: [{ id, name, resolvedType, variableCollectionId }] }`
- **License:** Free

### dsb_get_styles

Get existing local styles.

- **Parameters:** none
- **Returns:** `{ styles: [{ name, type, id }] }`
- **License:** Free

### dsb_get_pages

Get the page list of the current file.

- **Parameters:** none
- **Returns:** `{ pages: [{ name, id }] }`
- **License:** Free

### dsb_check_fonts

Check if specified fonts are available.

- **Parameters:**
  - `fonts` (array) — `[{ family: string, style: string }]`
- **Returns:** availability status per font
- **License:** Free

### dsb_get_selection

Get information about currently selected nodes.

- **Parameters:** none
- **Returns:** selected node details
- **License:** Free

---

## Export & Validation

### dsb_export_json

Export tokens in current JSON format (compatible with Variables & Styles Extractor).

- **Parameters:**
  - `variables` (array) — Token definitions
  - `tiers` (object) — Tier architecture config
- **Returns:** Serialized JSON export
- **License:** Free

### dsb_export_dtcg

Export tokens in W3C DTCG 2025.10 format.

- **Parameters:**
  - `variables` (array) — Token definitions
  - `modeName` (string, default: "Value")
- **Returns:** DTCG-formatted JSON
- **License:** Free

### dsb_validate_tokens

Validate token definitions against 3-tier rules.

- **Parameters:**
  - `variables` (array) — Token definitions with tier assignments
  - `spec` (object) — Design system spec for context
  - `figmaPlan` (string, default: "professional")
- **Returns:** Validation report with issues and severity
- **License:** Free

### dsb_check_plan_limits

Check Figma plan limits for variables, modes, and collections.

- **Parameters:**
  - `planName` (string) — "starter", "professional", "organization", "enterprise"
- **Returns:** `{ plan, limits: { maxVariables, maxModes, maxCollections } }`
- **License:** Free

---

## Learning

### dsb_read_workspace

List files in a workspace subdirectory, or read specific files.

- **Parameters:**
  - `action` ("list" | "read")
  - `subdirectory` ("context" | "specs" | "exports" | "reports", default: "context")
  - `filenames` (string[], optional)
- **Returns:** File listing or file contents
- **License:** Free

### dsb_save_context

Persist learned context to disk for cross-session continuity.

- **Parameters:**
  - `scope` ("project" | "global")
  - `context` (object)
- **Returns:** `{ saved: true, scope, path }`
- **License:** Free

### dsb_load_context

Load previously saved context.

- **Parameters:**
  - `scope` ("project" | "global" | "merged", default: "merged")
- **Returns:** Saved context object(s)
- **License:** Free

---

## Setup & System

### dsb_setup_project

Create DSB project folder with encrypted structure.

- **Parameters:** project configuration
- **Returns:** `{ created: true, path: string }`
- **License:** Free

### dsb_system_check

Run integrity, dependency, connectivity, and Chrome checks.

- **Parameters:** none
- **Returns:** Check results with pass/fail per category
- **License:** Free

---

## Config UI

### dsb_open_config_ui

Open the visual configuration wizard in Chrome.

- **Parameters:** none
- **Returns:** `{ opened: true, url: string }`
- **License:** Pro

---

## Build Pipeline

### dsb_start_build

Start or continue the automated build pipeline from config.

- **Parameters:** build configuration
- **Returns:** Build progress and status
- **License:** Pro

### dsb_resume_build

Resume a crashed or paused build from its last checkpoint.

- **Parameters:** none
- **Returns:** Resumed build status
- **License:** Pro

---

## Telemetry

### dsb_toggle_telemetry

Enable or disable anonymized usage telemetry.

- **Parameters:**
  - `enabled` (boolean)
- **Returns:** `{ telemetry: boolean }`
- **License:** Free

---

## Updates

### dsb_check_updates

Check for new DSB versions.

- **Parameters:** none
- **Returns:** `{ available: boolean, latestVersion: string, currentVersion: string }`
- **License:** Free

### dsb_apply_update

Download, verify (Ed25519), and install an approved update.

- **Parameters:**
  - `version` (string) — Target version
- **Returns:** Update result
- **License:** Free

---

## Node Manipulation

> Merged from SouthLeft Figma Console features. Provides direct Figma node control.

### dsb_resize_node

Resize a node by ID to specified width and height.

- **Parameters:**
  - `nodeId` (string)
  - `width` (number)
  - `height` (number)
- **Returns:** `{ nodeId, width, height }`
- **License:** Free

### dsb_move_node

Move a node to specified x, y position.

- **Parameters:**
  - `nodeId` (string)
  - `x` (number)
  - `y` (number)
- **Returns:** `{ nodeId, x, y }`
- **License:** Free

### dsb_clone_node

Deep-clone a node, optionally placing the clone under a different parent.

- **Parameters:**
  - `nodeId` (string)
  - `parentId` (string, optional)
- **Returns:** `{ cloneId, name }`
- **License:** Free

### dsb_set_fills

Set fill paints on a node (solid, gradient, or image fills).

- **Parameters:**
  - `nodeId` (string)
  - `fills` (array) — `[{ type, color: { r, g, b }, opacity }]`
- **Returns:** success status
- **License:** Free

### dsb_set_strokes

Set stroke paints and optional weight on a node.

- **Parameters:**
  - `nodeId` (string)
  - `strokes` (array) — same format as fills
  - `weight` (number, optional)
- **Returns:** success status
- **License:** Free

### dsb_set_text_content

Update the text content of a text node (auto-loads required fonts).

- **Parameters:**
  - `nodeId` (string)
  - `text` (string)
- **Returns:** `{ nodeId, text }`
- **License:** Free

### dsb_set_node_properties

Batch-set properties on a node (opacity, cornerRadius, visible, name, etc.).

- **Parameters:**
  - `nodeId` (string)
  - `properties` (object) — Key-value pairs of node properties
- **Returns:** `{ nodeId, updated: string[] }`
- **License:** Free

---

## Component Operations

### dsb_instantiate_component

Create an instance of a component by its ID, optionally at specific coordinates.

- **Parameters:**
  - `componentId` (string)
  - `x` (number, optional)
  - `y` (number, optional)
- **Returns:** `{ instanceId, name }`
- **License:** Free

### dsb_search_components

Search for components by name pattern (regex) across the entire file.

- **Parameters:**
  - `pattern` (string) — Regex pattern to match component names
- **Returns:** `{ components: [{ id, name, key, description }], count }`
- **License:** Free

### dsb_get_component_metadata

Get detailed metadata for a component or component set.

- **Parameters:**
  - `componentId` (string)
- **Returns:** `{ id, name, type, description, key, variants?, variantCount? }`
- **License:** Free

### dsb_arrange_component_set

Arrange variants in a component set into a grid layout.

- **Parameters:**
  - `setId` (string)
  - `columns` (number, default: 4)
  - `gap` (number, default: 20) — Gap in pixels
- **Returns:** `{ arranged: number, columns }`
- **License:** Free

---

## Design System Extraction

### dsb_extract_design_system

Extract the full design system in one call: variables, collections, styles, components, and fonts.

- **Parameters:** none
- **Returns:** Complete DS data with summary counts
- **License:** Free

### dsb_extract_design_summary

Get a lightweight overview: counts, categories, coverage.

- **Parameters:** none
- **Returns:** `{ fileName, pageCount, collectionCount, variableCount, paintStyleCount, textStyleCount, effectStyleCount, componentCount }`
- **License:** Free

### dsb_get_local_styles

Get all local paint, text, effect, and grid styles with resolved values.

- **Parameters:** none
- **Returns:** `{ styles: [...], count }`
- **License:** Free

---

## Debugging & Console

### dsb_get_console_logs

Retrieve the plugin console log buffer, optionally filtered.

- **Parameters:**
  - `filter` (string, optional) — Filter logs containing this string
  - `limit` (number, default: 200)
- **Returns:** `{ entries: string[], total, filtered }`
- **License:** Free

### dsb_clear_console

Clear the plugin console log buffer.

- **Parameters:** none
- **Returns:** success status
- **License:** Free

### dsb_reload_page

Force-reload the current Figma page (triggers a brief page switch).

- **Parameters:** none
- **Returns:** `{ pageId, pageName }`
- **License:** Free

### dsb_reconnect

Reconnect to the Figma plugin by verifying orchestration server health.

- **Parameters:** none
- **Returns:** `{ connected: boolean, ... status }`
- **License:** Free

---

## Image & Screenshot

### dsb_export_node_image

Export any node as PNG, SVG, or PDF. Returns base64-encoded data.

- **Parameters:**
  - `nodeId` (string)
  - `format` (enum: "PNG" | "SVG" | "PDF", default: "PNG")
  - `scale` (number, default: 2) — Only for PNG
- **Returns:** `{ base64, format, byteLength }`
- **License:** Free

### dsb_take_screenshot

Capture a screenshot of a specific node or the current viewport.

- **Parameters:**
  - `nodeId` (string, optional) — Defaults to first child of current page
  - `scale` (number, default: 1)
- **Returns:** `{ base64, format, byteLength, nodeId }`
- **License:** Free

---

## Comments (Figma REST API)

> These tools use the Figma REST API directly (requires `FIGMA_ACCESS_TOKEN` env var). They do not route through the plugin bridge.

### dsb_get_comments

Retrieve all comments on a Figma file.

- **Parameters:**
  - `fileKey` (string) — Figma file key from the file URL
- **Returns:** `{ comments: [{ id, message, created_at, user, client_meta }] }`
- **License:** Free (requires PAT)

### dsb_post_comment

Post a comment on a Figma file, optionally pinned to canvas coordinates.

- **Parameters:**
  - `fileKey` (string)
  - `message` (string)
  - `x` (number, optional) — Canvas X coordinate for pin
  - `y` (number, optional) — Canvas Y coordinate for pin
- **Returns:** `{ id, message, created_at }`
- **License:** Free (requires PAT)

### dsb_delete_comment

Delete a comment from a Figma file.

- **Parameters:**
  - `fileKey` (string)
  - `commentId` (string)
- **Returns:** `{ deleted: true, commentId }`
- **License:** Free (requires PAT)

---

## Audit & Health

### dsb_lint_design

Run a design lint: WCAG accessibility checks, hardcoded color detection, detached component audit.

- **Parameters:** none
- **Returns:** `{ issues: [{ type, severity, nodeId, nodeName, message }], issueCount, nodesScanned }`
- **License:** Free

### dsb_check_design_parity

Compare a Figma node's design specs against a code snippet to identify parity gaps.

- **Parameters:**
  - `nodeId` (string) — Figma node to extract specs from
  - `codeSnippet` (string) — Code implementation to compare against
- **Returns:** `{ designSpecs, codeSnippet, note }`
- **License:** Free

### dsb_get_design_health_score

Get a weighted 0-100 health score: token coverage, style adoption, component usage, consistency, integrity.

- **Parameters:** none
- **Returns:** `{ overall: number, breakdown: { tokens, styles, components, consistency, integrity }, nodeCount }`
- **License:** Free

---

## Execute (Escape Hatch)

### dsb_execute

Run arbitrary Figma Plugin API code. Use for anything structured tools don't cover.

- **Parameters:**
  - `code` (string) — JavaScript code to execute. Has access to the `figma` global.
- **Returns:** `{ result: any }`
- **License:** Free

---

## Documentation

### dsb_generate_component_doc

Auto-generate markdown documentation from a component's metadata (properties, variants, description).

- **Parameters:**
  - `componentId` (string) — Component or ComponentSet ID
- **Returns:** `{ markdown: string, componentName: string }`
- **License:** Free

---

## Cross-File Pipeline

> These tools enable extracting a Figma file's design system via OpenPencil, analyzing cascading impact, and writing changes to a destination file. Requires OpenPencil MCP server running at `localhost:3100`.

### dsb_analyze_source

Read the complete source .fig file structure via OpenPencil adapter. Returns tree, variables, components, reactions, and fonts in one call.

- **Parameters:**
  - `filePath` (string) — Path to .fig file
  - `scope` (object, optional) — `{ pageNames?, nodeTypes?, maxDepth? }` to limit extraction
- **Returns:** `SourceAnalysis { tree, variables, components, reactions, fonts }`
- **License:** Pro
- **Requires:** OpenPencil MCP server

### dsb_preview_impact

Run cascading impact analysis on proposed changes before applying them. Traces the 3-tier token alias chain and component hierarchy to show blast radius.

- **Parameters:**
  - `filePath` (string) — Source .fig file path
  - `changes` (array) — `PropertyChange[]` — `[{ nodeId, property, oldValue, newValue, tier? }]`
- **Returns:** `ImpactReport { tokens, nodes, instances, prototypeWarnings, summary }`
- **License:** Pro
- **Requires:** OpenPencil MCP server

### dsb_apply_changes

Apply ordered changes to the destination file via the write governor. Commands are grouped (variable-additions → node-additions → property-changes → node-deletions → variable-deletions) and sent through adaptive rate-limited batching with circuit breaker protection.

- **Parameters:**
  - `filePath` (string) — Source .fig file path (for context)
  - `changes` (array) — `GovernorCommand[]` with type, payload, and group
  - `dryRun` (boolean, default: false) — If true, returns command plan without executing
- **Returns:** `GovernorResult { results: BatchResult[], totalApplied, totalFailed, totalSkipped }`
- **License:** Pro

### dsb_cross_validate

After applying changes, compare source variables (read via OpenPencil) against destination variables (read via plugin) to detect discrepancies.

- **Parameters:**
  - `filePath` (string) — Source .fig file path
- **Returns:** `{ sourceCount, destinationCount, missingInDestination, summary }`
- **License:** Pro
- **Requires:** OpenPencil MCP server

### dsb_check_openpencil

Health check for the OpenPencil MCP server.

- **Parameters:** none
- **Returns:** `{ available: boolean, port: number }`
- **License:** Free

---

## File Role

> Controls whether the active Figma file acts as source (read-only), destination (read+write), or both. Used for cross-file pipeline workflows.

### dsb_set_file_role

Toggle the active file's role. The plugin UI updates with a color-coded badge: green (source), orange (destination), blue (source+destination).

- **Parameters:**
  - `role` (enum: `"source"` | `"destination"` | `"source+destination"`)
- **Returns:** `{ role: string }`
- **License:** Free

### dsb_get_file_role

Return the current file role.

- **Parameters:** none
- **Returns:** `{ role: string }`
- **License:** Free
