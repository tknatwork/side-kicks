/**
 * Copy Detector — Detects unauthorized duplication or redistribution.
 *
 * Triggers Level 4 (Nuclear Wipe) when:
 *   1. DSB running from a different path than the registered installation
 *   2. Parallel DSB instance detected from a different location
 *   3. Archive/compression of the DSB folder detected
 *   4. DSB inside a cloud-synced directory
 *   5. DSB added to a git repo that isn't its own dev repo
 *
 * @module copy-detector
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Result } from './result';
import { DSB_ROOT, IS_DEVELOPMENT } from './constants';
import { sha256 } from './crypto';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export type CopyDetectionReason =
  | 'path_mismatch'
  | 'parallel_instance'
  | 'archive_detected'
  | 'cloud_sync_detected'
  | 'git_repo_detected';

export interface CopyDetectionResult {
  readonly detected: boolean;
  readonly reason?: CopyDetectionReason;
  readonly details?: string;
}

// ============================================================================
// SECTION 2: INSTALLATION PATH TRACKING
// ============================================================================

const INSTALL_PATH_FILE: string = path.resolve(os.homedir(), '.dsb', 'install-path.json');
const LOCK_FILE: string = path.resolve(os.homedir(), '.dsb', 'dsb.lock');

/**
 * Register the current installation path.
 * Called during setup/activation.
 */
export function registerInstallPath(): Result<string, string> {
  const data = {
    path: DSB_ROOT,
    hash: sha256(DSB_ROOT),
    registeredAt: new Date().toISOString(),
  };

  try {
    const dir = path.dirname(INSTALL_PATH_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(INSTALL_PATH_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return Result.ok(DSB_ROOT);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to register install path: ${message}`);
  }
}

/**
 * Check if the current path matches the registered installation path.
 */
export function checkPathMismatch(): CopyDetectionResult {
  if (IS_DEVELOPMENT) return { detected: false };

  try {
    if (!fs.existsSync(INSTALL_PATH_FILE)) {
      // First run — no registered path yet
      return { detected: false };
    }

    const content = fs.readFileSync(INSTALL_PATH_FILE, 'utf-8');
    const data = JSON.parse(content) as { path: string; hash: string };
    const currentHash = sha256(DSB_ROOT);

    if (data.hash !== currentHash) {
      return {
        detected: true,
        reason: 'path_mismatch',
        details: `Registered: ${data.path}, Current: ${DSB_ROOT}`,
      };
    }

    return { detected: false };
  } catch {
    return { detected: false }; // Parse error — not a copy signal
  }
}

// ============================================================================
// SECTION 3: CLOUD SYNC DETECTION
// ============================================================================

/** Known cloud sync directory names. */
const CLOUD_SYNC_DIRS: readonly string[] = [
  'Dropbox',
  'Google Drive',
  'OneDrive',
  'iCloud Drive',
  'Box',
  'pCloud',
  'Nextcloud',
  'Syncthing',
];

/**
 * Check if DSB is located inside a cloud-synced directory.
 */
export function checkCloudSync(): CopyDetectionResult {
  if (IS_DEVELOPMENT) return { detected: false };

  const normalizedRoot = DSB_ROOT.toLowerCase();

  for (const syncDir of CLOUD_SYNC_DIRS) {
    if (normalizedRoot.includes(syncDir.toLowerCase())) {
      return {
        detected: true,
        reason: 'cloud_sync_detected',
        details: `DSB is inside a "${syncDir}" directory. Move it to a local-only path.`,
      };
    }
  }

  // Also check common cloud sync paths
  const cloudPaths = [
    path.join(os.homedir(), 'Dropbox'),
    path.join(os.homedir(), 'Google Drive'),
    path.join(os.homedir(), 'OneDrive'),
    path.join(os.homedir(), 'Library', 'Mobile Documents'), // iCloud on macOS
  ];

  for (const cloudPath of cloudPaths) {
    if (DSB_ROOT.startsWith(cloudPath)) {
      return {
        detected: true,
        reason: 'cloud_sync_detected',
        details: `DSB is inside "${cloudPath}". Move it to a local-only path.`,
      };
    }
  }

  return { detected: false };
}

// ============================================================================
// SECTION 4: GIT REPO DETECTION
// ============================================================================

/**
 * Check if DSB folder is inside a git repository that isn't its own dev repo.
 */
export function checkGitRepo(): CopyDetectionResult {
  if (IS_DEVELOPMENT) return { detected: false };

  // Walk up from DSB_ROOT looking for .git directories
  let current = DSB_ROOT;
  const root = path.parse(current).root;

  while (current !== root) {
    const gitDir = path.join(current, '.git');
    if (fs.existsSync(gitDir)) {
      // Found a .git directory — is it DSB's own?
      if (current === DSB_ROOT) {
        // .git at DSB root level — this IS DSB's own dev repo, skip
        return { detected: false };
      }

      // .git is above DSB — someone added DSB into their repo
      return {
        detected: true,
        reason: 'git_repo_detected',
        details: `DSB is inside a git repository at "${current}". ` +
          'DSB should not be tracked in external git repos.',
      };
    }
    current = path.dirname(current);
  }

  return { detected: false };
}

// ============================================================================
// SECTION 5: LOCK FILE (Parallel Instance Detection)
// ============================================================================

/**
 * Acquire the instance lock. Returns false if another instance holds it.
 */
export function acquireInstanceLock(): Result<boolean, string> {
  if (IS_DEVELOPMENT) return Result.ok(true);

  try {
    const dir = path.dirname(LOCK_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Check existing lock
    if (fs.existsSync(LOCK_FILE)) {
      const content = fs.readFileSync(LOCK_FILE, 'utf-8');
      const lockData = JSON.parse(content) as { pid: number; path: string; timestamp: string };

      // Check if the locking process is still alive
      try {
        process.kill(lockData.pid, 0); // Signal 0 = check if process exists
        // Process is alive — check if it's from a different path
        if (lockData.path !== DSB_ROOT) {
          return Result.ok(false); // Parallel instance from different location
        }
        // Same path, different PID — previous instance didn't clean up
      } catch {
        // Process is dead — stale lock, safe to overwrite
      }
    }

    // Write our lock
    const lockData = {
      pid: process.pid,
      path: DSB_ROOT,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2), 'utf-8');
    return Result.ok(true);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to acquire instance lock: ${message}`);
  }
}

/**
 * Release the instance lock.
 */
export function releaseInstanceLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch {
    // Non-fatal
  }
}

// ============================================================================
// SECTION 6: COMBINED CHECK
// ============================================================================

/**
 * Run all copy detection checks.
 * Returns the first detected violation, or no detection.
 */
export function runAllCopyDetectionChecks(): CopyDetectionResult {
  if (IS_DEVELOPMENT) return { detected: false };

  // Check path mismatch
  const pathCheck = checkPathMismatch();
  if (pathCheck.detected) return pathCheck;

  // Check cloud sync
  const cloudCheck = checkCloudSync();
  if (cloudCheck.detected) return cloudCheck;

  // Check git repo
  const gitCheck = checkGitRepo();
  if (gitCheck.detected) return gitCheck;

  return { detected: false };
}
