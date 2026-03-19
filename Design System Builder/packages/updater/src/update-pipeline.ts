/**
 * Update Pipeline — Atomic OTA update execution with rollback.
 *
 * Executes the full update lifecycle:
 *   1. Download signed bundle (HTTPS, TLS 1.3)
 *   2. Verify Ed25519 signature + SHA-256 checksums
 *   3. Request update token from anti-tamper daemon
 *   4. Create full backup of current installation
 *   5. Extract update to staging directory
 *   6. Run pnpm install && pnpm run build in staging
 *   7. Atomic swap: current → old, staging → current
 *   8. On failure: rollback (swap old → current)
 *   9. Expire update token → daemon resumes monitoring
 *
 * SECURITY:
 * - No admin key involved — uses embedded Ed25519 public key only
 * - Gumroad license authenticates download access (separate system)
 * - Every file is checksum-verified before installation
 * - Signature verification uses crypto.verify() (Node.js built-in)
 *
 * @module updater/update-pipeline
 */

import * as https from 'node:https';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { Result } from '@dsb/guardrails';
import type { UpdateManifest } from './version-checker';
import {
  UPDATE_PUBLIC_KEY,
  BUNDLE_DOWNLOAD_TIMEOUT_MS,
  MIN_TLS_VERSION,
  backupDir,
  stagingDir,
  bundlePath,
} from './constants';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** Progress callback for UI/Claude reporting. */
export type ProgressCallback = (step: string, detail: string) => void;

/** Result of executing the update pipeline. */
export interface UpdateResult {
  readonly success: boolean;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly message: string;
  readonly rolledBack?: boolean;
}

/** Bridge interface for daemon communication (injected, not imported). */
export interface UpdateBridge {
  enterDaemonUpdateMode(token: string): Promise<{ ok: boolean; error?: string }>;
  exitDaemonUpdateMode(token: string): Promise<{ ok: boolean; error?: string }>;
}

// ============================================================================
// SECTION 2: MAIN PIPELINE
// ============================================================================

/**
 * Execute the full update pipeline.
 *
 * This is the top-level function called by the MCP tool after user approval.
 * It handles the entire lifecycle including rollback on failure.
 *
 * @param manifest - Verified update manifest (already signature-checked).
 * @param licenseKey - Gumroad license for download authentication.
 * @param currentVersion - Currently installed DSB version.
 * @param installDir - Root directory of the DSB installation (packages/).
 * @param bridge - Bridge client for daemon communication.
 * @param onProgress - Optional progress callback.
 * @returns Update result (success or failure with rollback info).
 */
export async function executeUpdate(
  manifest: UpdateManifest,
  licenseKey: string,
  currentVersion: string,
  installDir: string,
  bridge: UpdateBridge,
  onProgress?: ProgressCallback
): Promise<UpdateResult> {
  const report = onProgress || (() => {});
  const backup = backupDir(currentVersion);
  const staging = stagingDir();
  const bundle = bundlePath(manifest.version);
  let updateToken: string | null = null;
  let backupCreated = false;

  try {
    // ─── Step 1: Download Bundle ───────────────────────────────────────

    report('downloading', `Downloading DSB v${manifest.version}...`);

    const downloadResult = await downloadBundle(
      manifest.downloadUrl,
      licenseKey,
      bundle
    );
    if (!downloadResult.ok) {
      return failure(currentVersion, manifest.version, downloadResult.error);
    }

    // ─── Step 2: Verify Bundle Checksum ────────────────────────────────

    report('verifying', 'Verifying bundle integrity...');

    const checksumResult = await verifyBundleChecksum(bundle, manifest.bundleChecksum);
    if (!checksumResult.ok) {
      cleanupFile(bundle);
      return failure(currentVersion, manifest.version, checksumResult.error);
    }

    // ─── Step 3: Verify Bundle Signature ───────────────────────────────

    report('verifying', 'Verifying cryptographic signature...');

    const sigResult = await verifyBundleSignature(bundle);
    if (!sigResult.ok) {
      cleanupFile(bundle);
      return failure(currentVersion, manifest.version, sigResult.error);
    }

    // ─── Step 4: Request Update Token from Daemon ──────────────────────

    report('preparing', 'Requesting update mode from anti-tamper daemon...');

    updateToken = crypto.randomBytes(32).toString('hex');
    const tokenResult = await bridge.enterDaemonUpdateMode(updateToken);
    if (!tokenResult.ok) {
      cleanupFile(bundle);
      return failure(currentVersion, manifest.version,
        'Failed to enter daemon update mode: ' + (tokenResult.error || 'unknown error')
      );
    }

    // ─── Step 5: Create Backup ─────────────────────────────────────────

    report('backup', `Backing up current installation (v${currentVersion})...`);

    const backupResult = createBackup(installDir, backup);
    if (!backupResult.ok) {
      await expireToken(bridge, updateToken);
      cleanupFile(bundle);
      return failure(currentVersion, manifest.version, backupResult.error);
    }
    backupCreated = true;

    // ─── Step 6: Extract to Staging ────────────────────────────────────

    report('extracting', 'Extracting update to staging directory...');

    const extractResult = await extractBundle(bundle, staging);
    if (!extractResult.ok) {
      await rollback(installDir, backup, bridge, updateToken);
      cleanupFile(bundle);
      return failureRolledBack(currentVersion, manifest.version, extractResult.error);
    }

    // ─── Step 7: Verify Per-File Checksums ─────────────────────────────

    report('verifying', 'Verifying per-file checksums...');

    const fileCheckResult = verifyFileChecksums(staging, manifest.fileChecksums);
    if (!fileCheckResult.ok) {
      await rollback(installDir, backup, bridge, updateToken);
      cleanupDir(staging);
      cleanupFile(bundle);
      return failureRolledBack(currentVersion, manifest.version, fileCheckResult.error);
    }

    // ─── Step 8: Build in Staging ──────────────────────────────────────

    report('building', 'Building updated packages in staging...');

    const buildResult = await buildInStaging(staging);
    if (!buildResult.ok) {
      await rollback(installDir, backup, bridge, updateToken);
      cleanupDir(staging);
      cleanupFile(bundle);
      return failureRolledBack(currentVersion, manifest.version, buildResult.error);
    }

    // ─── Step 9: Atomic Swap ───────────────────────────────────────────

    report('installing', 'Performing atomic swap...');

    const swapResult = atomicSwap(installDir, staging, backup);
    if (!swapResult.ok) {
      // Swap failed — try to restore from backup
      await rollback(installDir, backup, bridge, updateToken);
      cleanupDir(staging);
      cleanupFile(bundle);
      return failureRolledBack(currentVersion, manifest.version, swapResult.error);
    }

    // ─── Step 10: Cleanup + Expire Token ───────────────────────────────

    report('cleanup', 'Cleaning up temporary files...');

    cleanupFile(bundle);
    cleanupDir(backup); // Old backup no longer needed

    await expireToken(bridge, updateToken);

    report('complete', `Updated to DSB v${manifest.version} successfully!`);

    return {
      success: true,
      fromVersion: currentVersion,
      toVersion: manifest.version,
      message: `Updated from v${currentVersion} to v${manifest.version} successfully.`,
    };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Emergency cleanup
    if (updateToken) {
      await expireToken(bridge, updateToken).catch(() => {});
    }
    if (backupCreated) {
      await rollback(installDir, backup, bridge, updateToken).catch(() => {});
    }
    cleanupFile(bundle);
    cleanupDir(staging);

    return failureRolledBack(currentVersion, manifest.version, `Unexpected error: ${message}`);
  }
}

// ============================================================================
// SECTION 3: DOWNLOAD
// ============================================================================

/**
 * Download the update bundle via HTTPS.
 *
 * Streams directly to disk to avoid holding the entire bundle in memory.
 * License key is sent as a query parameter for server-side authentication.
 */
function downloadBundle(
  downloadUrl: string,
  licenseKey: string,
  destPath: string
): Promise<Result<true, string>> {
  return new Promise((resolve) => {
    // Ensure parent directory exists
    const dir = path.dirname(destPath);
    fs.mkdirSync(dir, { recursive: true });

    const url = `${downloadUrl}?license=${encodeURIComponent(licenseKey)}`;
    const file = fs.createWriteStream(destPath);

    const req = https.get(
      url,
      {
        timeout: BUNDLE_DOWNLOAD_TIMEOUT_MS,
        minVersion: MIN_TLS_VERSION as 'TLSv1.3',
      },
      (res) => {
        if (res.statusCode === 403) {
          file.close();
          cleanupFile(destPath);
          resolve(Result.err('License invalid or expired. Download server returned 403.'));
          return;
        }

        if (res.statusCode !== 200) {
          file.close();
          cleanupFile(destPath);
          resolve(Result.err(`Download server returned HTTP ${res.statusCode ?? 'unknown'}.`));
          return;
        }

        res.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(Result.ok(true));
        });
      }
    );

    req.on('error', (err) => {
      file.close();
      cleanupFile(destPath);
      resolve(Result.err(`Download error: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      file.close();
      cleanupFile(destPath);
      resolve(Result.err('Bundle download timed out.'));
    });
  });
}

// ============================================================================
// SECTION 4: VERIFICATION
// ============================================================================

/**
 * Verify the SHA-256 checksum of a downloaded bundle file.
 */
function verifyBundleChecksum(
  filePath: string,
  expectedChecksum: string
): Promise<Result<true, string>> {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk: Buffer) => hash.update(chunk));

    stream.on('end', () => {
      const actual = hash.digest('hex');
      if (actual !== expectedChecksum) {
        resolve(Result.err(
          `Bundle checksum mismatch. Expected: ${expectedChecksum.slice(0, 16)}..., Got: ${actual.slice(0, 16)}...`
        ));
      } else {
        resolve(Result.ok(true));
      }
    });

    stream.on('error', (err) => {
      resolve(Result.err(`Failed to read bundle for checksum: ${err.message}`));
    });
  });
}

/**
 * Verify the Ed25519 signature embedded in the bundle.
 *
 * The bundle's first 64 bytes are the Ed25519 signature of the
 * remaining content. We verify with the embedded public key.
 */
async function verifyBundleSignature(
  filePath: string
): Promise<Result<true, string>> {
  try {
    const data = fs.readFileSync(filePath);

    // Ed25519 signatures are 64 bytes
    if (data.length < 65) {
      return Result.err('Bundle too small to contain a valid signature.');
    }

    const signature = data.subarray(0, 64);
    const content = data.subarray(64);

    const isValid = crypto.verify(
      null, // Ed25519 doesn't use separate hash
      content,
      UPDATE_PUBLIC_KEY,
      signature
    );

    if (!isValid) {
      return Result.err(
        'Bundle signature verification failed. '
        + 'The bundle may have been tampered with. Update rejected.'
      );
    }

    return Result.ok(true);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Bundle signature verification error: ${message}`);
  }
}

/**
 * Verify per-file SHA-256 checksums after extraction.
 *
 * Every file listed in the manifest must exist in staging with
 * the expected checksum. Extra files are allowed (build artifacts).
 */
function verifyFileChecksums(
  stagingPath: string,
  checksums: Record<string, string>
): Result<true, string> {
  for (const [relativePath, expectedHash] of Object.entries(checksums)) {
    const filePath = path.join(stagingPath, relativePath);

    if (!fs.existsSync(filePath)) {
      return Result.err(`Missing file in update bundle: ${relativePath}`);
    }

    const data = fs.readFileSync(filePath);
    const actualHash = crypto.createHash('sha256').update(data).digest('hex');

    if (actualHash !== expectedHash) {
      return Result.err(
        `Checksum mismatch for ${relativePath}. Expected: ${expectedHash.slice(0, 16)}..., Got: ${actualHash.slice(0, 16)}...`
      );
    }
  }

  return Result.ok(true);
}

// ============================================================================
// SECTION 5: BACKUP + SWAP + ROLLBACK
// ============================================================================

/**
 * Create a full backup of the current installation.
 *
 * Uses recursive copy. The backup is kept until the update is verified
 * working, then cleaned up.
 */
function createBackup(installDir: string, backupPath: string): Result<true, string> {
  try {
    fs.cpSync(installDir, backupPath, { recursive: true });
    return Result.ok(true);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Failed to create backup: ${message}`);
  }
}

/**
 * Extract a tar.gz bundle to the staging directory.
 *
 * Uses the system `tar` command (available on macOS, Linux, and
 * Windows with Git Bash).
 */
function extractBundle(
  bundleFilePath: string,
  stagingPath: string
): Promise<Result<true, string>> {
  return new Promise((resolve) => {
    // Ensure staging dir exists
    fs.mkdirSync(stagingPath, { recursive: true });

    // The first 64 bytes are the signature — skip them
    // We need to extract from byte 65 onwards
    const data = fs.readFileSync(bundleFilePath);
    const contentOnly = data.subarray(64);
    const contentPath = bundleFilePath + '.content.tar.gz';
    fs.writeFileSync(contentPath, contentOnly);

    execFile(
      'tar',
      ['xzf', contentPath, '-C', stagingPath],
      { timeout: 60_000 },
      (err) => {
        cleanupFile(contentPath);
        if (err) {
          resolve(Result.err(`Failed to extract bundle: ${err.message}`));
        } else {
          resolve(Result.ok(true));
        }
      }
    );
  });
}

/**
 * Run pnpm install + build in the staging directory.
 */
function buildInStaging(stagingPath: string): Promise<Result<true, string>> {
  return new Promise((resolve) => {
    execFile(
      'pnpm',
      ['install', '--prod'],
      { cwd: stagingPath, timeout: 120_000 },
      (installErr) => {
        if (installErr) {
          resolve(Result.err(`pnpm install failed in staging: ${installErr.message}`));
          return;
        }

        execFile(
          'pnpm',
          ['run', 'build'],
          { cwd: stagingPath, timeout: 120_000 },
          (buildErr) => {
            if (buildErr) {
              resolve(Result.err(`pnpm run build failed in staging: ${buildErr.message}`));
            } else {
              resolve(Result.ok(true));
            }
          }
        );
      }
    );
  });
}

/**
 * Atomic swap: rename current → old-{version}, staging → current.
 *
 * fs.renameSync is atomic on the same filesystem, so we either
 * get the complete new version or the complete old version.
 *
 * Note: This only works when installDir and staging are on the
 * same filesystem (they should be, since both are under workspace/).
 */
function atomicSwap(
  installDir: string,
  stagingPath: string,
  oldBackupPath: string
): Result<true, string> {
  const tempOldPath = installDir + '.old-swap';

  try {
    // Move current → temp (atomic)
    fs.renameSync(installDir, tempOldPath);

    try {
      // Move staging → current (atomic)
      fs.renameSync(stagingPath, installDir);
    } catch (err: unknown) {
      // Staging → current failed: restore original
      fs.renameSync(tempOldPath, installDir);
      const message = err instanceof Error ? err.message : String(err);
      return Result.err(`Swap failed (staging → current): ${message}. Original restored.`);
    }

    // Clean up the temp old directory
    fs.rmSync(tempOldPath, { recursive: true, force: true });

    return Result.ok(true);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.err(`Swap failed (current → temp): ${message}`);
  }
}

/**
 * Rollback: restore from backup.
 *
 * Also expires the update token so the daemon resumes monitoring
 * with the original file hashes.
 */
async function rollback(
  installDir: string,
  backupPath: string,
  bridge: UpdateBridge,
  updateToken: string | null
): Promise<void> {
  // Expire token first so daemon can monitor the restoration
  if (updateToken) {
    await expireToken(bridge, updateToken).catch(() => {});
  }

  try {
    if (fs.existsSync(backupPath)) {
      // Remove current (might be partially updated)
      if (fs.existsSync(installDir)) {
        fs.rmSync(installDir, { recursive: true, force: true });
      }
      // Restore backup
      fs.cpSync(backupPath, installDir, { recursive: true });
    }
  } catch {
    // Rollback failed — system may be in inconsistent state
    // This is the worst case; user will need manual intervention
  }
}

// ============================================================================
// SECTION 6: TOKEN MANAGEMENT
// ============================================================================

/**
 * Expire the update token, returning the daemon to full monitoring.
 */
async function expireToken(bridge: UpdateBridge, token: string): Promise<void> {
  await bridge.exitDaemonUpdateMode(token).catch(() => {});
}

// ============================================================================
// SECTION 7: CLEANUP HELPERS
// ============================================================================

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Best-effort cleanup
  }
}

function cleanupDir(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
    // Best-effort cleanup
  }
}

// ============================================================================
// SECTION 8: RESULT HELPERS
// ============================================================================

function failure(from: string, to: string, message: string): UpdateResult {
  return {
    success: false,
    fromVersion: from,
    toVersion: to,
    message: `Update to v${to} failed: ${message}`,
    rolledBack: false,
  };
}

function failureRolledBack(from: string, to: string, message: string): UpdateResult {
  return {
    success: false,
    fromVersion: from,
    toVersion: to,
    message: `Update to v${to} failed: ${message}. Rolled back to v${from}.`,
    rolledBack: true,
  };
}
