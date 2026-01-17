# CLAUDE.md - Variables & Styles Extractor

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

## ⚠️ WORKSPACE SCOPE RESTRICTION

**ONLY work within:** `Side-Kicks/variables-styles-extractor/`  
**NEVER touch:** `My Portfolio/`, `Content Files/`, `Research Study/`

---

## Project Overview

This is a Figma plugin for exporting and importing variables and styles between Figma files.

- **Repository:** https://github.com/tknatwork/side-kicks
- **Version:** 2.0.0 (in development - UI overhaul)
- **UI Size:** 1000x540 pixels (4-column layout)

## Critical Files to Read First

**MANDATORY:** Read these files before ANY code changes or new feature development.

| Priority | File | Purpose |
|----------|------|--------|
| 1 | `docs/CODING_STANDARDS.md` | Coding standards, patterns & conventions |
| 2 | `docs/AI_CONTEXT.md` | Project context and architecture |
| 3 | `docs/CHANGELOG.md` | Version history and recent changes |
| 4 | `docs/TASKS.md` | Current tasks and backlog |

---

## New Feature Development Protocol

When working on a new kind of build or feature that isn't covered in the critical files:

### Step 1: Build First, Document After
1. **Check critical files** for relevant instructions/patterns
2. **If no guidance exists** for this type of feature:
   - Follow existing coding standards and patterns
   - Build the feature to be functional first
   - Test thoroughly to ensure it works

### Step 2: Update Documentation
Once the feature is working:
1. **Update `docs/CODING_STANDARDS.md`** with any new patterns discovered
2. **Update `docs/AI_CONTEXT.md`** if architecture changed
3. **Update `docs/CHANGELOG.md`** with the new feature
4. **Update this file** if new critical workflows emerged

---

## Tech Stack

- TypeScript (ES2017 target - required for Figma VM)
- Single-file UI (`ui.html` - HTML/CSS/JS combined)
- Figma Plugin API

## Key Constraints

### Figma VM Limitations
- NO spread operators (`{...obj}`)
- NO generators
- Use `Object.assign()` instead of spread
- Use async Figma APIs (`*Async()` versions)

### CSS in Plugin Iframe
- NO `contain: strict` (use `contain: layout style`)
- NO `content-visibility: auto`
- GPU acceleration OK (`transform: translateZ(0)`)

## Build Commands

```bash
cd Side-Kicks/variables-styles-extractor
pnpm install
pnpm build    # tsc + terser minification
```

## After Making Changes

1. Update `docs/CHANGELOG.md` with changes
2. Add to Best Practices if you learned something new
3. Update Known Issues if you found/fixed a bug
4. Run `pnpm build` and test in Figma
