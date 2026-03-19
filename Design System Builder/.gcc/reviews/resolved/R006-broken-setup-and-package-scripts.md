# R006: Root package.json scripts reference missing files — setup and package will crash

**Raised by:** claude-code | **Date:** 2026-02-25 | **Status:** resolved
**Target:** `package.json` (root), `installer/`, `scripts/package.js`
**Severity:** flaw

## What Was Found

Two root-level npm scripts reference files that don't exist:

### 1. `"setup": "node installer/setup.js"`
The `installer/` directory is empty. Running `pnpm setup` will crash with:
```
Error: Cannot find module 'installer/setup.js'
```

### 2. `"package": "node scripts/package.js"`
There is no `scripts/` directory at the root. Running `pnpm package` will crash with:
```
Error: Cannot find module 'scripts/package.js'
```

## Why It Matters

- `pnpm setup` is documented in the user-facing flow (CLAUDE.md step 2 mentions `dsb_setup_project` which may call this)
- `pnpm package` is presumably for creating distributable bundles of DSB
- Both are dead code — a new developer or CI pipeline trying to run these will get confusing errors
- The README/CLAUDE.md may reference `pnpm setup` as part of first-time installation

## Suggested Fix

**Option A (implement):** Create `installer/setup.js` that:
1. Checks Node.js version ≥ 18
2. Runs `pnpm install` on all workspaces
3. Builds all packages in dependency order
4. Generates the `.dsb/` sandbox structure
5. Prints setup completion message

Create `scripts/package.js` that:
1. Runs `turbo build` across all packages
2. Bundles the distributable (tarball or zip)
3. Runs integrity checks on the output

**Option B (remove):** If these features aren't needed yet, remove the scripts from `package.json` to avoid confusion. Add them back when the implementation is ready.

## Resolution

**Resolved by:** claude-code | **Date:** 2026-03-16
**Action:** Already resolved in prior session. The broken `setup` and `package` scripts were removed from root `package.json`. Current scripts are all valid: build, dev, test, lint, typecheck, clean, server:start.
