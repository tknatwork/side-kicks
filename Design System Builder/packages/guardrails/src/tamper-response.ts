/**
 * Tamper Response — Escalating response to integrity violations.
 *
 * 4 levels of response:
 *   Level 1 (WARNING):  Single file mismatch, likely corruption → warn + allow read-only
 *   Level 2 (LOCKOUT):  Repeated issues or 24h after L1 → block all write operations
 *   Level 3 (SCRAMBLE): Deliberate bypass detected → overwrite IP with placeholders
 *   Level 4 (NUCLEAR):  Copy/redistribution detected → delete entire installation
 *
 * @module tamper-response
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { DSB_ROOT, IS_DEVELOPMENT } from './constants';
import { auditLog } from './audit-log';
import type { IntegrityCheckResult } from './integrity';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type TamperLevel = 1 | 2 | 3 | 4;

export interface TamperEvent {
  readonly level: TamperLevel;
  readonly timestamp: string;
  readonly reason: string;
  readonly modifiedFiles: readonly string[];
}

export interface TamperState {
  readonly events: readonly TamperEvent[];
  readonly currentLevel: TamperLevel;
  readonly lockedOut: boolean;
  readonly lastEventAt: string;
}

// ============================================================================
// SECTION 2: TAMPER DETECTION
// ============================================================================

const TAMPER_STATE_PATH: string = path.resolve(DSB_ROOT, '.dsb', 'tamper-state.json');
const TWENTY_FOUR_HOURS_MS: number = 24 * 60 * 60 * 1000;

/**
 * Evaluate an integrity check result and determine the appropriate tamper level.
 *
 * @param checkResult - The result from verifyIntegrity().
 * @returns The tamper level to apply, or null if no tampering detected.
 */
export function evaluateTamperLevel(checkResult: IntegrityCheckResult): TamperLevel | null {
  if (IS_DEVELOPMENT) return null;
  if (checkResult.status === 'valid' || checkResult.status === 'bypassed') return null;

  const modified = checkResult.modifiedFiles;
  const missing = checkResult.missingFiles;

  // Check for manifest tampering → Level 3 immediately
  if (modified.includes('integrity-manifest.json')) {
    return 3;
  }

  // Check for license code tampering → Level 3 immediately
  const licenseFiles = modified.filter(f =>
    f.includes('licensing/') || f.includes('guardrails/')
  );
  if (licenseFiles.length > 0) {
    return 3;
  }

  // Multiple files modified simultaneously → Level 2 (escalate on repeat)
  if (modified.length > 2 || missing.length > 2) {
    const currentState = loadTamperState();
    if (currentState && currentState.currentLevel >= 2) {
      return 3; // Escalate from repeated Level 2
    }
    return 2;
  }

  // Single file mismatch → likely accidental corruption → Level 1
  if (modified.length <= 1 && missing.length <= 1) {
    return 1;
  }

  return 2;
}

/**
 * Record a tamper event and update the persistent state.
 */
export function recordTamperEvent(
  level: TamperLevel,
  reason: string,
  modifiedFiles: readonly string[]
): TamperState {
  const event: TamperEvent = {
    level,
    timestamp: new Date().toISOString(),
    reason,
    modifiedFiles,
  };

  const currentState = loadTamperState();
  const events = currentState ? [...currentState.events, event] : [event];

  const newState: TamperState = {
    events,
    currentLevel: level,
    lockedOut: level >= 2,
    lastEventAt: event.timestamp,
  };

  saveTamperState(newState);
  auditLog('DENIED', 'TAMPER_DETECTED', 'DENIED', `Level ${level}: ${reason}`);

  return newState;
}

/**
 * Check if the system should auto-escalate (24h after Level 1 → Level 2).
 */
export function checkAutoEscalation(): TamperLevel | null {
  if (IS_DEVELOPMENT) return null;

  const state = loadTamperState();
  if (!state) return null;

  if (state.currentLevel === 1) {
    const elapsed = Date.now() - new Date(state.lastEventAt).getTime();
    if (elapsed > TWENTY_FOUR_HOURS_MS) {
      return 2; // Auto-escalate
    }
  }

  return null;
}

/**
 * Check if the system is currently locked out.
 */
export function isLockedOut(): boolean {
  if (IS_DEVELOPMENT) return false;
  const state = loadTamperState();
  return state?.lockedOut === true;
}

/**
 * Get the current tamper level.
 */
export function getCurrentTamperLevel(): TamperLevel | null {
  const state = loadTamperState();
  return state?.currentLevel ?? null;
}

// ============================================================================
// SECTION 3: SCRAMBLE (Level 3)
// ============================================================================

/** Placeholder text for scrambled files. */
const SCRAMBLE_PLACEHOLDER = 'This file has been invalidated. Please reinstall from your Gumroad purchase.';

/**
 * Execute Level 3 scramble — overwrite intellectual property with placeholders.
 * Preserves workspace/context/ and workspace/exports/ (user data).
 */
export function executeScramble(): void {
  if (IS_DEVELOPMENT) return;

  const filesToScramble = [
    '.claude/CLAUDE.md',
    // Agent prompts would be listed here when they exist
  ];

  for (const relativePath of filesToScramble) {
    const absolutePath = path.resolve(DSB_ROOT, relativePath);
    try {
      if (fs.existsSync(absolutePath)) {
        fs.writeFileSync(absolutePath, SCRAMBLE_PLACEHOLDER, 'utf-8');
      }
    } catch {
      // Continue scrambling even if one file fails
    }
  }

  // Clear cached context
  const dsbDir = path.resolve(DSB_ROOT, '.dsb');
  if (fs.existsSync(dsbDir)) {
    try {
      clearDirectory(dsbDir, ['tamper-state.json']); // Keep tamper state as evidence
    } catch {
      // Non-fatal
    }
  }

  auditLog('DENIED', 'SCRAMBLE_EXECUTED', 'DENIED', 'Level 3 tamper response executed');
}

// ============================================================================
// SECTION 4: PERSISTENCE
// ============================================================================

function loadTamperState(): TamperState | null {
  try {
    if (!fs.existsSync(TAMPER_STATE_PATH)) return null;
    const content = fs.readFileSync(TAMPER_STATE_PATH, 'utf-8');
    return JSON.parse(content) as TamperState;
  } catch {
    return null;
  }
}

function saveTamperState(state: TamperState): void {
  try {
    const dir = path.dirname(TAMPER_STATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TAMPER_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Non-fatal — tamper state persistence is best-effort
  }
}

// ============================================================================
// SECTION 5: HELPERS
// ============================================================================

function clearDirectory(dirPath: string, preserve: readonly string[] = []): void {
  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    if (preserve.includes(entry)) continue;
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}
