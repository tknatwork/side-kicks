/**
 * Nuclear Wipe — Level 4 tamper response. Removes entire DSB installation.
 *
 * PRESERVES (user's property, never touched):
 *   - workspace/context/   (user's input files)
 *   - workspace/exports/   (user's exported work)
 *   - WIPED.md             (explanation file, created after wipe)
 *
 * DESTROYS (DSB intellectual property):
 *   - packages/            (all code)
 *   - agents/              (all prompts)
 *   - templates/           (all presets)
 *   - installer/           (setup scripts)
 *   - .claude/             (CLAUDE.md)
 *   - docs/                (documentation)
 *   - workspace/specs/     (generated specs)
 *   - workspace/reports/   (QA reports)
 *   - workspace/temp/      (temporary files)
 *   - node_modules/        (dependencies)
 *   - Root config files    (package.json, tsconfig.*, turbo.json, .env)
 *
 * @module nuclear-wipe
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DSB_ROOT, IS_DEVELOPMENT } from './constants';
import type { CopyDetectionReason } from './copy-detector';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface WipeLogEntry {
  readonly timestamp: string;
  readonly reason: CopyDetectionReason;
  readonly detectedPath: string;
  readonly registeredPath: string;
  readonly machineFingerprint: string;
}

// ============================================================================
// SECTION 2: NUCLEAR WIPE EXECUTION
// ============================================================================

const WIPE_LOG_PATH: string = path.resolve(os.homedir(), '.dsb', 'wipe-log.json');

const WIPED_MD_CONTENT = `# Design System Builder — Installation Removed

This Design System Builder installation was removed because an unauthorized
copy or redistribution was detected.

## What Was Preserved

- \`workspace/context/\` — Your input files are safe
- \`workspace/exports/\` — Your exported work is safe

## What Was Removed

All DSB code, agents, templates, and configuration files have been removed.

## How to Recover

1. Re-download the toolkit from your Gumroad purchase (free re-download)
2. Extract to a LOCAL-ONLY directory (not cloud-synced, not inside another git repo)
3. Ask Claude to set up Design System Builder again

## Need Help?

Contact support with your license key.
`;

/**
 * Execute nuclear wipe — removes DSB installation while preserving user data.
 *
 * WARNING: This permanently deletes all DSB code from the installation folder.
 * Only workspace/context/ and workspace/exports/ survive.
 *
 * @param reason - Why the wipe was triggered.
 * @param registeredPath - The expected installation path.
 * @param machineFingerprint - The machine fingerprint for logging.
 */
export function executeNuclearWipe(
  reason: CopyDetectionReason,
  registeredPath: string,
  machineFingerprint: string
): void {
  // NEVER execute in development mode
  if (IS_DEVELOPMENT) {
    console.warn('[DSB] Nuclear wipe requested but DEVELOPMENT_MODE is active — skipping.');
    return;
  }

  // Step 1: Log the wipe event BEFORE wiping (evidence persists outside DSB folder)
  logWipeEvent(reason, registeredPath, machineFingerprint);

  // Step 2: Identify what to preserve and what to destroy
  const preservePaths = new Set([
    path.resolve(DSB_ROOT, 'workspace', 'context'),
    path.resolve(DSB_ROOT, 'workspace', 'exports'),
  ]);

  const destroyPaths = [
    'packages',
    'agents',
    'templates',
    'installer',
    '.claude',
    'docs',
    'workspace/specs',
    'workspace/reports',
    'workspace/temp',
    'node_modules',
    '.turbo',
    '.dsb',
  ];

  const destroyFiles = [
    'package.json',
    'package-lock.json',
    'tsconfig.base.json',
    'tsconfig.plugin.json',
    'turbo.json',
    '.env',
    '.env.local',
    '.gitignore',
  ];

  // Step 3: Destroy directories
  for (const relativePath of destroyPaths) {
    const absolutePath = path.resolve(DSB_ROOT, relativePath);
    if (preservePaths.has(absolutePath)) continue;
    safeRemoveDir(absolutePath);
  }

  // Step 4: Destroy root files
  for (const fileName of destroyFiles) {
    const absolutePath = path.resolve(DSB_ROOT, fileName);
    safeRemoveFile(absolutePath);
  }

  // Step 5: Write the WIPED.md explanation file
  try {
    fs.writeFileSync(
      path.resolve(DSB_ROOT, 'WIPED.md'),
      WIPED_MD_CONTENT,
      'utf-8'
    );
  } catch {
    // Non-fatal — user can still re-download
  }

  // Step 6: Clean up activation token
  const activationPath = path.resolve(os.homedir(), '.dsb', 'activation.enc');
  safeRemoveFile(activationPath);

  // Step 7: Clean up lock file
  const lockPath = path.resolve(os.homedir(), '.dsb', 'dsb.lock');
  safeRemoveFile(lockPath);
}

// ============================================================================
// SECTION 3: WIPE LOGGING
// ============================================================================

function logWipeEvent(
  reason: CopyDetectionReason,
  registeredPath: string,
  machineFingerprint: string
): void {
  const entry: WipeLogEntry = {
    timestamp: new Date().toISOString(),
    reason,
    detectedPath: DSB_ROOT,
    registeredPath,
    machineFingerprint,
  };

  try {
    const dir = path.dirname(WIPE_LOG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Append to existing log.
    // Try to read directly; treat ENOENT as "no prior log".
    // Folding the existence check into the read closes the TOCTOU
    // window between existsSync and readFileSync.
    // (Fixes CodeQL js/file-system-race.)
    let existingEntries: WipeLogEntry[] = [];
    try {
      const content = fs.readFileSync(WIPE_LOG_PATH, 'utf-8');
      existingEntries = JSON.parse(content) as WipeLogEntry[];
    } catch (err: unknown) {
      if (!err || (err as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Real error (corrupted JSON, permissions). Start fresh — the
        // wipe still proceeds; this is a best-effort audit log.
        existingEntries = [];
      }
    }

    existingEntries.push(entry);
    fs.writeFileSync(WIPE_LOG_PATH, JSON.stringify(existingEntries, null, 2), 'utf-8');
  } catch {
    // If we can't log, proceed with the wipe anyway
  }
}

// ============================================================================
// SECTION 4: SAFE REMOVAL HELPERS
// ============================================================================

function safeRemoveDir(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
    // Continue with other deletions
  }
}

function safeRemoveFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Continue with other deletions
  }
}
