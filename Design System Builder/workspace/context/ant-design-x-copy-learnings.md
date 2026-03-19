# Ant Design X — Structural Study & Learning Engine Architecture

## Session Context

Initially attempted to copy the complete Ant Design X v2.2.1 Figma community file
(107 pages, 7 collections, 1264 variables, 17 text styles, 28 effect styles)
to a new empty "Untitled" Figma file using DSB's orchestration server + plugin.

**Architecture evolved**: The goal shifted from 1:1 copying to **structural learning**.
DSB doesn't copy design systems — it studies them to understand HOW professional
design systems are architected, then generates custom libraries using that knowledge
combined with the user's configuration.

## What Was Accomplished

### Successfully copied:
- **107 pages** — exact names, order, and hierarchy matching source
- **7 variable collections** with correct modes:
  - colors (Light/Dark)
  - seed (Light/Dark)
  - map (Light/Dark)
  - alias (Light/Dark)
  - static (Light/Dark)
  - responsive (Mobile/Tablet/Desktop SM/Desktop)
  - components (Light/Dark)
- Deleted the default "Page 1" from target

### Not yet copied (blocked):
- 0/1264 variables (values couldn't be read from plugin)
- 0/17 text styles
- 0/28 effect styles
- Page content (depends on variables + styles)

## Key Technical Discoveries

### 1. Plugin `get_variables` strips values

The `handleGetVariables` handler in `token-handlers.ts` deliberately maps
only `{id, name, type, collectionId}` — it drops `valuesByMode` and `scopes`.
The underlying `figma-api/variables.ts` DOES return full Variable objects
including `valuesByMode`, but the handler filters them out.

**Attempted fix**: Added `includeValues` parameter to include `valuesByMode`
and `scopes`. Result: timed out at 120s for the colors collection (130 variables).
The response payload was too large for the HTTP poll/response cycle.

### 2. Only one active plugin per server

Figma plugin heartbeat: 5s interval, server timeout: 15s. When running the
plugin in two file tabs on the same port, only the focused tab's plugin stays
alive. The unfocused tab dies after 15s. Same pluginId = overwrites in registry.

### 3. Plugin heartbeat ≠ command processing

The plugin can get into a state where it sends heartbeats normally but
doesn't respond to commands. Commands enter "processing" in the queue
and never complete. Root cause: likely Figma caching old plugin code
after a failed rebuild/modification cycle.

**Fix**: Fully close Figma and reopen, re-import plugin from manifest.

### 4. Command queue jamming

Timed-out commands leave "processing" entries that block subsequent commands.
Only fix: restart the orchestration server to clear the queue.

### 5. batch_create_variables size limit

40+ variables in one batch times out after 30s. Need batches of ~10 items max.

### 6. Page deletion requires switch first

Can't delete the currently active page in Figma. Must call `set_current_page`
to switch to a different page, then delete.

## Architecture Decision: Learning Engine (not a Copier)

### The Key Insight

**DSB does NOT copy design systems. It studies them and builds custom ones.**

The difference:
- **Copier**: Source file → identical target file (1:1 reproduction)
- **Learning Engine**: Study multiple design systems → understand structural patterns →
  generate a custom library that applies the user's config to learned architecture

This is the difference between a photocopier and an architect who studies
many buildings before designing a new one.

### Why Not Copy?

1. No one needs an exact copy — the source file already exists in Figma Community
2. Different brands need different token hierarchies, naming conventions, and scopes
3. The VALUE is in understanding WHY Ant Design uses 7 collections, or why
   Material Design separates seed from map tokens — then applying that wisdom
   to the user's specific design system requirements
4. A copy is rigid. A learned structure is adaptable.

### Extractor as Read/Write Engine

Use the **Variables & Styles Extractor** plugin as the IO engine:

```
EXTRACT: Extractor on source file → full JSON with all values/aliases/scopes
              ↓
STUDY:   Transform layer reads JSON → builds structural fingerprint
              ↓
LEARN:   Compares across multiple sources → identifies patterns
              ↓
GENERATE: Transform layer + user config → produces NEW custom JSON
              ↓
WRITE:   Extractor on target file → import generated JSON
```

### Why the Extractor Works for This
1. Extractor has direct Figma API access — no HTTP serialization bottleneck
2. Reads `variable.valuesByMode` natively (full data, not stripped)
3. Two-pass import: creates all vars with raw values first, resolves aliases second
4. Handles all 4 style types (color, text, effect, grid)
5. Supports alias chaining across collections
6. Built-in rollback on failure (undo snapshots)
7. JSON output is structured enough to analyze programmatically

### What the Transform Layer Studies

When it reads an extracted JSON, it learns:

| Aspect | What It Extracts | Example from Ant Design X |
|--------|-----------------|---------------------------|
| **Collection hierarchy** | How collections relate (dependency chain) | colors → seed → map → alias → components |
| **Naming conventions** | Separator style, grouping strategy | `blue/1` through `blue/10` (slash-separated, numbered shades) |
| **Alias chain depth** | How many hops from component token to raw value | components → alias → map → seed → colors (4 hops max) |
| **Mode strategy** | What modes exist and how values differ across them | Light/Dark for theming, responsive modes for breakpoints |
| **Scope assignments** | Which scopes are used for which token types | `ALL_FILLS` for semantic colors, `ALL_SCOPES` for primitives |
| **Scale patterns** | Number of shade steps, spacing multipliers | 10-step color scales, 4-mode responsive breakpoints |
| **Style bindings** | How styles reference variables | Text styles bind to typography variables, effects to shadow vars |

### How Learning Translates to Generation

```
LEARNED PATTERN (from Ant Design X):
  "Color tokens use 5-tier hierarchy:
   raw palettes → seed → map → alias → component-specific"

USER CONFIG:
  primary: #6366F1 (Indigo)
  secondary: #EC4899 (Pink)
  themes: Light, Dark

GENERATED OUTPUT:
  Collection "Primitives":
    indigo/1 through indigo/10 (generated from #6366F1)
    pink/1 through pink/10 (generated from #EC4899)
    neutral/1 through neutral/10 (tinted with indigo hue)

  Collection "Seed":
    colorPrimary → {indigo.6} (alias, learned position from Ant's blue.6 pattern)
    colorSecondary → {pink.5}

  Collection "Mapped":
    colorPrimaryBg → {colorPrimary} with opacity adjustment (learned from map layer)
    colorPrimaryBorder → {indigo.3} (learned: border tokens reference lighter shade)

  ... and so on, structurally mirroring the learned architecture
  but with COMPLETELY DIFFERENT content based on user config
```

### Build Order (critical)
1. **Variables** (raw values) — all collections
2. **Variables** (alias resolution) — cross-collection `{path.to.variable}` references
3. **Styles** — reference variables by binding
4. **Pages** — empty shells with correct hierarchy
5. **Content** — fills pages using styles and variables

This order exists because each layer depends on the previous one being
fully instantiated in Figma before references can be created.

## Extractor JSON Schema (Figma format)

```json
[
  {
    "collectionName": {
      "modes": {
        "Light": {
          "blue": {
            "1": {
              "$scopes": ["ALL_SCOPES"],
              "$type": "color",
              "$value": {
                "hex": "#e6f4ff",
                "rgb": {"r": 230, "g": 244, "b": 255, "a": 1},
                "css": "rgba(230, 244, 255, 1)",
                "hsl": {"h": 206, "s": 100, "l": 95, "a": 1},
                "hsb": {"h": 206, "s": 10, "b": 100, "a": 1}
              }
            }
          }
        }
      }
    }
  },
  {
    "aliasCollection": {
      "modes": {
        "Light": {
          "colorPrimary": {
            "$scopes": ["ALL_FILLS"],
            "$type": "color",
            "$value": "{blue.6}",
            "$collectionName": "colors"
          }
        }
      }
    }
  },
  {
    "_styles": {
      "colorStyles": [...],
      "textStyles": [...],
      "effectStyles": [...],
      "gridStyles": [...]
    }
  }
]
```

### Alias format
- `{blue.6}` → reference to variable `blue/6` in the same or specified collection
- `$collectionName` specifies the source collection for cross-collection aliases
- During import, braces are stripped, dots converted to slashes for Figma path lookup

## Ant Design X Structure Summary

### Collections (7 total, 1264 variables)
| Collection | Variables | Modes | Purpose |
|-----------|----------|-------|---------|
| colors | 130 | Light, Dark | 13 palettes x 10 shades (raw RGBA) |
| seed | 32 | Light, Dark | Seed tokens (aliases to colors) |
| map | 113 | Light, Dark | Mapped tokens (aliases to seed/colors) |
| alias | 116 | Light, Dark | Semantic aliases (aliases to map/seed) |
| static | 176 | Light, Dark | Static tokens |
| responsive | 13 | Mobile, Tablet, Desktop SM, Desktop | Breakpoints |
| components | 684 | Light, Dark | Component-specific tokens |

### Styles
- 17 text styles (font families, sizes, weights, line heights)
- 28 effect styles (shadows, blurs)

### Pages (107 total)
One page per component, organized by category:
- Welcome, Cover, Foundation, Colors, General, Layout, Navigation, Data Entry,
  Data Display, Feedback, Other, Typography, Overview categories
- Each category has a separator page (e.g., `── ── ── ── ──`)

## Files Created During Sessions

- `/tmp/dsb_colors_payload.json` — 130 color variables with hex→RGBA conversions
- `/tmp/dsb_all_collections.json` — Failed attempt (plugin not connected)
- Target file has: 107 pages + 7 empty collections (variables not yet populated)

## Transform Layer: Structural Fingerprinting

### What a Structural Fingerprint Contains

When the transform layer analyzes an extracted JSON, it produces a
**fingerprint** — a schema-level description of the design system's architecture
that strips away the specific values but preserves the structural decisions:

```typescript
interface StructuralFingerprint {
  // Collection topology
  collections: {
    name: string;
    tier: 'primitive' | 'seed' | 'mapped' | 'semantic' | 'component' | 'responsive';
    modes: string[];
    variableCount: number;
    dependsOn: string[];  // Which collections this one aliases into
  }[];

  // Naming patterns (learned from variable names)
  namingConventions: {
    separator: '/' | '.' | '-';
    grouping: 'by-color-then-shade' | 'by-purpose' | 'flat';
    shadeNaming: 'numeric-1-to-10' | 'numeric-50-to-950' | 'semantic-names';
    casing: 'camelCase' | 'kebab-case' | 'PascalCase';
  };

  // Alias chain architecture
  aliasTopology: {
    maxDepth: number;           // e.g., 4 for Ant Design X
    typicalChain: string[];     // e.g., ["primitives", "seed", "map", "alias", "component"]
    crossCollectionAliases: boolean;
  };

  // Scale patterns
  scalePatterns: {
    colorShades: number;        // e.g., 10 for Ant, 11 for Material (50-950)
    colorPalettes: string[];    // e.g., ["blue", "red", "green", ...]
    spacingMultipliers: number[];
    typographySizes: number;
    breakpointCount: number;
  };

  // Style strategy
  styleStrategy: {
    textStyleCount: number;
    effectStyleCount: number;
    textStyleNaming: string;    // Pattern like "{weight}/{size}" or "{role}"
    effectStyleNaming: string;  // Pattern like "shadow-{level}" or "elevation-{n}"
  };

  // Source metadata
  source: {
    name: string;               // "Ant Design X v2.2.1"
    totalVariables: number;
    totalStyles: number;
    totalPages: number;
    extractedAt: string;
  };
}
```

### Multi-Source Learning

The transform layer can study MULTIPLE design systems and synthesize patterns:

```
Source 1: Ant Design X     → Fingerprint A (7 collections, 10-shade scales)
Source 2: Material Design 3 → Fingerprint B (tonal palettes, 13-shade scales)
Source 3: shadcn/ui         → Fingerprint C (CSS variables, HSL-based)

Synthesis: "Most mature systems use 3-5 tier hierarchies.
            10 shade steps is most common. Cross-collection
            aliases are universal. Component tokens always
            sit at the top of the alias chain."
```

The user's config then specifies which patterns to follow:
- `structure: "ant-design"` → use 7-collection hierarchy
- `structure: "three-tier"` → use DSB's default Primitives/Semantic/Component
- `structure: "custom"` → user defines their own tiers

### Difference from Current Three-Tier Engine

Current `three-tier-engine.ts` has **hardcoded** mappings:
```typescript
// These are STATIC decisions baked into the code:
['bg/primary', 'color/primary-500']
['text/primary', 'color/neutral-900']
['border/focus', 'color/primary-500']
```

The Learning Engine replaces this with **learned** mappings:
```typescript
// These are DYNAMIC decisions based on studied patterns:
// "In Ant Design X, the primary background uses the 6th shade"
// "In Material Design, the primary surface uses the tonal palette at 90%"
// → Apply the learned shade-selection strategy to the user's primary color
```

## Next Steps

### Phase 1: Extract & Study (Current)
1. Run Extractor on Ant Design X source file → export full JSON
2. Save JSON to `workspace/context/ant-design-x-extracted.json`
3. Build structural fingerprint from the JSON
4. Document the fingerprint as a learned reference

### Phase 2: Multi-Source Learning (Next)
5. Extract from Material Design 3, shadcn/ui, and other community files
6. Build fingerprints for each
7. Create a synthesis layer that identifies common patterns

### Phase 3: Intelligent Generation
8. Transform layer takes user config + learned fingerprint(s)
9. Generates a CUSTOM JSON (not a copy) in Extractor format
10. Writes the generated JSON into a new Figma file via Extractor import

### Phase 4: Page & Content Building
11. After variables and styles are loaded in Figma
12. Use DSB builder plugin for page creation and component assembly
13. Pages reference the generated variables and styles
