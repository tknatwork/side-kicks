/**
 * Integrity Checker — Per-call integrity validation for MCP tools.
 *
 * Every `dsb_` MCP tool call runs through this checker first.
 * It validates the README hash against the project manifest and
 * returns an error response if integrity is compromised.
 *
 * This is the enforcement layer that makes the locked README work:
 * if a user modifies the README, all DSB tools refuse to operate
 * until the file is restored.
 *
 * @module core/crypto/integrity-checker
 */

import { Result } from '@dsb/guardrails';
import {
  loadProjectManifest,
  verifySingleFile,
  verifyProjectManifest,
} from './manifest';
import type { ProjectManifest, ManifestVerification } from './manifest';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** Result of an integrity check. */
export interface IntegrityGate {
  /** Whether the system is safe to proceed. */
  readonly ok: boolean;
  /** Error message if integrity is compromised. */
  readonly error?: string;
  /** Which files were found modified (for reporting). */
  readonly modifiedFiles?: readonly string[];
}

// ============================================================================
// SECTION 2: QUICK CHECK (per tool call)
// ============================================================================

/**
 * Quick integrity check — validates README against manifest.
 *
 * Called at the start of every MCP tool handler. Fast because
 * it only hashes one file (README.md) instead of the entire project.
 *
 * @param projectRoot - Absolute path to the user's project folder.
 * @returns Gate result: ok=true means safe to proceed.
 */
export function checkIntegrity(projectRoot: string): IntegrityGate {
  // Load manifest
  const manifestResult = loadProjectManifest(projectRoot);
  if (!manifestResult.ok) {
    // No manifest = fresh install or setup not complete, allow tools to proceed
    // (setup tools need to run before manifest exists)
    return { ok: true };
  }

  const manifest = manifestResult.value;

  // Check README
  const readmeCheck = verifySingleFile(projectRoot, manifest, 'README.md');
  if (!readmeCheck.ok) {
    return {
      ok: false,
      error: `Integrity check error: ${readmeCheck.error}`,
    };
  }

  if (!readmeCheck.value) {
    return {
      ok: false,
      error: 'System integrity compromised. README was modified. Restoring...',
      modifiedFiles: ['README.md'],
    };
  }

  return { ok: true };
}

// ============================================================================
// SECTION 3: FULL CHECK (system check / recovery)
// ============================================================================

/**
 * Full integrity check — validates all tracked files against manifest.
 *
 * Called by `dsb_system_check` and lockdown recovery. Slower but
 * comprehensive — checks every file in the manifest.
 *
 * @param projectRoot - Absolute path to the user's project folder.
 * @param signingSecret - The HMAC signing secret for manifest verification.
 * @returns Full verification result or error.
 */
export function fullIntegrityCheck(
  projectRoot: string,
  signingSecret: string
): Result<ManifestVerification, string> {
  const manifestResult = loadProjectManifest(projectRoot);
  if (!manifestResult.ok) return manifestResult;

  return verifyProjectManifest(projectRoot, manifestResult.value, signingSecret);
}

/**
 * Format an integrity failure as an MCP tool error response.
 *
 * Produces the structured JSON that MCP tool handlers return
 * when integrity is compromised.
 */
export function formatIntegrityError(gate: IntegrityGate): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        error: gate.error,
        modifiedFiles: gate.modifiedFiles ?? [],
        action: 'System integrity compromised. Run dsb_system_check to diagnose and repair.',
      }, null, 2),
    }],
  };
}
