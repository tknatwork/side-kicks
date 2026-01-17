# AGENTS.md - Universal AI Instructions

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

**Project:** Variables & Styles Extractor (Figma Plugin)  
**Repository:** github.com/tknatwork/side-kicks  
**Version:** 2.0.0 (UI Overhaul - 1200×628px 4-column layout)

---

## 🎯 Quick Start for AI Agents

### Step 1: Understand the Project

This is a **Figma plugin** with unique constraints:

| Component | File | Runtime |
|-----------|------|---------|
| Backend | `src/code.ts` | Figma's QuickJS VM (ES2017 only) |
| Frontend | `ui.html` | Browser iframe (standard web) |
| Config | `manifest.json` | Figma plugin manifest |
| Output | `code.js` | Compiled JavaScript |

### Step 2: Read Critical Documentation

**BEFORE making any changes**, read these files in order:

1. **`docs/FIGMA_PLUGIN_DEVELOPMENT.md`** - Sandbox constraints & patterns
2. **`docs/CODING_STANDARDS.md`** - Mandatory coding rules
3. **`docs/AI_CONTEXT.md`** - Project context & architecture

### Step 3: Understand the Constraints

```typescript
// ❌ WILL CRASH in Figma - NEVER use these in code.ts
{ ...obj }                    // Spread operators
function* gen() { yield 1; }  // Generators
obj?.prop                     // Optional chaining may fail

// ✅ SAFE alternatives
Object.assign({}, obj)        // Instead of spread
if (obj && obj.prop)          // Instead of optional chaining
```

```css
/* ❌ BREAKS in Figma iframe - NEVER use in ui.html */
contain: strict;
content-visibility: auto;

/* ✅ SAFE alternatives */
contain: layout style;
will-change: transform;
```

---

## ⚠️ CRITICAL: Workspace Scope Restriction

### Allowed Paths
✅ `Side-Kicks/variables-styles-extractor/**`

### Forbidden Paths
❌ `Portfolio/**`  
❌ `Content Files/**`  
❌ `Research Study/**`  
❌ Any other folder in design-docs

**Unless explicitly instructed by the user, all operations must be confined to the plugin directory.**

---

## 📁 Project Structure

```
variables-styles-extractor/
├── src/
│   └── code.ts           # Backend logic (~2400 lines) - EDIT THIS
├── ui.html               # UI (~5300 lines) - EDIT THIS
├── code.js               # Compiled output - DO NOT EDIT
├── manifest.json         # Plugin config
├── package.json          # Build scripts
├── docs/                 # Documentation
│   ├── AI_CONTEXT.md     # Project context
│   ├── AGENTS.md         # This file
│   ├── CHANGELOG.md      # Version history
│   ├── CODING_STANDARDS.md   # Mandatory rules
│   ├── FIGMA_PLUGIN_DEVELOPMENT.md  # Figma-specific guide
│   └── TASKS.md          # Task tracking
└── releases/             # Version archives
```

---

## 🔧 Development Commands

```bash
cd Side-Kicks/variables-styles-extractor
pnpm install         # Install dependencies
pnpm build           # Production build (minified)
pnpm build:dev       # Debug build (readable code.js)
```

### After Code Changes
1. Run `pnpm build:dev` for debugging
2. In Figma Desktop: Plugins → Development → Hot reload
3. Test the change
4. If working, run `pnpm build` for production

---

## 🏗️ Architecture Reference

### File Responsibilities

| File | Lines | Purpose |
|------|-------|---------|
| `src/code.ts` | ~2400 | Figma API calls, variable/style processing |
| `ui.html` | ~5300 | UI rendering, user interactions, data display |
| `code.js` | varies | Compiled output (auto-generated) |

### Communication Flow

```
ui.html ─────postMessage─────► code.ts
   │                              │
   │◄────figma.ui.postMessage─────┘

Export: UI sends 'export' → code.ts processes → sends 'export_complete'
Import: UI sends 'validate_import' → code.ts validates → sends 'validation_result'
        UI sends 'import' → code.ts imports → sends 'import_complete'
```

### Key Message Types

| UI → Backend | Backend → UI |
|-------------|--------------|
| `export` | `export_complete` |
| `import` | `import_complete` |
| `validate_import` | `validation_result` |
| `check_libraries` | `library_check_result` |
| `check_fonts` | `font_check_result` |
| `get_collections` | `collections` |

---

## 📋 Key Interfaces (code.ts)

### Export Data Structure

```typescript
// Color style with all paint types
interface ExportColorStyle {
  name: string;
  paints: ExportPaintData[];  // SOLID, GRADIENT_*, IMAGE
  description?: string;
}

// Variable value
interface ExportVariableValue {
  $type: 'color' | 'float' | 'string' | 'boolean';
  $value: string | number | boolean;
  $description?: string;
  $scopes?: string[];
  $libraryRef?: { ... };  // For library-linked variables
}
```

### Import Validation

```typescript
interface PlanValidation {
  canImport: boolean;
  plan: FigmaPlan;
  warnings: string[];
  errors: string[];
  libraryDependencies?: {
    variableCount: number;
    collections: string[];
  };
  fontDependencies?: {
    styleCount: number;
    fonts: Array<{ family: string; style: string }>;
  };
}
```

---

## ✅ Code Change Checklist

Before submitting any code change:

- [ ] No spread operators `{...obj}` in code.ts
- [ ] No generators in code.ts
- [ ] No `contain: strict` or `content-visibility: auto` in CSS
- [ ] All Figma APIs use async versions
- [ ] DOM elements have null checks before addEventListener
- [ ] Error handling with try/catch
- [ ] Build succeeds with `pnpm build:dev`
- [ ] Update `docs/CHANGELOG.md` if significant change

---

## 📝 After Making Changes

1. **Update CHANGELOG.md** - Add entry for significant changes
2. **Run Build** - `pnpm build:dev` to verify no TypeScript errors
3. **Test in Figma** - Load plugin and test the change
4. **Update TASKS.md** - Mark completed items

---

## 🐛 Common Issues & Solutions

### Issue: Elements render but are invisible
**Cause:** CSS `contain: strict` or `content-visibility: auto`  
**Fix:** Use `contain: layout style` instead

### Issue: "Cannot read property of null" in UI
**Cause:** Event listener attached before element exists  
**Fix:** Wrap in `DOMContentLoaded` or add null check

### Issue: Plugin crashes with "stack underflow"
**Cause:** Generator functions or spread operators in code.ts  
**Fix:** Use `Object.assign()` instead of spreads, avoid generators

### Issue: Color styles show 0 count
**Cause:** Only SOLID paints being exported  
**Fix:** Handle all paint types: SOLID, GRADIENT_*, IMAGE

### Issue: Fonts not importing correctly
**Cause:** Font not available in destination file  
**Fix:** Check font availability with `figma.loadFontAsync()` first

---

## 📚 Documentation Index

| File | Purpose | When to Read |
|------|---------|--------------|
| `AI_CONTEXT.md` | Project overview, architecture | First time working on project |
| `FIGMA_PLUGIN_DEVELOPMENT.md` | Figma-specific constraints | Before writing any code |
| `CODING_STANDARDS.md` | Coding rules, best practices | Before every coding session |
| `CHANGELOG.md` | Version history | To understand past changes |
| `TASKS.md` | Current & pending tasks | To see what needs doing |

---

## Protected Files

These files must NEVER be deleted, only rewritten during major overhauls:

| File | Purpose |
|------|---------|
| `docs/AI_CONTEXT.md` | Project context |
| `docs/AGENTS.md` | This file |
| `docs/CHANGELOG.md` | Project history |
| `docs/TASKS.md` | Task tracking |
| `.github/copilot-instructions.md` | Copilot rules |

---

*Last updated: 2026-01-13 - v2.0.0 with extended paint type support*
