# Command Reference — Nectar Design Toolkit

**Complete catalog of all plugin commands with payloads, responses, and examples.**

> Version: 2.0 | Last Updated: 2026-02-18 | 80+ Commands

---

## Quick Navigation

| Category | Count | Description |
|----------|-------|-------------|
| [Variable Commands](#1-variable-commands) | 7 | Create, set, delete variables and collections |
| [Variable Scoping](#2-variable-scoping-commands) | 2 | Control where variables appear in Figma UI |
| [Collection Management](#3-collection-management-commands) | 3 | Rename, delete, hide collections |
| [Mode Commands](#4-mode-commands) | 5 | Create modes, bind mode overrides to frames |
| [Style Commands](#5-style-commands) | 9 | Color, text, effect, and grid styles |
| [Page Commands](#6-page-commands) | 3 | Create, list, navigate pages |
| [Frame & Layout](#7-frame--layout-commands) | 4 | Frames, sections, auto-layout |
| [Shape Commands](#8-shape-commands) | 4 | Rectangle, ellipse, vector, line |
| [Text Commands](#9-text-commands) | 2 | Create and update text nodes |
| [Node Manipulation](#10-node-manipulation-commands) | 10 | Move, resize, rename, delete, fill nodes |
| [Component Commands](#11-component-commands) | 7 | Components, instances, properties |
| [Query Commands](#12-query-commands) | 8 | Inspect variables, styles, nodes, pages |
| [Library Commands](#13-library-commands) | 4 | Import and search library components |
| [SVG & Icon Commands](#14-svg--icon-commands) | 8 | SVG import, icon extraction, batch processing |
| [Style Remapping](#15-style-remapping-commands) | 4 | Analyze and remap existing styles |
| [Batch Commands](#16-batch-commands-optimized) | 3 | High-performance bulk operations |
| [Visual Hierarchy](#17-visual-hierarchy-commands) | 4 | Color swatches, typography, effect, grid groups |
| [Utility Commands](#18-utility-commands) | 2 | Clear page, get file info |

---

## How Commands Work

### Architecture

```
AI Agent / Script                Orchestration Server              Figma Plugin
      │                               │                               │
      │  POST /command                 │                               │
      │  { command, payload }  ───────►│                               │
      │                               │  GET /poll (every 50ms)       │
      │                               │◄────────────────────────────── │
      │                               │  return queued command ───────►│
      │                               │                               │  execute
      │                               │  POST /response               │
      │                               │◄────────────────────────────── │
      │  return { success, data }      │                               │
      │◄───────────────────────────────│                               │
```

### Sending a Command

```bash
curl -X POST http://localhost:9877/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "command_name",
    "payload": { ... }
  }'
```

### Response Format

All commands return:
```json
{
  "id": "cmd_1708275600000",
  "success": true,
  "data": { ... }
}
```

On error:
```json
{
  "id": "cmd_1708275600000",
  "success": false,
  "error": "Error message"
}
```

---

## 1. Variable Commands

### `create_variable_collection`

Create a new variable collection with modes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Collection name |
| `modes` | string[] | No | Mode names (default: `["Mode 1"]`) |

**Response:** `{ id, name, modeIds: { "Light": "modeId1", "Dark": "modeId2" } }`

```json
{
  "command": "create_variable_collection",
  "payload": {
    "name": "Seed Colors",
    "modes": ["Light", "Dark"]
  }
}
```

---

### `create_variable`

Create a single variable in a collection.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collectionId` | string | Yes | Target collection ID |
| `name` | string | Yes | Variable name (e.g., `"pink/500"`) |
| `resolvedType` | enum | Yes | `COLOR`, `FLOAT`, `STRING`, `BOOLEAN` |

**Response:** `{ id, name }`

```json
{
  "command": "create_variable",
  "payload": {
    "collectionId": "VariableCollectionId:90:2",
    "name": "pink/500",
    "resolvedType": "COLOR"
  }
}
```

---

### `set_variable_value`

Set a variable's value for a specific mode.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `variableId` | string | Yes | Variable ID |
| `modeId` | string | Yes | Mode ID |
| `value` | mixed | Yes | See value types below |

**Value types:**
- **COLOR**: `{ r: 0-1, g: 0-1, b: 0-1 }` (normalized floats, NOT 0-255)
- **FLOAT**: `16` (number)
- **STRING**: `"hello"` (string)
- **BOOLEAN**: `true` (boolean)
- **ALIAS**: `{ type: "VARIABLE_ALIAS", id: "VariableID:94:308" }`

**Response:** `{ success: true }`

```json
{
  "command": "set_variable_value",
  "payload": {
    "variableId": "VariableID:94:12",
    "modeId": "94:0",
    "value": { "r": 0.984, "g": 0.471, "b": 0.471 }
  }
}
```

---

### `delete_variable`

Remove a variable permanently.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `variableId` | string | Yes | Variable ID to delete |

**Response:** `{ success: true }`

---

### `create_mode`

Add a new mode to an existing collection.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collectionId` | string | Yes | Collection ID |
| `name` | string | Yes | New mode name |

**Response:** `{ modeId: "newModeId" }`

---

## 2. Variable Scoping Commands

### `set_variable_scopes`

Control where a variable appears in the Figma UI.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `variableId` | string | Yes | Variable ID |
| `scopes` | string[] | Yes | Array of scope names |

**Available scopes:**

| Scope | For | Description |
|-------|-----|-------------|
| `ALL_SCOPES` | Any | Show everywhere (default) |
| `ALL_FILLS` | COLOR | All fill properties (superset — cannot combine with TEXT_FILL etc.) |
| `FRAME_FILL` | COLOR | Frame backgrounds |
| `SHAPE_FILL` | COLOR | Shape fills |
| `TEXT_FILL` | COLOR | Text color — required for `fg/` tokens |
| `STROKE_COLOR` | COLOR | Border/stroke color |
| `EFFECT_COLOR` | COLOR | Shadow/blur effect color |
| `GAP` | FLOAT | Auto-layout gap spacing |
| `WIDTH_HEIGHT` | FLOAT | Width and height properties |
| `CORNER_RADIUS` | FLOAT | Border radius |
| `OPACITY` | FLOAT | Opacity (0-1) |
| `FONT_SIZE` | FLOAT | Text size |
| `LINE_HEIGHT` | FLOAT | Text line height |
| `LETTER_SPACING` | FLOAT | Text letter spacing |
| `PARAGRAPH_SPACING` | FLOAT | Text paragraph spacing |
| `FONT_WEIGHT` | FLOAT | Font weight |

> **Warning:** `ALL_FILLS` is a superset — don't combine with `TEXT_FILL`, `FRAME_FILL`, etc.

**Response:** `{ success: true }`

```json
{
  "command": "set_variable_scopes",
  "payload": {
    "variableId": "VariableID:94:308",
    "scopes": ["TEXT_FILL", "FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"]
  }
}
```

---

### `set_collection_scopes`

Set scopes for ALL variables in a collection at once.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collectionId` | string | Yes | Collection ID |
| `scopes` | string[] | Yes | Scopes to apply to every variable |

**Response:** `{ success: true, count: 42 }`

---

## 3. Collection Management Commands

### `hide_collection_from_publishing`

Hide a collection from being published to the team library.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collectionId` | string | Yes | Collection ID |
| `hidden` | boolean | Yes | `true` to hide, `false` to show |

**Response:** `{ success: true, collectionId, hidden }`

---

### `rename_collection`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collectionId` | string | Yes | Collection ID |
| `name` | string | Yes | New name |

**Response:** `{ success: true, collectionId, name }`

---

### `delete_collection`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collectionId` | string | Yes | Collection ID to delete |

**Response:** `{ success: true, deletedId }`

---

## 4. Mode Commands

### `set_explicit_variable_modes`

Pin a frame to a specific variable mode (e.g., force "Dark" mode on a preview frame).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Frame/component ID |
| `modeValues` | object[] | Yes | Array of `{ collectionId, modeId }` |

**Response:** `{ success: true, nodeId, bindings: 2 }`

```json
{
  "command": "set_explicit_variable_modes",
  "payload": {
    "nodeId": "123:456",
    "modeValues": [
      { "collectionId": "VariableCollectionId:90:2", "modeId": "90:3" }
    ]
  }
}
```

---

### `get_explicit_variable_modes`

Query which modes are pinned to a frame.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Frame ID |

**Response:** `{ nodeId, modes: { "collectionId": "modeId" } }`

---

### `clear_explicit_variable_modes`

Remove all mode overrides from a frame.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Frame ID |

**Response:** `{ success: true, nodeId, cleared: 2 }`

---

### `create_mode_switching_frames`

Create side-by-side frames showing the same content in different modes (e.g., Light vs. Dark preview).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceFrameId` | string | Yes | Frame to duplicate |
| `collectionId` | string | Yes | Collection with modes |
| `modeIds` | string[] | Yes | Modes to create frames for |

**Response:** `{ frames: [{ id, modeName }] }`

---

## 5. Style Commands

### `create_color_style`

Create a paint style (solid color).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Style name (e.g., `"Brand/Primary"`) |
| `color` | object | Yes | `{ r: 0-1, g: 0-1, b: 0-1 }` |
| `opacity` | number | No | 0-1 (default: 1) |
| `description` | string | No | Style description |

**Response:** `{ id, name }`

---

### `update_color_style`

Update an existing paint style (found by name).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Existing style name to find |
| `color` | object | No | New `{ r, g, b }` |
| `opacity` | number | No | New opacity |
| `description` | string | No | New description |

---

### `create_text_style`

Create a text style with font, size, and spacing properties.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Style name |
| `fontFamily` | string | Yes | Font family name |
| `fontStyle` | string | No | Weight/style (default: `"Regular"`) |
| `fontSize` | number | Yes | Size in pixels |
| `lineHeight` | object | No | `{ value, unit: "PIXELS" \| "PERCENT" \| "AUTO" }` |
| `letterSpacing` | object | No | `{ value, unit: "PIXELS" \| "PERCENT" }` |
| `textCase` | enum | No | `ORIGINAL`, `UPPER`, `LOWER`, `TITLE` |
| `description` | string | No | Style description |

**Response:** `{ id, name }`

> **Note:** The font must be installed on the machine. The plugin calls `figma.loadFontAsync()` automatically.

```json
{
  "command": "create_text_style",
  "payload": {
    "name": "Heading/H1",
    "fontFamily": "Libre Baskerville",
    "fontStyle": "Bold",
    "fontSize": 48,
    "lineHeight": { "value": 130, "unit": "PERCENT" },
    "letterSpacing": { "value": -0.5, "unit": "PIXELS" }
  }
}
```

---

### `update_text_style`

Update an existing text style (found by name).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Style name to find |
| `fontFamily` | string | No | New font family |
| `fontStyle` | string | No | New weight |
| `fontSize` | number | No | New size |
| `lineHeight` | object | No | New line height |
| `letterSpacing` | object | No | New letter spacing |
| `textCase` | enum | No | New text case |
| `description` | string | No | New description |

---

### `create_effect_style`

Create a shadow or blur effect style.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Style name |
| `effects` | object[] | Yes | Array of effect objects |
| `description` | string | No | Style description |

**Effect object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | enum | Yes | `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, `BACKGROUND_BLUR` |
| `color` | object | For shadows | `{ r, g, b, a }` — NOTE: uses `a` not separate opacity |
| `offset` | object | For shadows | `{ x, y }` in pixels |
| `radius` | number | No | Blur radius (default: 4) |
| `spread` | number | For shadows | Spread distance |
| `visible` | boolean | No | Default: true |

> **Critical:** Effect colors use `{ r, g, b, a }` with 4 components. Variable colors use `{ r, g, b }` with 3.

```json
{
  "command": "create_effect_style",
  "payload": {
    "name": "Shadow/Hard/md",
    "effects": [{
      "type": "DROP_SHADOW",
      "color": { "r": 0, "g": 0, "b": 0, "a": 1 },
      "offset": { "x": 4, "y": 4 },
      "radius": 0,
      "spread": 0
    }]
  }
}
```

---

### `update_effect_style`

Update an existing effect style (found by name).

---

### `create_grid_style`

Create a layout grid style.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Style name |
| `layoutGrids` | object[] | Yes | Array of grid definitions |
| `description` | string | No | Style description |

**Grid object:**

| Field | Type | For | Description |
|-------|------|-----|-------------|
| `pattern` | enum | All | `ROWS`, `COLUMNS`, `GRID` |
| `alignment` | enum | ROWS/COLUMNS | `MIN`, `MAX`, `STRETCH`, `CENTER` |
| `gutterSize` | number | ROWS/COLUMNS | Gap between rows/columns |
| `count` | number | ROWS/COLUMNS | Number of rows/columns |
| `sectionSize` | number | GRID | Grid cell size |
| `offset` | number | ROWS/COLUMNS | Margin offset |
| `color` | object | All | `{ r, g, b, a }` |

---

### `update_grid_style`

Update an existing grid style (found by name).

---

### `delete_style`

Delete any style by ID.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Style ID (e.g., `"S:abc123,"`) |

> **Note:** Figma style IDs include a trailing comma (e.g., `S:abc123,`). This is intentional.

---

## 6. Page Commands

### `create_page`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Page name (supports emoji: `"🎨 Colors"`) |

**Response:** `{ id, name }`

---

### `get_pages`

No payload required.

**Response:** `[{ id, name }, ...]`

---

### `set_current_page`

Navigate to a page (required before creating nodes on that page).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pageId` | string | Either | Page ID |
| `pageName` | string | Either | Page name (alternative) |

**Response:** `{ success: true, pageId }`

---

## 7. Frame & Layout Commands

### `create_frame`

Create a frame with optional auto-layout, parent nesting, and styling.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Frame name |
| `width` | number | No | Width in pixels |
| `height` | number | No | Height in pixels |
| `x` | number | No | X position |
| `y` | number | No | Y position |
| `parentId` | string | No | Parent frame/section ID for nesting |
| `cornerRadius` | number | No | Border radius |
| `fills` | object[] | No | Fill paints |
| `autoLayout` | object | No | Auto-layout shorthand (preferred) |
| `layoutMode` | enum | No | Legacy: `NONE`, `HORIZONTAL`, `VERTICAL` |

**`autoLayout` object (preferred format):**

| Field | Type | Description |
|-------|------|-------------|
| `mode` | enum | `VERTICAL` or `HORIZONTAL` |
| `itemSpacing` | number | Gap between children |
| `paddingTop` | number | Top padding |
| `paddingRight` | number | Right padding |
| `paddingBottom` | number | Bottom padding |
| `paddingLeft` | number | Left padding |
| `primaryAxisSizingMode` | enum | `FIXED` or `AUTO` (auto = grow to fit) |
| `counterAxisSizingMode` | enum | `FIXED` or `AUTO` |

**Response:** `{ id, name }`

> **Critical:** Without `parentId`, frames are placed at the page level. Always provide `parentId` to nest frames inside sections or other frames.

```json
{
  "command": "create_frame",
  "payload": {
    "name": "Content",
    "width": 1400,
    "parentId": "106:1100",
    "cornerRadius": 16,
    "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 }, "opacity": 0.05 }],
    "autoLayout": {
      "mode": "VERTICAL",
      "itemSpacing": 40,
      "paddingTop": 60, "paddingRight": 60,
      "paddingBottom": 60, "paddingLeft": 60,
      "primaryAxisSizingMode": "AUTO",
      "counterAxisSizingMode": "FIXED"
    }
  }
}
```

---

### `create_section`

Create a Figma section (collapsible group).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Section name |
| `x` | number | No | X position |
| `y` | number | No | Y position |
| `width` | number | No | Width (default: 1000) |
| `height` | number | No | Height (default: 1000) |

**Response:** `{ id, name }`

---

### `set_auto_layout`

Apply or modify auto-layout on an existing node.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Target node ID |
| `layoutMode` | enum | Yes | `HORIZONTAL`, `VERTICAL`, `NONE` |
| `primaryAxisSizingMode` | enum | No | `FIXED` or `AUTO` |
| `counterAxisSizingMode` | enum | No | `FIXED` or `AUTO` |
| `paddingTop/Right/Bottom/Left` | number | No | Padding values |
| `itemSpacing` | number | No | Gap between children |
| `counterAxisSpacing` | number | No | Wrap spacing |
| `layoutWrap` | enum | No | `NO_WRAP` or `WRAP` |

---

### `append_to_frame`

Move existing nodes into a frame as children.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `frameId` | string | Yes | Target frame ID |
| `childIds` | string[] | Yes | Node IDs to append |

---

## 8. Shape Commands

### `create_rectangle`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Node name |
| `width` | number | Yes | Width |
| `height` | number | Yes | Height |
| `x` | number | No | X position |
| `y` | number | No | Y position |
| `fills` | object[] | No | `[{ type: "SOLID", color: { r, g, b }, opacity? }]` |
| `cornerRadius` | number | No | Border radius |
| `strokes` | object[] | No | Stroke paints |
| `strokeWeight` | number | No | Stroke width |

---

### `create_ellipse`

Same fields as rectangle (minus `cornerRadius`).

---

### `create_vector`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Node name |
| `x`, `y` | number | No | Position |
| `vectorPaths` | object[] | Yes | `[{ windingRule, data }]` (SVG path data) |
| `fills` | object[] | No | Fill paints |
| `strokes` | object[] | No | Stroke paints |
| `strokeWeight` | number | No | Stroke width |
| `strokeCap` | enum | No | `NONE`, `ROUND`, `SQUARE`, `ARROW_LINES`, `ARROW_EQUILATERAL` |

---

### `create_line`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Node name |
| `length` | number | Yes | Line length in pixels |
| `x`, `y` | number | No | Position |
| `rotation` | number | No | Rotation in degrees |
| `strokes` | object[] | No | Stroke paints |
| `strokeWeight` | number | No | Stroke width |
| `strokeCap` | enum | No | `NONE`, `ROUND`, `SQUARE` |

---

## 9. Text Commands

### `create_text`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text content |
| `x`, `y` | number | No | Position |
| `fontSize` | number | No | Size in pixels |
| `fontFamily` | string | No | Font family (default: `"Switzer"`) |
| `fontStyle` | string | No | Weight (default: `"Regular"`) |
| `fills` | object[] | No | Text color fills |
| `width` | number | No | Fixed width (enables text wrapping) |
| `textAlignHorizontal` | enum | No | `LEFT`, `CENTER`, `RIGHT`, `JUSTIFIED` |

**Response:** `{ id, characters }`

---

### `update_text`

Update the text content of an existing text node.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Text node ID |
| `text` | string | Yes | New text content |
| `fontFamily` | string | No | Override font |
| `fontStyle` | string | No | Override weight |

**Response:** `{ id, characters, success }`

---

## 10. Node Manipulation Commands

### `get_node_info`

Get detailed information about any node.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node ID |

**Response:** Full node properties (type-dependent).

---

### `set_node_position`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node ID |
| `x` | number | Yes | New X position |
| `y` | number | Yes | New Y position |

---

### `resize_node`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node ID |
| `width` | number | No | New width |
| `height` | number | No | New height |

---

### `rename_node`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node ID |
| `name` | string | Yes | New name |

---

### `delete_node`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node ID to delete |

---

### `set_node_fills`

Set fill colors on a node.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node ID |
| `fills` | object[] | Yes | `[{ type: "SOLID", color: { r, g, b }, opacity? }]` |

---

### `apply_effect`

Apply effects (shadows, blurs) to a node.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node ID |
| `effects` | object[] | Yes | Effect array (same format as `create_effect_style`) |

---

### `bind_variable_to_node`

Bind a variable to a node property.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node ID |
| `variableId` | string | Yes | Variable ID |
| `field` | string | Yes | Property to bind (see `bind_variable` for full list) |

---

### `append_node_to_frame`

Move an existing node into a frame.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node to move |
| `frameId` | string | Yes | Destination frame |

---

### `move_node_to_page`

Move a node to a different page.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node to move |
| `targetPageId` | string | No | Target page ID |
| `targetPageName` | string | No | Target page name (alternative) |

---

## 11. Component Commands

### `create_component`

Create a component with full layout support.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Component name |
| `width`, `height` | number | No | Dimensions |
| `x`, `y` | number | No | Position |
| `description` | string | No | Component description |
| `fills` | object[] | No | Fill paints |
| `strokes` | object[] | No | Stroke paints |
| `strokeWeight` | number | No | Stroke width |
| `cornerRadius` | number | No | Border radius |
| `layoutMode` | enum | No | `NONE`, `HORIZONTAL`, `VERTICAL` |
| `itemSpacing` | number | No | Gap between children |
| `padding` | object | No | `{ top, right, bottom, left }` |
| `primaryAxisAlignItems` | enum | No | `MIN`, `CENTER`, `MAX`, `SPACE_BETWEEN` |
| `counterAxisAlignItems` | enum | No | `MIN`, `CENTER`, `MAX`, `BASELINE` |
| `primaryAxisSizingMode` | enum | No | `FIXED`, `AUTO` |
| `counterAxisSizingMode` | enum | No | `FIXED`, `AUTO` |

**Response:** `{ id, name, key }`

---

### `create_component_set`

Group components into a component set (variants).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Set name |
| `componentIds` | string[] | Yes | Component IDs to group |

---

### `create_instance`

Create an instance of a component.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `componentId` | string | Yes | Source component ID |
| `x`, `y` | number | No | Position |
| `name` | string | No | Override name |

---

### `bind_variable`

Bind a variable to a component/frame property (fills, strokes, spacing, etc.).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Node ID |
| `property` | enum | Yes | Property to bind |
| `variableId` | string | Yes | Variable ID |
| `index` | number | No | Array index (for fills/strokes) |

**Bindable properties:** `fills`, `strokes`, `effects`, `layoutGrids`, `opacity`, `visible`, `cornerRadius`, `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`, `itemSpacing`, `strokeWeight`, `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`

---

### `set_component_properties`

Add component properties (boolean toggles, text overrides, etc.).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `componentId` | string | Yes | Component/set ID |
| `properties` | object[] | Yes | Property definitions |

**Property object:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Property name |
| `type` | enum | `BOOLEAN`, `TEXT`, `INSTANCE_SWAP`, `VARIANT` |
| `defaultValue` | mixed | Default value |

---

### `add_component_description`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodeId` | string | Yes | Component ID |
| `description` | string | Yes | Description text |

---

### `set_instance_swap_property` / `swap_instance`

Instance swap operations for variant/property management.

---

## 12. Query Commands

### `get_variable_collections` / `get_collections`

No payload. Returns all variable collections with their modes.

**Response:** `[{ id, name, modes: [{ modeId, name }] }]`

---

### `get_variables`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collectionId` | string | Yes | Collection ID |

**Response:** `[{ id, name, resolvedType, collectionId }]`

---

### `get_vars` / `get_vars_detailed`

Get variables with full scope and value information.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collectionId` | string | No | Filter by collection |

**Response:** Full variable details including scopes, values per mode, and descriptions.

---

### `get_local_styles`

No payload. Returns all local paint, text, and effect styles.

**Response:** `{ paintStyles: [...], textStyles: [...], effectStyles: [...] }`

---

### `get_grid_styles`

No payload. Returns all grid styles.

---

### `get_page_children`

List top-level children of a page.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pageName` | string | No | Page name (default: current page) |

**Response:** `[{ id, name, type, x, y, width, height }]`

---

### `get_frame_children`

List children of a specific frame.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `frameId` | string | Yes | Frame ID |

---

### `get_local_components`

No payload. Returns all components across all pages.

**Response:** `[{ id, name, key, description, x, y, pageId, pageName }]`

---

### `get_selection`

No payload. Returns currently selected nodes.

---

### `get_file_info`

No payload. Returns file name, ID, and current page.

---

## 13. Library Commands

### `import_component_by_key`

Import a component from a team library by its key.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Component key |

**Response:** `{ id, name, componentKey }`

---

### `search_library_components`

Search available team library components.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search term |

**Response:** `[{ key, name, description, libraryName }]`

---

### `get_available_library_components`

No payload. Lists all importable library components.

---

### `batch_import_and_flatten`

Import multiple library components, flatten to vectors, and position them.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `components` | object[] | Yes | Array of `{ key, name, x?, y? }` |

---

## 14. SVG & Icon Commands

### `create_from_svg`

Create a Figma node from raw SVG markup.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `svg` | string | Yes | SVG markup string |
| `name` | string | No | Node name |
| `x`, `y` | number | No | Position |

---

### `batch_create_icons_from_svg`

Batch import multiple SVG icons.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `icons` | object[] | Yes | Array of `{ svg, name, x?, y? }` |

---

### `process_temp_icons`

Process icons from a temporary page into final organized components.

---

### `clone_and_convert_icon`

Clone a node and convert it to a component.

---

### `batch_move_to_page`

Move multiple nodes to a target page.

---

### `scan_page_instances`

Scan a page for all component instances.

---

### `flatten_and_rename_instances`

Flatten instances to vectors and rename them.

---

### `extract_temp_icons` / `extract_single_category` / `get_category_list`

Extract and categorize icons from a source page.

---

## 15. Style Remapping Commands

### `analyze_page_styles`

Analyze all style usage on a page.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pageName` | string | No | Page name (default: current) |

**Response:** Detailed analysis of paint, text, and effect style usage with counts and node lists.

---

### `remap_paint_styles`

Remap paint style references from one style to another.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mappings` | object[] | Yes | Array of `{ fromStyleId, toStyleId }` |
| `pageName` | string | No | Scope to specific page |

---

### `remap_text_styles`

Remap text style references.

---

### `remap_effect_styles`

Remap effect style references.

---

## 16. Batch Commands (Optimized)

These commands are optimized for the `build-figma-ds.js` build pipeline. They reduce hundreds of individual round-trips to a single command.

### `batch_create_variables`

Create many variables at once with values and scopes (Pass 1 of two-pass pattern).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collectionId` | string | Yes | Target collection |
| `variables` | object[] | Yes | Variable definitions |

**Variable definition:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Variable name |
| `resolvedType` | enum | Yes | `COLOR`, `FLOAT`, `STRING`, `BOOLEAN` |
| `values` | object | Yes | `{ "modeId": value }` — raw values only |
| `scopes` | string[] | No | Variable scopes |
| `description` | string | No | Variable description |

**Response:** `{ created: 90, varIds: { "pink/500": "VariableID:94:12", ... }, errors: [] }`

> **Important:** Only pass raw values (colors, numbers). Aliases are set in Pass 2.

```json
{
  "command": "batch_create_variables",
  "payload": {
    "collectionId": "VariableCollectionId:90:2",
    "variables": [
      {
        "name": "pink/500",
        "resolvedType": "COLOR",
        "values": { "90:0": { "r": 0.984, "g": 0.471, "b": 0.471 } },
        "scopes": ["ALL_FILLS"]
      },
      {
        "name": "spacing/4",
        "resolvedType": "FLOAT",
        "values": { "90:0": 4 },
        "scopes": ["GAP", "WIDTH_HEIGHT"]
      }
    ]
  }
}
```

---

### `batch_set_variable_aliases`

Set VARIABLE_ALIAS references for alias/mapped variables (Pass 2).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `aliases` | object[] | Yes | Alias references |

**Alias reference:**

| Field | Type | Description |
|-------|------|-------------|
| `variableId` | string | Source variable (the alias) |
| `modeId` | string | Mode ID |
| `aliasTargetId` | string | Target variable (what it points to) |

**Response:** `{ set: 39, errors: [] }`

```json
{
  "command": "batch_set_variable_aliases",
  "payload": {
    "aliases": [
      {
        "variableId": "VariableID:94:100",
        "modeId": "94:0",
        "aliasTargetId": "VariableID:94:12"
      }
    ]
  }
}
```

---

### `batch_create_styles`

Create text styles and effect styles in a single command with automatic font pre-loading.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `textStyles` | object[] | No | Text style definitions |
| `effectStyles` | object[] | No | Effect style definitions |

**Response:** `{ textStyleIds: {...}, effectStyleIds: {...}, textCount: 14, effectCount: 4, errors: [] }`

```json
{
  "command": "batch_create_styles",
  "payload": {
    "textStyles": [
      {
        "name": "Heading/H1",
        "fontFamily": "Libre Baskerville",
        "fontStyle": "Bold",
        "fontSize": 48,
        "lineHeight": { "value": 130, "unit": "PERCENT" }
      }
    ],
    "effectStyles": [
      {
        "name": "Shadow/Hard/sm",
        "effects": [{
          "type": "DROP_SHADOW",
          "color": { "r": 0, "g": 0, "b": 0, "a": 1 },
          "offset": { "x": 2, "y": 2 },
          "radius": 0, "spread": 0
        }]
      }
    ]
  }
}
```

---

## 17. Visual Hierarchy Commands

These commands create pre-built visual layouts for design system documentation pages.

### `create_color_swatches_group`

Create a grid of color swatches bound to variables.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Group name |
| `parentFrameId` | string | Yes | Parent frame ID |
| `swatches` | object[] | Yes | `[{ variableId, name, description }]` |

---

### `create_typography_group`

Create a typography specimen showing text styles.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Group name |
| `parentFrameId` | string | Yes | Parent frame ID |
| `styles` | object[] | Yes | `[{ id, name, fontSize, fontName: { family, style } }]` |

---

### `create_effect_group`

Create an effect showcase with shadow/blur previews.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Group name |
| `parentFrameId` | string | Yes | Parent frame ID |
| `effects` | object[] | Yes | Effect style definitions with previews |

---

### `create_grid_group`

Create a grid style showcase.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Group name |
| `parentFrameId` | string | Yes | Parent frame ID |
| `gridStyles` | object[] | Yes | Grid definitions |

---

## 18. Utility Commands

### `clear_page_children`

Delete all children from a page (useful for rebuilds).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pageName` | string | No | Page name (default: current page) |

**Response:** `{ success: true, deletedCount: 10 }`

---

### `get_file_info`

No payload.

**Response:** `{ name, id, currentPage }`

---

## Server API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/status` | GET | Plugin connection status + file info |
| `/command` | POST | Send command to plugin |
| `/poll` | GET | Plugin polls for pending commands |
| `/response` | POST | Plugin returns command results |

### Health Check

```bash
curl http://localhost:9877/health
# → { "status": "ok", "uptime": 3600 }
```

### Connection Status

```bash
curl http://localhost:9877/status
# → { "connected": true, "fileInfo": { "name": "...", "currentPage": "..." }, "pendingCommands": 0 }
```

---

## Color Format Quick Reference

| Context | Format | Example |
|---------|--------|---------|
| Variable value | `{ r, g, b }` (3 fields, 0-1) | `{ "r": 0.984, "g": 0.471, "b": 0.471 }` |
| Fill paint | `{ r, g, b }` + separate `opacity` | `{ "color": {...}, "opacity": 0.8 }` |
| Effect color | `{ r, g, b, a }` (4 fields, 0-1) | `{ "r": 0, "g": 0, "b": 0, "a": 0.25 }` |
| Grid color | `{ r, g, b, a }` (4 fields, 0-1) | `{ "r": 1, "g": 0, "b": 0, "a": 0.1 }` |

**Hex to normalized:** Divide by 255. Example: `#FB7878` → `{ r: 0.984, g: 0.471, b: 0.471 }`

---

## Known Quirks & Gotchas

These are real issues discovered during production builds. They're not in any official Figma documentation.

| # | Gotcha | What Happens | Fix |
|---|--------|-------------|-----|
| 1 | `createFrame` ignores position when `parentId` is used | Frame gets placed at parent's local origin (0,0), not at `x/y` you specified | After `appendChild`, re-set `frame.x` and `frame.y` if needed |
| 2 | `SectionNode` has no auto-layout | Setting `layoutMode` on a section silently does nothing | Put a Frame inside the section, give IT the auto-layout |
| 3 | Missing `a` field in effect color = invisible shadow | Default alpha is `0`, not `1` | Always pass `"a": 1.0` in effect colors |
| 4 | `ALL_FILLS` + `TEXT_FILL` = error | `ALL_FILLS` is a superset scope — can't combine with subset scopes | Use `ALL_FILLS` alone, OR list individual scopes |
| 5 | Style IDs have trailing comma | `"S:abc123,"` — the comma is part of the ID | Keep the comma when referencing style IDs |
| 6 | `delete_node` uses `nodeId`, not `id` | Payload field mismatch causes `"Node not found: undefined"` | Send `{ "nodeId": "123:456" }` |
| 7 | Fonts must be installed locally | `figma.loadFontAsync` checks the local machine, not Figma servers | Verify fonts exist before text style creation |
| 8 | `primaryAxisSizingMode` defaults to `FIXED` | Auto-layout frames don't grow to fit children | Set `primaryAxisSizingMode: "AUTO"` explicitly |
| 9 | HTTP body key must be `payload` not `params` | Some examples use `params` — the plugin handler reads `payload` | Always use `"payload": { ... }` in the JSON body |
| 10 | Spread operators crash the Figma VM | `{...obj}` causes "stack underflow" | Use `Object.assign({}, obj)` instead |

---

*Last Updated: 2026-02-18 — Nectar Design Toolkit v2.0*
