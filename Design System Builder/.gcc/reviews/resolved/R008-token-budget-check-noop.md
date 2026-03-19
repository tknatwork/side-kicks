# R008: Token budget check in build-tools.ts is a no-op — build will never auto-pause

**Raised by:** claude-code | **Date:** 2026-02-25 | **Status:** resolved
**Target:** `packages/mcp-server/src/tools/build-tools.ts` (lines 241–246)
**Severity:** flaw

## What Was Found

The `executePipeline()` function defines token budget constants and runs a budget check, but the check body is empty:

```ts
// Line 53–57
const TOKEN_BUDGET_PER_STEP = 3000;
const MIN_REMAINING_TOKENS = 5000;

// Lines 241–246
// Token budget check — pause if running low
const remainingTokens = estimateRemainingTokens([...state.pendingSteps]);
if (remainingTokens > MIN_REMAINING_TOKENS * 2 && state.pendingSteps.length > 1) {
  // Heuristic: if estimated remaining cost > 2x our safety threshold
  // and we have multiple steps left, check if we should pause
}
```

The if-block has no body — the budget check executes, evaluates the condition, and does nothing.

## Why It Matters

The build pipeline is designed to checkpoint and pause before running out of context tokens (documented in CLAUDE.md: "Between each step, estimate remaining budget (~3000 tokens per step). If budget is low, save checkpoint as `paused`"). With this no-op:

1. The build will run until it hits Claude's context limit hard — causing an abrupt crash instead of a graceful pause
2. `dsb_resume_build` exists specifically to recover from budget-based pauses, but this code path can never trigger one
3. Users may lose partial build progress if the crash happens between checkpoints

## Suggested Fix

Implement the budget check body:

```ts
if (remainingTokens > MIN_REMAINING_TOKENS * 2 && state.pendingSteps.length > 1) {
  // Estimated remaining cost exceeds our safety threshold — pause the build
  const pausedState: BuildState = {
    ...state,
    status: 'paused',
    pauseReason: `Token budget heuristic: ~${remainingTokens} tokens estimated for ${state.pendingSteps.length} remaining steps`,
    lastCheckpointAt: new Date().toISOString(),
  };
  saveBuildState(pausedState);
  return ok({
    status: 'paused',
    reason: 'Approaching token budget limit. Run dsb_resume_build in a new session to continue.',
    completedSteps: state.completedSteps,
    remainingSteps: state.pendingSteps,
  });
}
```

Note: The condition logic may also be inverted — it currently checks `remainingTokens > threshold` which means "budget is high, keep going". If the intent is to pause when low, the condition should be `<` not `>`. Verify the intended semantics.

## Resolution

**Resolved by:** claude-code | **Date:** 2026-03-16
**Action:** Already resolved in prior session. Budget check body is fully implemented with correct `<` condition: pauses build when `remainingTokens < MIN_REMAINING_TOKENS` and there are pending steps.
