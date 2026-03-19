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
import { Result } from './result';
export type CopyDetectionReason = 'path_mismatch' | 'parallel_instance' | 'archive_detected' | 'cloud_sync_detected' | 'git_repo_detected';
export interface CopyDetectionResult {
    readonly detected: boolean;
    readonly reason?: CopyDetectionReason;
    readonly details?: string;
}
/**
 * Register the current installation path.
 * Called during setup/activation.
 */
export declare function registerInstallPath(): Result<string, string>;
/**
 * Check if the current path matches the registered installation path.
 */
export declare function checkPathMismatch(): CopyDetectionResult;
/**
 * Check if DSB is located inside a cloud-synced directory.
 */
export declare function checkCloudSync(): CopyDetectionResult;
/**
 * Check if DSB folder is inside a git repository that isn't its own dev repo.
 */
export declare function checkGitRepo(): CopyDetectionResult;
/**
 * Acquire the instance lock. Returns false if another instance holds it.
 */
export declare function acquireInstanceLock(): Result<boolean, string>;
/**
 * Release the instance lock.
 */
export declare function releaseInstanceLock(): void;
/**
 * Run all copy detection checks.
 * Returns the first detected violation, or no detection.
 */
export declare function runAllCopyDetectionChecks(): CopyDetectionResult;
//# sourceMappingURL=copy-detector.d.ts.map