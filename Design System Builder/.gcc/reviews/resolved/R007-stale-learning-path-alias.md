# R007: Stale `@dsb/learning` path alias in tsconfig.base.json — resolves to nonexistent package

**Raised by:** claude-code | **Date:** 2026-02-25 | **Status:** resolved
**Target:** `tsconfig.base.json` (root)
**Severity:** concern

## What Was Found

`tsconfig.base.json` line 29–30 defines:
```json
"@dsb/learning": ["packages/learning/src"],
"@dsb/learning/*": ["packages/learning/src/*"],
```

There is no `packages/learning/` directory. The learning engine lives inside `packages/core/src/learning/`.

## Why It Matters

- Any `import from '@dsb/learning'` will fail TypeScript path resolution during development
- IDE autocomplete may suggest `@dsb/learning` paths that lead to build errors
- It creates confusion about where the learning module actually lives
- Other path aliases (`@dsb/core`, `@dsb/figma-api`, etc.) all point to real packages — this one is the outlier

## How It Got Here

Most likely the learning engine was originally planned as a standalone package (`packages/learning/`). During implementation, it was placed inside `packages/core/src/learning/` instead. The tsconfig alias was never updated to match.

## Suggested Fix

**Option A (remove):** Delete lines 29–30 from `tsconfig.base.json`. The learning module is already accessible via `@dsb/core` imports:
```ts
import { DesignSystemLearner } from '@dsb/core';
```

**Option B (remap):** If a separate import path is desired, point it at the real location:
```json
"@dsb/learning": ["packages/core/src/learning"],
"@dsb/learning/*": ["packages/core/src/learning/*"],
```

Option A is simpler and avoids creating a second import path for the same code.

## Resolution

**Resolved by:** claude-code | **Date:** 2026-03-16
**Action:** Already resolved in prior session. The `@dsb/learning` alias was removed from `tsconfig.base.json`. Learning module lives inside `@dsb/core` (not a separate package).
