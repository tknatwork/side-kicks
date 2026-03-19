# AI Optimization Guide — Nectar Design Toolkit

**How to make this toolkit work efficiently with AI models (Claude, GPT, Gemini, Copilot, and others).**

> Version: 1.0 | Last Updated: 2026-02-18

---

## Table of Contents

1. [Why This Guide Exists](#1-why-this-guide-exists)
2. [Context File Architecture](#2-context-file-architecture)
3. [Prompt Engineering for Design Systems](#3-prompt-engineering-for-design-systems)
4. [Token Schema for AI Consumption](#4-token-schema-for-ai-consumption)
5. [Command Batching Strategy](#5-command-batching-strategy)
6. [Error Recovery Patterns](#6-error-recovery-patterns)
7. [Context Window Optimization](#7-context-window-optimization)
8. [Build Script Integration](#8-build-script-integration)
9. [Multi-Agent Workflows](#9-multi-agent-workflows)
10. [Testing & Validation](#10-testing--validation)
11. [Model-Specific Tips](#11-model-specific-tips)
12. [Anti-Patterns to Avoid](#12-anti-patterns-to-avoid)

---

## 1. Why This Guide Exists

AI models interact with the Nectar Design Toolkit through an HTTP polling bridge — they send JSON commands to an orchestration server, which queues them for the Figma plugin. This pipeline introduces unique challenges:

- **Latency**: Each command takes 50-500ms round-trip
- **State blindness**: The AI can't see the Figma canvas
- **ID tracking**: Created nodes return runtime IDs that must be stored and reused
- **Format sensitivity**: Color formats, scope arrays, and font names must be exact
- **Context limits**: Large design systems (1000+ variables) can exceed token budgets

This guide documents patterns that reduce errors, minimize round-trips, and make AI agents more reliable.

---

## 2. Context File Architecture

### Files AI Agents Should Read First

Load these files in order of priority before starting any task:

| Priority | File | Purpose | When to Read |
|----------|------|---------|--------------|
| 1 | `docs/AI_CONTEXT.md` | Project overview, structure, components | Always — first file |
| 2 | `docs/COMMAND_REFERENCE.md` | All 80+ commands with payloads | Before sending any command |
| 3 | `docs/BEST_PRACTICES.md` | Gotchas, format rules, patterns | Before building anything |
| 4 | `docs/DESIGN_SYSTEM_STRUCTURE.md` | Token architecture (seed → alias → mapped) | Before variable operations |
| 5 | `docs/CODING_STANDARDS.md` | Plugin development constraints | Before modifying plugin code |
| 6 | `docs/CHANGELOG.md` | What's changed, what's been fixed | When debugging issues |

### AI Context File Pattern

Every project in the toolkit includes an `AI_CONTEXT.md` file. This file is designed for machine consumption:

```markdown
# AI Context - [Component Name]

## Quick Reference
| Key | Value |
|-----|-------|
| **Purpose** | What this does |
| **Status** | Ready / In Development |
| **Entry Point** | Main file to read |

## Architecture
[Brief system diagram]

## Key Interfaces
[TypeScript interfaces or JSON schemas]

## Common Operations
[Numbered list of typical workflows]
```

### Recommended Context Loading Strategy

**For short tasks** (single command):
- Read `COMMAND_REFERENCE.md` → find the command → send it

**For medium tasks** (creating a set of variables/styles):
- Read `AI_CONTEXT.md` + `COMMAND_REFERENCE.md`
- Read relevant token JSON files
- Plan the batch sequence, then execute

**For full builds** (entire design system):
- Read all 6 priority files
- Read all token JSON files (`seed.json`, `alias.json`, `mapped.json`)
- Use `build-figma-ds.js` as the execution engine

---

## 3. Prompt Engineering for Design Systems

### Structured Prompts That Work

When asking an AI to build design system elements, use this structure:

```
TASK: [What to create]
SOURCE: [Token file or design spec to read]
TARGET: [Collection name, page name, or parent frame]
FORMAT: [Color format, naming convention, scope requirements]
CONSTRAINTS: [Plan limits, font availability, existing variables]
```

**Example — Good prompt:**
```
TASK: Create all seed color variables from seed.json
SOURCE: Portfolio/design-system/tokens/seed.json → colors section
TARGET: Collection "Seed Colors" with mode "Value"
FORMAT: Colors as { r: 0-1, g: 0-1, b: 0-1 }, names as "color/shade" (e.g., "pink/500")
CONSTRAINTS: Use batch_create_variables for efficiency. Set ALL_FILLS scope on all color variables.
```

**Example — Bad prompt:**
```
Create some color variables from the token file.
```

### Design System Vocabulary

Teach the AI the correct terminology to avoid ambiguity:

| Term | Meaning | NOT |
|------|---------|-----|
| **Variable** | A Figma variable (design token) | A code variable |
| **Collection** | A group of variables (e.g., "Seed Colors") | A CSS file |
| **Mode** | A variant dimension (Light/Dark, Desktop/Mobile) | A theme |
| **Alias** | A variable pointing to another variable | A CSS custom property |
| **Scope** | Where a variable appears in Figma UI | CSS scope |
| **Style** | A Figma text/color/effect/grid style | CSS class |
| **Node** | Any Figma layer (frame, text, rectangle) | DOM node |

---

## 4. Token Schema for AI Consumption

### Seed Token JSON Structure

AI agents read seed tokens from `seed.json`. Here's the structure they need to understand:

```json
{
  "color": {
    "pink": {
      "50": { "value": "#FFF0F0", "type": "color" },
      "100": { "value": "#FFE0E0", "type": "color" },
      "500": { "value": "#FB7878", "type": "color" }
    }
  },
  "spacing": {
    "4": { "value": 4, "type": "number" },
    "8": { "value": 8, "type": "number" }
  },
  "typography": {
    "heading": {
      "h1": {
        "fontFamily": { "value": "Libre Baskerville", "type": "string" },
        "fontWeight": { "value": 700, "type": "number" },
        "fontSize": { "value": 48, "type": "number" },
        "lineHeight": { "value": 130, "type": "number" }
      }
    }
  }
}
```

### Transformation Rules for AI

When converting tokens to Figma commands, AI agents must apply these transformations:

| Token Field | Figma API Format | Transformation |
|-------------|-----------------|----------------|
| `#RRGGBB` hex color | `{ r, g, b }` floats | Divide each channel by 255 |
| `fontWeight: 700` | `fontStyle: "Bold"` | Map: 100→Thin, 300→Light, 400→Regular, 500→Medium, 600→SemiBold, 700→Bold, 800→ExtraBold |
| `lineHeight: 130` | `{ value: 130, unit: "PERCENT" }` | Wrap in object with unit |
| `letterSpacing: -0.5` | `{ value: -0.5, unit: "PIXELS" }` | Wrap in object with unit |
| `spacing: 4` (number) | `resolvedType: "FLOAT"` | Use FLOAT type, not STRING |

### Providing Token Files to AI

When asking an AI to create variables from tokens:

1. **Include the full JSON** — don't summarize or truncate
2. **Specify the transformation rules** — hex→normalized, weight→style name
3. **Specify the target collection and mode** — "Seed Colors", mode "Value"
4. **Specify scopes per category** — colors get `ALL_FILLS`, spacing gets `GAP` + `WIDTH_HEIGHT`

---

## 5. Command Batching Strategy

### The Round-Trip Problem

Each individual command takes 50-500ms. A design system with 300 variables would take:
- **Individual commands**: 300 × 3 (create + set value + set scope) = 900 commands = ~7 minutes
- **Batched commands**: 3 commands (batch create + batch aliases + batch scopes) = ~3 seconds

### Batch Command Reference

| Command | What It Batches | Max Recommended Size |
|---------|----------------|---------------------|
| `batch_create_variables` | Variable creation + values + scopes | 100 per call |
| `batch_set_variable_aliases` | VARIABLE_ALIAS references | 50 per call |
| `batch_create_styles` | Text + effect styles | 30 per call |

### Optimal Build Sequence

```
Step 1: batch_create_variables    → Seed collection (90 vars)
Step 2: batch_create_variables    → Alias collection (39 vars, raw fallback values)
Step 3: batch_set_variable_aliases → Alias references (39 aliases → seed vars)
Step 4: batch_create_variables    → Mapped collection (32 vars, raw fallback values)
Step 5: batch_set_variable_aliases → Mapped aliases (32 aliases → alias/seed vars)
Step 6: batch_create_styles       → Text styles (14) + Effect styles (4)
Step 7: create_page × 5           → Pages
Step 8: Visual hierarchy commands  → Sections, frames, swatches

Total: ~14 commands instead of 580+
```

### When NOT to Batch

- **Debugging**: Use individual commands to isolate which variable fails
- **Partial updates**: When modifying 1-2 existing variables
- **Query commands**: These are already fast (`get_variables`, `get_local_styles`)

---

## 6. Error Recovery Patterns

### Common Errors and AI-Friendly Recovery

| Error | Cause | Recovery Action |
|-------|-------|-----------------|
| `"Collection not found"` | Wrong collection ID | Run `get_variable_collections` to get fresh IDs |
| `"Variable not found"` | Stale variable ID or typo | Run `get_variables` with collection ID |
| `"Font not found"` | Font not installed on machine | Check available fonts, use fallback |
| `"Node not found"` | Node deleted or page changed | Switch to correct page first, re-query |
| `"Alias target not found"` | Pass 2 ran before Pass 1 | Ensure batch_create_variables completes before batch_set_variable_aliases |
| `"ALL_FILLS conflict"` | Combined ALL_FILLS with TEXT_FILL | Use either ALL_FILLS alone OR individual scopes |

### Structured Error Handling for AI Agents

When building a script or pipeline, AI agents should implement this pattern:

```
1. PREFLIGHT — Check server health and plugin connection
2. VALIDATE — Verify token JSON parses correctly
3. EXECUTE — Run commands with error capture per-item
4. VERIFY — Query back to confirm creation
5. REPORT — Summarize successes and failures
```

### Recovery Workflow

If a build step fails partway through:

```
1. DON'T retry the entire batch — it will create duplicates
2. Query existing state: get_variable_collections → get_variables
3. Build a delta: compare expected vs actual
4. Send only missing items
5. OR: clear_page_children / delete_collection → retry from scratch
```

---

## 7. Context Window Optimization

### Problem

A full design system build requires context from:
- Token files (~500 lines of JSON each)
- Command reference (~800 lines)
- Best practices (~300 lines)
- Build script (~1200 lines)

Total: 2800+ lines — which may exceed smaller model context windows.

### Strategies for Different Context Sizes

**Large context (128K+ tokens — Claude, GPT-4):**
- Load all 6 documentation files + all 3 token files
- Execute full build in a single session
- Track all IDs in memory

**Medium context (32K tokens — GPT-3.5, older models):**
- Load only `COMMAND_REFERENCE.md` + one token file at a time
- Execute one step per session: variables → styles → pages → visual
- Pass IDs between sessions via a manifest file

**Small context (8K tokens — lightweight models):**
- Use the build script (`build-figma-ds.js`) instead of raw commands
- AI only needs to understand `--step` flags
- One command: `node build-figma-ds.js --step all`

### ID Manifest Pattern

For multi-session builds, save a manifest between sessions:

```json
{
  "collections": {
    "Seed Colors": { "id": "VariableCollectionId:90:2", "modeIds": { "Value": "90:0" } },
    "Alias Tokens": { "id": "VariableCollectionId:94:3", "modeIds": { "Default": "94:0" } }
  },
  "variableIds": {
    "pink/500": "VariableID:94:12",
    "spacing/4": "VariableID:94:80"
  },
  "styleIds": {
    "Heading/H1": "S:abc123,",
    "Shadow/Hard/sm": "S:def456,"
  },
  "pageIds": {
    "🎨 Foundations": "90:100"
  }
}
```

AI agents should:
1. Save this manifest after each build step
2. Load it at the start of the next session
3. Use it to resume without re-querying everything

---

## 8. Build Script Integration

### Using `build-figma-ds.js` with AI Agents

Instead of having AI agents send commands directly, they can invoke the build script:

```bash
# Full build — AI just needs to run this one command
node build-figma-ds.js --step all

# Specific steps
node build-figma-ds.js --step variables   # Collections + variables + aliases
node build-figma-ds.js --step styles      # Text + effect styles
node build-figma-ds.js --step pages       # Create/rename pages
node build-figma-ds.js --step visual      # Sections, frames, swatches, typography

# Dry run — shows what would be sent without executing
node build-figma-ds.js --dry-run
```

### When to Use the Build Script vs. Direct Commands

| Scenario | Use Build Script | Use Direct Commands |
|----------|:----------------:|:-------------------:|
| Full design system from scratch | ✅ | ❌ |
| Updating a single variable | ❌ | ✅ |
| Adding a new color palette | ❌ | ✅ |
| Rebuilding after token file changes | ✅ | ❌ |
| Debugging a specific command | ❌ | ✅ |
| CI/CD pipeline | ✅ | ❌ |

### Extending the Build Script

AI agents can extend `build-figma-ds.js` by adding new step functions:

```javascript
// In build-figma-ds.js, add a new step:
async function buildComponentTokens() {
  // Read component token file
  // Generate batch_create_variables payload
  // Send command
}

// Register in the step map
if (!STEP || STEP === 'components' || STEP === 'all') {
  await buildComponentTokens();
}
```

---

## 9. Multi-Agent Workflows

### Agent Role Separation

For complex builds, split work across specialized agents:

| Agent Role | Responsibility | Files It Reads |
|------------|---------------|----------------|
| **Token Agent** | Parse JSON, compute transformations, generate variable payloads | `seed.json`, `alias.json`, `mapped.json` |
| **Style Agent** | Generate text and effect style payloads | Token files + font metadata |
| **Layout Agent** | Build visual hierarchy (sections, frames, swatches) | Variable IDs from Token Agent |
| **QA Agent** | Query and validate everything was created correctly | `COMMAND_REFERENCE.md` (query commands) |

### Handoff Protocol

Agents communicate through the ID manifest:

```
Token Agent:
  1. Reads token files
  2. Sends batch_create_variables
  3. Saves variableIds to manifest.json
  4. Sends batch_set_variable_aliases
  5. Updates manifest.json

Style Agent:
  1. Reads manifest.json for variable IDs
  2. Sends batch_create_styles
  3. Saves styleIds to manifest.json

Layout Agent:
  1. Reads manifest.json for all IDs
  2. Creates pages and sections
  3. Uses create_color_swatches_group with variable IDs
  4. Creates typography groups with style IDs

QA Agent:
  1. Runs get_variable_collections, get_variables, get_local_styles
  2. Compares expected vs actual counts
  3. Reports discrepancies
```

---

## 10. Testing & Validation

### Validation Commands for AI

After building, AI agents should verify using these query commands:

```bash
# Check variable counts
get_variable_collections  → verify 3 collections
get_variables { collectionId }  → count per collection

# Check style counts
get_local_styles  → verify paintStyles, textStyles, effectStyles counts
get_grid_styles   → verify grid styles

# Check pages
get_pages  → verify 5 pages with correct names

# Check visual hierarchy
get_page_children { pageName: "🎨 Foundations" }  → verify sections exist
```

### Expected Counts (Nectar Core)

| Asset | Expected Count |
|-------|---------------|
| Seed variables | 90 |
| Alias variables | 39 |
| Mapped variables | 32 |
| Text styles | 14 |
| Effect styles | 4 |
| Pages | 5-6 |

### Automated Validation Script Pattern

AI agents can generate a validation script:

```javascript
async function validateBuild() {
  const collections = await sendCommand('get_variable_collections');
  const styles = await sendCommand('get_local_styles');
  const pages = await sendCommand('get_pages');

  const report = {
    collections: collections.length,
    variables: {},
    styles: {
      paint: styles.paintStyles.length,
      text: styles.textStyles.length,
      effect: styles.effectStyles.length
    },
    pages: pages.length,
    errors: []
  };

  // Validate expected counts
  if (report.collections !== 3) report.errors.push('Expected 3 collections');
  if (report.styles.text !== 14) report.errors.push('Expected 14 text styles');

  return report;
}
```

---

## 11. Model-Specific Tips

### Claude (Anthropic)

- **Strength**: Excellent at reading long JSON files and generating batch payloads
- **Tip**: Provide the full token JSON — Claude handles 200K context well
- **Tip**: Ask Claude to "generate the batch_create_variables payload" rather than "create variables"
- **Tip**: Claude can track ID mappings across a long conversation reliably
- **Watch for**: Claude may add `//` comments inside JSON — JSON doesn't support comments

### GPT-4 / GPT-4o (OpenAI)

- **Strength**: Good at code generation and script modification
- **Tip**: Use function calling / tool use to send commands programmatically
- **Tip**: Keep the build manifest as a code block in the conversation for reference
- **Watch for**: May abbreviate large arrays with `"..."` — explicitly say "include all items"

### Gemini (Google)

- **Strength**: Strong at multi-modal tasks (can view Figma screenshots for validation)
- **Tip**: Provide the command reference as a structured table
- **Tip**: Use the `--dry-run` flag to preview before executing
- **Watch for**: May need explicit instructions about Figma-specific color format (0-1 vs 0-255)

### GitHub Copilot

- **Strength**: In-editor integration, great for modifying `build-figma-ds.js` and `code.ts`
- **Tip**: Use `.github/copilot-instructions.md` for project-specific rules
- **Tip**: Let Copilot modify the build script rather than sending raw commands
- **Watch for**: Copilot works best when the target file is open — it needs the context

### General Tips for All Models

1. **Always specify the color format explicitly**: "Use `{ r: 0-1, g: 0-1, b: 0-1 }` normalized floats"
2. **Include the exact field names**: "Use `resolvedType` not `type`"
3. **Specify the Figma API version**: "Use async APIs: `getLocalPaintStylesAsync()` not `getLocalPaintStyles()`"
4. **Warn about spread operators**: "Don't use `{...obj}` — Figma's ES2017 VM doesn't support it. Use `Object.assign()`"
5. **Provide the error format**: "Errors return `{ success: false, error: 'message' }`"

---

## 12. Anti-Patterns to Avoid

### Don't: Send Commands One at a Time

```
❌ create_variable("pink/50")
❌ set_variable_value("pink/50", "#FFF0F0")
❌ set_variable_scopes("pink/50", ["ALL_FILLS"])
❌ create_variable("pink/100")
❌ set_variable_value("pink/100", "#FFE0E0")
... (300 more)
```

```
✅ batch_create_variables({
     variables: [
       { name: "pink/50", resolvedType: "COLOR", values: {...}, scopes: [...] },
       { name: "pink/100", resolvedType: "COLOR", values: {...}, scopes: [...] },
       ... (all 90 in one call)
     ]
   })
```

### Don't: Hardcode Node IDs

```
❌ // IDs from a previous session — will be stale
   appendToFrame({ frameId: "106:1100", childIds: ["107:500"] })
```

```
✅ // Query first, then use fresh IDs
   const pages = await sendCommand('get_pages');
   const targetPage = pages.find(p => p.name === '🎨 Foundations');
   const children = await sendCommand('get_page_children', { pageName: targetPage.name });
```

### Don't: Mix ALL_FILLS with Subset Scopes

```
❌ set_variable_scopes({
     variableId: "...",
     scopes: ["ALL_FILLS", "TEXT_FILL"]  // Conflict! ALL_FILLS is a superset
   })
```

```
✅ set_variable_scopes({
     variableId: "...",
     scopes: ["ALL_FILLS"]  // Use alone
   })
   // OR
   set_variable_scopes({
     variableId: "...",
     scopes: ["TEXT_FILL", "FRAME_FILL", "SHAPE_FILL"]  // Use subsets individually
   })
```

### Don't: Create Aliases Before Raw Variables Exist

```
❌ // This fails because "pink/500" doesn't exist yet
   batch_set_variable_aliases({
     aliases: [{ variableId: "alias/primary", aliasTargetId: "pink/500" }]
   })
   batch_create_variables({
     variables: [{ name: "pink/500", ... }]
   })
```

```
✅ // Two-pass pattern: raw values first, aliases second
   batch_create_variables({
     variables: [{ name: "pink/500", ... }]  // Pass 1: create targets
   })
   batch_set_variable_aliases({
     aliases: [{ variableId: "alias/primary", aliasTargetId: "pink/500" }]  // Pass 2: link
   })
```

### Don't: Forget to Switch Pages

```
❌ // Creates frame on wrong page
   create_frame({ name: "Colors", ... })
   // Oops — was still on "Typography" page
```

```
✅ // Always switch to target page first
   set_current_page({ pageName: "🎨 Foundations" })
   // THEN create nodes
   create_frame({ name: "Colors", ... })
```

### Don't: Use Spread Operators in Plugin Code

```
❌ // Crashes in Figma's QuickJS VM
   const merged = { ...obj1, ...obj2 };
   const copy = [...array];
```

```
✅ // ES2017-compatible alternatives
   const merged = Object.assign({}, obj1, obj2);
   const copy = array.slice();
```

### Don't: Skip Parent Nesting

```
❌ // Frame lands at page level, not inside section
   create_frame({ name: "Content", width: 1400 })
```

```
✅ // Nest inside a section
   const section = await sendCommand('create_section', { name: "Colors" });
   create_frame({ name: "Content", width: 1400, parentId: section.id })
```

---

## Appendix: AI Agent Context Template

When setting up a new AI agent to work with this toolkit, provide this context block:

```markdown
## Project: Nectar Design Toolkit
- **What**: AI-controlled Figma design system builder
- **Server**: HTTP orchestration at localhost:9877
- **Plugin**: Polls server every 50ms for commands
- **Color format**: { r: 0-1, g: 0-1, b: 0-1 } normalized floats (NOT 0-255)
- **Font weight mapping**: 400=Regular, 500=Medium, 600=SemiBold, 700=Bold
- **Two-pass pattern**: Create variables with raw values first, then set aliases
- **Batch preferred**: Use batch_create_variables, batch_set_variable_aliases, batch_create_styles
- **ES2017 only**: No spread operators, no generators, no optional chaining in plugin code
- **Read first**: docs/COMMAND_REFERENCE.md for all available commands
- **Read second**: docs/BEST_PRACTICES.md for format rules and gotchas
```

---

*Last Updated: 2026-02-18 — Nectar Design Toolkit v2.0*
