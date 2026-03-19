# Best Practices — Building a Design System with Nectar Design Toolkit

**Version:** 1.0.0
**Last Updated:** 2026-02-18
**Author:** Tushar Kant Naik

> A field guide for designers, developers, and AI agents building production Figma design systems using the Nectar Design Toolkit's automated pipeline.

---

## Table of Contents

1. [Token Architecture](#1-token-architecture)
2. [Figma API Rules](#2-figma-api-rules)
3. [Variable Best Practices](#3-variable-best-practices)
4. [Style Best Practices](#4-style-best-practices)
5. [Visual Hierarchy & Layout](#5-visual-hierarchy--layout)
6. [Build Pipeline](#6-build-pipeline)
7. [Plugin Development](#7-plugin-development)
8. [Orchestration Patterns](#8-orchestration-patterns)
9. [Error Recovery](#9-error-recovery)
10. [Performance](#10-performance)
11. [Lessons from the Field](#11-lessons-from-the-field)

---

## 1. Token Architecture

### Use a 3-Tier Token Hierarchy

The most maintainable design systems separate raw values from meaning from usage. Structure your tokens as:

```
Tier 1: Seed (Primitives)     "What it is"      → #FFE082, 16px, 700
Tier 2: Alias (Semantic)      "What it means"    → primary, spacing-md, bold
Tier 3: Mapped (Contextual)   "Where it's used"  → button-bg (light: #FFE082, dark: #C9A83B)
```

**Why this matters:** Changing a brand color updates one seed token. Aliases automatically follow. Mapped tokens can override per-mode without breaking the chain.

### Seed Tokens: Keep Them Flat and Dumb

Seed tokens should be raw values with no semantic meaning. They're building blocks.

```json
// seed.json — GOOD: flat, descriptive names
{
  "color": {
    "pastel": {
      "honey": { "value": "#FFE082", "type": "color" },
      "sky":   { "value": "#D5E8F5", "type": "color" }
    }
  },
  "spacing": {
    "1":  { "value": "4",  "type": "number" },
    "4":  { "value": "16", "type": "number" },
    "8":  { "value": "32", "type": "number" }
  }
}
```

```json
// BAD: semantic names in seed layer
{
  "primary-color": "#FFE082",
  "large-spacing": "32"
}
```

### Alias Tokens: Reference Seeds with `{seed.path}` Syntax

Alias tokens give meaning to primitives. Always reference seeds — never hard-code values.

```json
// alias.json
{
  "color": {
    "primary": { "value": "{seed.color.pastel.honey}", "description": "Primary brand color" },
    "accent":  { "value": "{seed.color.pastel.skyMid}", "description": "Cool complement" }
  },
  "spacing": {
    "md": { "value": "{seed.spacing.4}", "description": "16px — default gap" }
  }
}
```

### Mapped Tokens: Design for Mode Switching

Mapped tokens are the only tier that supports multiple modes (light/dark, compact/comfortable). Keep names short — these are what consumers see.

```json
// mapped.json
{
  "modes": {
    "light": {
      "color": {
        "bg":      { "value": "#FFFDF5" },
        "fg":      { "value": "#3E3A44" },
        "primary": { "value": "#FFE082" }
      }
    },
    "dark": {
      "color": {
        "bg":      { "value": "#1A1A2E" },
        "fg":      { "value": "#F0EDED" },
        "primary": { "value": "#C9A83B" }
      }
    }
  }
}
```

### Name Variables with Slash Paths

Figma displays slash-separated names as folder groups in the variables panel.

```
GOOD                          BAD
color/pastel/honey            color-pastel-honey
typography/fontSize/xl        typographyFontSizeXL
spacing/8                     spacing8
```

### Respect the Dependency Chain

Variables must be created in strict order because aliases reference seeds:

```
Seed → Alias → Mapped → Styles → Visual Hierarchy
```

Never try to create an alias before its seed target exists. The toolkit enforces this with its two-pass import pattern:
1. **Pass 1:** Create variables with raw fallback values
2. **Pass 2:** Resolve `VARIABLE_ALIAS` references to actual seed IDs

---

## 2. Figma API Rules

These rules were discovered through production builds and are critical for avoiding silent failures.

### Color Format Varies by Context

This is the single most confusing aspect of the Figma API. Different contexts require different color object shapes:

| Context | Format | Example |
|---------|--------|---------|
| Variable values | `{ r, g, b }` | `{ r: 1, g: 0.88, b: 0.51 }` |
| Fill/Stroke paints | `{ r, g, b }` + separate `opacity` | `color: { r, g, b }, opacity: 0.8` |
| Effect shadow colors | `{ r, g, b, a }` | `{ r: 0.85, g: 0.83, b: 0.82, a: 1 }` |

```javascript
// Helper that returns the safe base format (no 'a')
function hexToFigmaColor(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.substr(0, 2), 16) / 255,
    g: parseInt(hex.substr(2, 2), 16) / 255,
    b: parseInt(hex.substr(4, 2), 16) / 255
  };
}

// For effects, add 'a' explicitly:
var rgb = hexToFigmaColor('#D9D5D2');
var shadowColor = { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };
```

**Rule:** Default to `{ r, g, b }`. Only add `a` for effect shadow/glow colors.

### Variable Scopes: Don't Combine Supersets with Subsets

Figma scopes control where a variable appears in the UI (fill picker, text fill, stroke, etc.). `ALL_FILLS` is a **superset** that includes `FRAME_FILL`, `SHAPE_FILL`, and `TEXT_FILL`.

```javascript
// WRONG — causes "Invalid scope combination" error
scopes: ['ALL_FILLS', 'TEXT_FILL']

// CORRECT — use the superset alone
scopes: ['ALL_FILLS']

// CORRECT — use specific subsets if you need fine control
scopes: ['FRAME_FILL', 'TEXT_FILL']
```

### Scope Assignment Strategy

Assign scopes based on what the variable represents, not what it could theoretically be used for:

| Token Pattern | Scopes | Reasoning |
|--------------|--------|-----------|
| `bg`, `surface`, `card` | `['ALL_FILLS']` | Backgrounds are fill-only |
| `fg`, `muted`, `*-fg` | `['TEXT_FILL']` | Text colors should only appear in text pickers |
| `border`, `ring`, `outline-border` | `['STROKE_COLOR']` | Border tokens for strokes only |
| `shadow` | `['EFFECT_COLOR']` | Shadows only in effect pickers |
| `button`, `outline` | `['ALL_FILLS']` | Interactive elements need flexibility |
| Generic/seed colors | `['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR']` | Broad availability |

### Style IDs Include Trailing Commas

Figma style IDs have a format like `S:abc123def456,` — note the trailing comma. This is **not a parsing bug**. Include the full ID with comma when referencing or deleting styles.

```javascript
// This is a valid Figma style ID:
"S:9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b,"

// Don't strip the comma!
```

### Use Async API Methods

Figma's plugin VM (QuickJS) prefers async methods. The sync versions are deprecated and may cause timeouts.

```typescript
// WRONG — sync (deprecated)
const styles = figma.getLocalPaintStyles();
rect.effectStyleId = style.id;

// CORRECT — async
const styles = await figma.getLocalPaintStylesAsync();
await rect.setEffectStyleIdAsync(style.id);
```

All async APIs to prefer:
- `figma.getLocalPaintStylesAsync()`
- `figma.getLocalTextStylesAsync()`
- `figma.getLocalEffectStylesAsync()`
- `figma.variables.getLocalVariablesAsync()`
- `figma.variables.getLocalVariableCollectionsAsync()`
- `node.setEffectStyleIdAsync(id)`

### Effect Styles Require `blendMode`

Every effect (drop shadow, inner shadow, blur) must include `blendMode: 'NORMAL'`. Omitting it causes a silent creation failure.

```javascript
// WRONG — missing blendMode
effects: [{
  type: 'DROP_SHADOW',
  color: { r: 0.85, g: 0.83, b: 0.82, a: 1 },
  offset: { x: 4, y: 4 },
  radius: 0
}]

// CORRECT
effects: [{
  type: 'DROP_SHADOW',
  color: { r: 0.85, g: 0.83, b: 0.82, a: 1 },
  offset: { x: 4, y: 4 },
  radius: 0,
  spread: 0,
  visible: true,
  blendMode: 'NORMAL'
}]
```

### `transparent` Is Not a Valid Color Variable

Figma COLOR variables cannot hold `transparent`. Skip tokens with `transparent` values when creating variables, or use a mapped token with `opacity: 0` on the paint instead.

```javascript
if (lightValue === 'transparent' || darkValue === 'transparent') {
  console.log('Skipping transparent: ' + key);
  continue;
}
```

---

## 3. Variable Best Practices

### Batch Variable Creation

Creating variables one-by-one means hundreds of HTTP round-trips. Use batch commands to create all variables in a single command per collection.

```javascript
// Instead of 90 individual create_variable calls:
await sendCommand('batch_create_variables', {
  collectionId: seedCollectionId,
  variables: allSeedVarDefs   // Array of { name, resolvedType, values, scopes }
});
```

The toolkit's batch commands reduce ~580 round-trips to ~14 commands for a 161-variable system.

### Two-Pass Alias Resolution

Alias variables reference other variables via `VARIABLE_ALIAS`. But you can't set an alias until the target variable exists AND you have its ID.

**Pattern:**
1. Create alias variables with raw fallback values (the resolved hex/number)
2. Collect all created variable IDs from the batch response
3. Set `VARIABLE_ALIAS` references in a second batch pass

```javascript
// Pass 1: Create with raw values
var result = await sendCommand('batch_create_variables', {
  collectionId: aliasColId,
  variables: aliasVars.map(v => ({
    name: v.name,
    resolvedType: v.type,
    values: { [modeId]: v.rawValue },  // Fallback hex/number
    scopes: v.scopes
  }))
});

// Pass 2: Resolve aliases
await sendCommand('batch_set_variable_aliases', {
  aliases: pendingAliases.map(a => ({
    variableId: result.varIds[a.name],
    modeId: modeId,
    aliasTargetId: seedVarIds[a.seedRef]
  }))
});
```

### Collection Naming Convention

Keep collection names short and meaningful. Figma displays them in variable pickers.

| Name | Purpose | Modes |
|------|---------|-------|
| `Seed` | Raw primitives | 1 (default) |
| `Alias` | Semantic tokens | 1 (default) |
| `Mapped` | Theme tokens | 2+ (Light, Dark) |

### Include Descriptions

Variable descriptions appear as tooltips in Figma. Add them for anything non-obvious:

```json
{
  "primary": {
    "value": "{seed.color.pastel.honey}",
    "description": "Primary brand color (honey golden)"
  }
}
```

---

## 4. Style Best Practices

### Font Weight Mapping

Figma uses font style strings (Regular, Medium, Bold), not numeric weights (400, 500, 700). Map them correctly — and verify fonts are actually installed:

```javascript
var weightToStyle = {
  400: 'Regular',
  500: 'Medium',
  600: 'Medium',   // Note: Many fonts don't have SemiBold (600)
  700: 'Bold'
};
```

**Common pitfall:** Not all fonts have all weights. Switzer has Regular, Medium, and Bold — but not SemiBold. If a weight isn't available, fall back to the nearest available weight.

### Line Height: Use Computed Pixels

Figma expects line height as a computed pixel value, not a multiplier:

```javascript
// WRONG — Figma doesn't understand multipliers
lineHeight: 1.5

// CORRECT — computed from fontSize * multiplier
lineHeight: { value: fontSize * 1.5, unit: 'PIXELS' }
```

### Style Naming with Slash Groups

Like variables, styles support slash-based grouping:

```
Heading/H1          → grouped under "Heading" folder
Title/Title 1       → grouped under "Title" folder
Body/Base           → grouped under "Body" folder
Shadow/Medium       → grouped under "Shadow" folder
```

### Don't Duplicate: Check Before Creating

When re-running builds, always check for existing styles to avoid duplicates:

```javascript
var existingStyles = await sendCommand('get_local_styles', {});
// Check existingStyles.textStyles, existingStyles.effectStyles, etc.
```

Or use the `clear_page_children` command to reset visual hierarchy before rebuilding.

---

## 5. Visual Hierarchy & Layout

### Parent Frames Inside Sections with `appendChild`

The most critical layout rule: `figma.createFrame()` always places the frame at the **page level**. To nest it inside a section or another frame, you must explicitly reparent it:

```typescript
// In the plugin — createFrame handler
const frame = figma.createFrame();
frame.name = payload.name;

// CRITICAL: Move into parent
if (payload.parentId) {
  const parent = await figma.getNodeByIdAsync(payload.parentId);
  if (parent && 'appendChild' in parent) {
    (parent as FrameNode | SectionNode).appendChild(frame);
  }
}
```

Without this, all frames appear as siblings at the page level, overlapping each other.

### Use Auto-Layout with `primaryAxisSizingMode: AUTO`

Content frames should grow to fit their children. Set `primaryAxisSizingMode: 'AUTO'` so the frame expands vertically:

```javascript
autoLayout: {
  mode: 'VERTICAL',
  itemSpacing: 40,
  paddingLeft: 60, paddingRight: 60,
  paddingTop: 40, paddingBottom: 40,
  primaryAxisSizingMode: 'AUTO',     // Height grows with content
  counterAxisSizingMode: 'FIXED'     // Width stays fixed
}
```

### Section Spacing

Sections don't support auto-layout. Space them using fixed Y offsets with generous gaps:

```javascript
var sectionPositions = [
  { name: 'Seed Colors',    y: 0,    height: 1200 },
  { name: 'Mapped Colors',  y: 1400, height: 1200 },  // 200px gap
  { name: 'Typography',     y: 2800, height: 1400 },  // 200px gap
  { name: 'Shadows',        y: 4400, height: 800 },   // 200px gap
  { name: 'Spacing Scale',  y: 5400, height: 600 }    // 200px gap
];
```

**Rule of thumb:** Leave at least 200px between sections for visual breathing room.

### Page Organization Pattern

Use emoji-prefixed page names for clear visual hierarchy in Figma's page panel:

```
📋 Cover
🎨 Foundations    ← Colors, typography, spacing, shadows
🧩 Components    ← Buttons, inputs, cards, badges
📐 Layout        ← Grid system, breakpoints, containers
📖 Templates     ← Page-level compositions
```

### Check for Duplicate Pages

Always check existing pages before creating new ones:

```javascript
var existingPages = await sendCommand('get_pages', {});
var existingNames = new Set(existingPages.map(p => p.name));
if (!existingNames.has(pageName)) {
  await sendCommand('create_page', { name: pageName });
}
```

---

## 6. Build Pipeline

### Use `--step` for Incremental Builds

Don't re-run the entire build when only one layer changed. The toolkit supports step isolation:

```bash
node build-figma-ds.js --step variables   # Steps 1-3 only
node build-figma-ds.js --step styles      # Steps 4-5 only
node build-figma-ds.js --step pages       # Step 6 only
node build-figma-ds.js --step visual      # Step 7 only (fetches existing IDs)
node build-figma-ds.js --dry-run          # Validate without sending
```

### Always Dry-Run First

Before any live build, verify your token structure:

```bash
node build-figma-ds.js --dry-run
```

This prints all commands that would be sent without touching Figma. Check:
- Variable counts match expectations
- No duplicate names
- All alias references resolve
- Style definitions are complete

### Clean Before Rebuild

When re-running the visual hierarchy step, clear the page first:

```bash
# Via the plugin command:
curl -X POST http://localhost:9877/command \
  -H "Content-Type: application/json" \
  -d '{"command":"clear_page_children","params":{"pageName":"🎨 Foundations"}}'
```

This removes all children from the specified page, giving you a clean slate.

### Pre-Flight Check

The build script includes an automatic pre-flight check that verifies:
1. Orchestration server is reachable
2. Plugin is connected
3. Target file name is correct

If any check fails, the script exits with clear instructions.

---

## 7. Plugin Development

### Target ES2017

Figma's plugin VM (QuickJS) doesn't support ES2018+ features:

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017"
  }
}
```

### Forbidden Syntax in Figma VM

```typescript
// FORBIDDEN — causes "stack underflow" or runtime errors
const merged = { ...obj1, ...obj2 };     // Object spread
function* gen() { yield 1; }             // Generators
const result = arr?.map(x => x.id);      // Optional chaining (ES2020)

// SAFE alternatives
const merged = Object.assign({}, obj1, obj2);
// Use explicit null checks instead of optional chaining
```

### CSS Limitations in Plugin Iframe

The plugin UI runs in a sandboxed iframe with restricted CSS support:

```css
/* FORBIDDEN — elements render but are invisible */
.container {
  contain: strict;
  content-visibility: auto;
  backdrop-filter: blur(8px);
}

/* SAFE */
.container {
  contain: layout style;    /* Only layout + style containment */
  will-change: transform;   /* GPU acceleration hint */
}
```

### Rebuild After Plugin Changes

After modifying `code.ts`, you must:

```bash
# 1. Compile
cd figma-plugin && npm run build

# 2. Reload in Figma
# Close the plugin window, then reopen:
# Plugins → Development → Portfolio DS Builder
```

The orchestration server does NOT need restarting — only the plugin needs reloading.

### Error Logging Format

Use consistent prefixed logging in plugin code:

```typescript
console.log('[Plugin] Action description');      // Info
console.warn('[Plugin] Warning message');         // Warning
console.error('[Plugin] Error details:', error);  // Error
```

---

## 8. Orchestration Patterns

### HTTP Polling Architecture

The toolkit uses HTTP polling (not WebSocket) because Figma's plugin sandbox blocks direct socket connections. The flow is:

```
Build Script                Orchestration Server         Figma Plugin
     │                              │                         │
     │  POST /command               │                         │
     │─────────────────────>        │                         │
     │                              │   GET /poll (every 50ms)│
     │                              │<────────────────────────│
     │                              │   { hasCommand: true }  │
     │                              │────────────────────────>│
     │                              │                  [executes command]
     │                              │   POST /response        │
     │                              │<────────────────────────│
     │    { result }                │                         │
     │<─────────────────────        │                         │
```

### Command Timeout

Commands have a default timeout. If the plugin is busy with a large operation, increase the delay between commands:

```javascript
await sendCommand('batch_create_variables', { /* 90 variables */ });
await delay(500);  // Give the plugin time to finish

await sendCommand('batch_set_variable_aliases', { /* 34 aliases */ });
await delay(300);
```

### Health Check Before Commands

Always verify the server and plugin connection before sending commands:

```bash
# Server alive?
curl http://localhost:9877/health
# → {"ok":true}

# Plugin connected?
curl http://localhost:9877/status
# → {"connected":true,"fileInfo":{"name":"Nectar Core"}}
```

### Batch Commands Reduce Latency

Each HTTP round-trip adds ~50-100ms of latency. Batch commands combine many operations into one:

| Approach | Commands | Latency |
|----------|----------|---------|
| Individual `create_variable` | 90 calls | ~9 seconds |
| `batch_create_variables` | 1 call | ~200ms |

The toolkit provides three batch commands:
- `batch_create_variables` — Create all variables in one collection
- `batch_set_variable_aliases` — Set all alias references at once
- `batch_create_styles` — Create all text and effect styles together

---

## 9. Error Recovery

### Clear and Rebuild Strategy

When a build produces incorrect results, the safest approach is:

1. Delete the broken collections/styles
2. Clear the visual hierarchy page
3. Re-run the full build

```bash
# Clear everything and rebuild
curl -X POST http://localhost:9877/command \
  -d '{"command":"clear_page_children","params":{"pageName":"🎨 Foundations"}}'

node build-figma-ds.js --step visual
```

### Collection Deletion

To delete a variable collection (removes all variables in it):

```bash
curl -X POST http://localhost:9877/command \
  -d '{"command":"delete_collection","params":{"id":"VariableCollectionId:3:123"}}'
```

### Style Deletion

Delete styles one at a time using the full ID (including trailing comma):

```bash
curl -X POST http://localhost:9877/command \
  -d '{"command":"delete_style","params":{"id":"S:abc123def456,"}}'
```

### Page Children Cannot Include Pages

The `delete_node` command works for frames, sections, rectangles, and text — but **not** for pages. Pages can only be deleted manually in Figma.

### Figma's Undo Works

If something goes catastrophically wrong, Figma's native Undo (Cmd+Z / Ctrl+Z) works for all plugin operations. You can undo an entire batch of variable creations by pressing undo multiple times.

---

## 10. Performance

### Delay Between Heavy Operations

Large batch operations (100+ variables, complex style creation) can cause the Figma plugin to momentarily block. Add delays between steps:

```javascript
await sendCommand('batch_create_variables', { /* large batch */ });
await delay(500);  // Breathe

await sendCommand('batch_create_styles', { /* many styles */ });
await delay(300);
```

### Keep `get_local_styles` Lightweight

The `get_local_styles` command only returns `{ id, name }` per style — not full style data (no fontSize, fontName, effects, etc.). If you need full data, maintain a known-definitions lookup:

```javascript
var knownTextDefs = {
  'Heading/H1': { fontSize: 61, fontFamily: 'Libre Baskerville', fontStyle: 'Bold' },
  'Body/Base':  { fontSize: 16, fontFamily: 'Switzer', fontStyle: 'Regular' }
};
```

### Minimize Page Switches

`set_current_page` triggers a page load in Figma. Batch all operations for a single page before switching:

```javascript
// GOOD: All Foundations work, then switch
await sendCommand('set_current_page', { name: '🎨 Foundations' });
// ... create all sections, frames, swatches ...

// BAD: Switching back and forth
await sendCommand('set_current_page', { name: '🎨 Foundations' });
// ... create section ...
await sendCommand('set_current_page', { name: '🧩 Components' });
// ... one thing ...
await sendCommand('set_current_page', { name: '🎨 Foundations' });
// ... another section ...
```

### Poll Interval Tuning

The plugin polls the server every 50ms for commands. This provides near-instant response. If you're running on a slower machine, increase to 100ms in `ui.html`:

```javascript
const POLL_INTERVAL = 50;   // Default: 50ms (fast)
// Increase to 100ms if seeing connection drops on slower hardware
```

---

## Quick Reference Card

### Color Format Cheat Sheet

```
Variable value    → { r, g, b }          (NO alpha)
Fill/stroke paint → { r, g, b }          (opacity on the paint object)
Effect color      → { r, g, b, a }       (alpha REQUIRED)
```

### Scope Compatibility

```
ALL_FILLS    = FRAME_FILL + SHAPE_FILL + TEXT_FILL  (superset)
ALL_SCOPES   = everything                           (use sparingly)
```

Never combine `ALL_FILLS` with `TEXT_FILL` or `FRAME_FILL`.

### Build Command Cheat Sheet

```bash
node build-figma-ds.js                    # Full build
node build-figma-ds.js --dry-run          # Validate only
node build-figma-ds.js --step variables   # Variables only
node build-figma-ds.js --step styles      # Styles only
node build-figma-ds.js --step visual      # Visual hierarchy only
```

### Cleanup Commands

```bash
# Clear page content
curl -X POST http://localhost:9877/command \
  -d '{"command":"clear_page_children","params":{"pageName":"PAGE_NAME"}}'

# Delete collection
curl -X POST http://localhost:9877/command \
  -d '{"command":"delete_collection","params":{"id":"COLLECTION_ID"}}'

# Delete style (include trailing comma in ID!)
curl -X POST http://localhost:9877/command \
  -d '{"command":"delete_style","params":{"id":"STYLE_ID_WITH_COMMA,"}}'
```

---

## 11. Lessons from the Field

> These are real issues encountered during multi-session builds of Nectar Core.
> Each one cost debugging time and is not documented in the Figma API reference.

### `createFrame` Does NOT Respect `parentId` by Default

**What happened:** Build script sent `parentId` to nest content frames inside sections. All frames appeared at page level, stacked on top of each other at `y: 100`.

**Root cause:** `figma.createFrame()` always places new frames at the page level. The `parentId` parameter is NOT a native Figma API concept — it's a convenience we added. The plugin must explicitly call `parent.appendChild(frame)` after creation.

**The fix:** In `code.ts`, the `createFrame` handler now:
1. Creates the frame at page level (Figma's default)
2. Looks up the parent via `figma.getNodeByIdAsync(parentId)`
3. Calls `parent.appendChild(frame)` to nest it

**Lesson:** Never assume Figma's `create*` methods accept a parent parameter. They don't. Nesting is always a separate `appendChild` call.

---

### Sections Don't Support Auto-Layout

**What happened:** Tried setting `layoutMode` on sections expecting children to stack. Nothing happened.

**Root cause:** Figma's `SectionNode` does not support auto-layout properties (`layoutMode`, `itemSpacing`, etc.). Only `FrameNode` and `ComponentNode` do.

**Workaround:** Create a content `Frame` inside each section with auto-layout, then place children in the frame:

```
Section (manual position) → Content Frame (auto-layout: VERTICAL) → Children
```

---

### `delete_node` Fails Across Pages

**What happened:** Queried node IDs from one page, switched to another page, then tried to delete nodes by ID. Got `"Node not found: undefined"`.

**Root cause:** `figma.getNodeByIdAsync()` can find nodes on any page, BUT the plugin must be on the correct page for some operations. More importantly, the payload field name matters — the handler expected `nodeId` not `id`.

**Lesson:** Always double-check the payload field names against the interface. When debugging node operations, use `get_node_info` first to verify the node exists and is accessible.

---

### Visual Hierarchy Rebuilt from Scratch Is Faster Than Patching

**What happened:** After fixing the `createFrame` nesting bug, we tried to manually move existing orphaned frames into sections. It was fragile and error-prone.

**Better approach:** Use `clear_page_children` to wipe the page, then rebuild from scratch:

```javascript
await sendCommand('clear_page_children', { pageName: '🎨 Foundations' });
// Then re-run the visual hierarchy build
```

**Lesson:** For layout-heavy operations, "clear and rebuild" is more reliable than surgical patching. Variables and styles survive because they're file-level, not page-level.

---

### `autoLayout` Format Mismatch Between Build Script and Plugin

**What happened:** Build script sent:
```json
{ "autoLayout": { "mode": "VERTICAL", "itemSpacing": 40, "paddingLeft": 60 } }
```

Plugin expected:
```json
{ "layoutMode": "VERTICAL", "itemSpacing": 40, "padding": { "left": 60 } }
```

Auto-layout was silently not applied. Frames appeared with no spacing or padding.

**Root cause:** Two different payload formats evolved independently. The plugin's original `createFrame` used Figma's raw property names (`layoutMode`, `paddingTop`), while the build script used a friendlier shorthand (`autoLayout.mode`, `autoLayout.paddingLeft`).

**The fix:** The plugin now supports BOTH formats. The `autoLayout` shorthand is checked first, with the legacy format as fallback.

**Lesson:** When your build script and plugin evolve separately, always test the actual wire format. Add a `--dry-run` flag so you can inspect the payloads before they hit the plugin.

---

### `cornerRadius` Was Silently Dropped

**What happened:** Build script specified `cornerRadius: 16` on content frames. The frames appeared with sharp corners.

**Root cause:** The `CreateFramePayload` TypeScript interface didn't include `cornerRadius`, so the property was stripped during type casting. TypeScript's `as unknown as CreateFramePayload` silently dropped unknown fields.

**The fix:** Added `cornerRadius?: number` to the interface and `frame.cornerRadius = payload.cornerRadius` in the handler.

**Lesson:** In TypeScript with `as unknown as` casts, extra properties vanish silently. Always verify your interfaces include every field the caller sends.

---

### `primaryAxisSizingMode: 'AUTO'` Is Critical for Dynamic Height

**What happened:** Auto-layout frames had the correct spacing and padding, but children were clipped or the frame had a fixed tiny height.

**Root cause:** Default `primaryAxisSizingMode` is `'FIXED'`, which means the frame height doesn't grow. Without explicitly setting `'AUTO'`, the frame stays at its initial height and children overflow.

**The fix:** Always set `primaryAxisSizingMode: 'AUTO'` when creating content frames that should grow to fit their children:

```json
{
  "autoLayout": {
    "mode": "VERTICAL",
    "primaryAxisSizingMode": "AUTO",
    "counterAxisSizingMode": "FIXED"
  }
}
```

---

### Page Switch Before Node Creation Is Mandatory

**What happened:** Created sections on the wrong page because `set_current_page` was called but the creation commands ran before the page switch completed.

**Root cause:** In the HTTP polling architecture, commands are queued and executed sequentially. But if a script fires `set_current_page` and immediately fires `create_section`, both enter the queue. The page switch DOES complete before the next command because the plugin processes them in order — but if you're using a different async architecture, race conditions can occur.

**Lesson:** In the build script, always `await` the page switch response before sending node-creation commands. The `sendCommand` helper already does this (it waits for the `/response` callback), but be careful if you ever batch multiple commands without awaiting.

---

### Font Loading Is Per-Style, Not Global

**What happened:** Created 14 text styles. The first few worked, but later ones with the same font sometimes failed with font loading errors.

**Root cause:** Each `createTextStyle` call loads the font independently via `figma.loadFontAsync()`. This is intentional — fonts are loaded lazily. But the `batch_create_styles` command optimizes this by pre-loading all unique fonts once before creating any styles.

**Lesson:** Use `batch_create_styles` instead of individual `create_text_style` calls. It deduplicates font loading and is faster.

---

### `get_page_children` Returns Direct Children Only

**What happened:** After nesting Content frames inside sections, `get_page_children` returned only 5 SECTION nodes instead of the 10 items (5 sections + 5 frames) from before.

**This is correct behavior** — the content frames are now children of sections, not of the page. To see them, use `get_frame_children` with the section's ID.

**Lesson:** `get_page_children` is your verification tool. If you expect 5 sections and get 5 SECTIONs, nesting worked. If you get 10 items (5 SECTIONs + 5 FRAMEs), nesting failed and frames are orphaned at page level.

---

### Effect Style Colors Use 4 Components, Variables Use 3

**What happened:** Copied a color value from a variable (`{ r: 0, g: 0, b: 0 }`) and used it in an effect style. The shadow rendered incorrectly — fully transparent.

**Root cause:**
- Variable colors: `{ r, g, b }` (3 fields) — opacity is not part of the color
- Effect colors: `{ r, g, b, a }` (4 fields) — alpha IS part of the color
- Fill paints: `{ color: { r, g, b }, opacity: 0.8 }` — yet another format

Missing the `a` field on an effect color defaults to `a: 0` (fully transparent).

**The fix:** Always include `a: 1` (or your desired alpha) when specifying effect colors:

```json
{ "r": 0, "g": 0, "b": 0, "a": 1.0 }
```

---

### The `payload` vs `params` Key Name in HTTP Requests

**What happened:** Some curl examples used `"params"` and others used `"payload"`. The orchestration server accepted both, but the plugin handler only unpacked `"payload"`.

**The fix:** Always use `"payload"` in the HTTP body:

```json
{
  "command": "create_page",
  "payload": { "name": "🎨 Foundations" }
}
```

Never use `"params"` — it may appear to work if the server translates it, but the canonical field name is `payload`.

---

## Contributing

Found a new pitfall? Add it to this guide. Every hard-won lesson prevents hours of debugging for the next builder.

Format for new entries:
1. **What went wrong** (the error or unexpected behavior)
2. **Why it happens** (root cause in the Figma API or plugin sandbox)
3. **The fix** (with code example)

---

*Built from real production experience creating Nectar Core with 161 variables, 18 styles, and 5 visual hierarchy sections across multiple iterative builds.*
