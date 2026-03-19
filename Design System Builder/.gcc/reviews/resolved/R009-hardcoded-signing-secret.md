# R009: Hardcoded signing secret `'dsb-manifest-v1'` in two locations — weakens file integrity system

**Raised by:** claude-code | **Date:** 2026-02-25 | **Status:** open
**Target:** `packages/mcp-server/src/tools/setup-tools.ts` (lines 114, 157)
**Severity:** concern

## What Was Found

The manifest signing secret is hardcoded as a string literal in two places within `setup-tools.ts`:

```ts
// Line 114 (inside dsb_setup_project handler)
const signingSecret = 'dsb-manifest-v1';
const manifestResult = generateProjectManifest(projectPath, TRACKED_FILES, signingSecret, version);

// Line 157 (inside dsb_system_check handler)
const signingSecret = 'dsb-manifest-v1';
const integrityResult = fullIntegrityCheck(projectPath, signingSecret);
```

Line 113 has a comment: `// Using a simple signing secret for now — will be replaced with proper key derivation`

## Why It Matters

The file integrity system is designed to detect unauthorized modification of DSB project files (anti-tamper monitoring described in CLAUDE.md). With a hardcoded, publicly visible secret:

1. **Tamper bypass:** Anyone reading the source code can compute valid manifests for modified files, defeating the integrity check entirely
2. **DRY violation:** The same string appears twice — if one is updated and the other isn't, `dsb_setup_project` and `dsb_system_check` will disagree on file integrity
3. **The TODO is acknowledged** (comment on line 113) but not tracked in any issue system

## Suggested Fix

**Short-term (unblock):**
Extract to a single constant:
```ts
// In a shared constants file
export const MANIFEST_SIGNING_SECRET = 'dsb-manifest-v1';
```
Import in both locations. This fixes the DRY issue immediately.

**Medium-term (proper security):**
Derive the signing key from machine-specific data (hardware ID, license key hash, installation timestamp) so the secret isn't portable across machines. The `guardrails` package already has crypto utilities (`packages/guardrails/src/crypto.ts`) that could host this derivation.

**Tracking:**
Add a TODO item or GCC review note to track the key derivation upgrade as a follow-up before v1.0 release.

## Resolution

**Resolved by:** claude-code | **Date:** 2026-03-16
**Action:** Extracted to `MANIFEST_SIGNING_SECRET` constant at module scope in `setup-tools.ts`. Both `dsb_setup_project` and `dsb_system_check` now reference the single constant. TODO comment retained for future key derivation upgrade.
