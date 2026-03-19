"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInstallPath = registerInstallPath;
exports.checkPathMismatch = checkPathMismatch;
exports.checkCloudSync = checkCloudSync;
exports.checkGitRepo = checkGitRepo;
exports.acquireInstanceLock = acquireInstanceLock;
exports.releaseInstanceLock = releaseInstanceLock;
exports.runAllCopyDetectionChecks = runAllCopyDetectionChecks;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const result_1 = require("./result");
const constants_1 = require("./constants");
const crypto_1 = require("./crypto");
// ============================================================================
// SECTION 2: INSTALLATION PATH TRACKING
// ============================================================================
const INSTALL_PATH_FILE = path.resolve(os.homedir(), '.dsb', 'install-path.json');
const LOCK_FILE = path.resolve(os.homedir(), '.dsb', 'dsb.lock');
/**
 * Register the current installation path.
 * Called during setup/activation.
 */
function registerInstallPath() {
    const data = {
        path: constants_1.DSB_ROOT,
        hash: (0, crypto_1.sha256)(constants_1.DSB_ROOT),
        registeredAt: new Date().toISOString(),
    };
    try {
        const dir = path.dirname(INSTALL_PATH_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(INSTALL_PATH_FILE, JSON.stringify(data, null, 2), 'utf-8');
        return result_1.Result.ok(constants_1.DSB_ROOT);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to register install path: ${message}`);
    }
}
/**
 * Check if the current path matches the registered installation path.
 */
function checkPathMismatch() {
    if (constants_1.IS_DEVELOPMENT)
        return { detected: false };
    try {
        if (!fs.existsSync(INSTALL_PATH_FILE)) {
            // First run — no registered path yet
            return { detected: false };
        }
        const content = fs.readFileSync(INSTALL_PATH_FILE, 'utf-8');
        const data = JSON.parse(content);
        const currentHash = (0, crypto_1.sha256)(constants_1.DSB_ROOT);
        if (data.hash !== currentHash) {
            return {
                detected: true,
                reason: 'path_mismatch',
                details: `Registered: ${data.path}, Current: ${constants_1.DSB_ROOT}`,
            };
        }
        return { detected: false };
    }
    catch (_a) {
        return { detected: false }; // Parse error — not a copy signal
    }
}
// ============================================================================
// SECTION 3: CLOUD SYNC DETECTION
// ============================================================================
/** Known cloud sync directory names. */
const CLOUD_SYNC_DIRS = [
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
function checkCloudSync() {
    if (constants_1.IS_DEVELOPMENT)
        return { detected: false };
    const normalizedRoot = constants_1.DSB_ROOT.toLowerCase();
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
        if (constants_1.DSB_ROOT.startsWith(cloudPath)) {
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
function checkGitRepo() {
    if (constants_1.IS_DEVELOPMENT)
        return { detected: false };
    // Walk up from DSB_ROOT looking for .git directories
    let current = constants_1.DSB_ROOT;
    const root = path.parse(current).root;
    while (current !== root) {
        const gitDir = path.join(current, '.git');
        if (fs.existsSync(gitDir)) {
            // Found a .git directory — is it DSB's own?
            if (current === constants_1.DSB_ROOT) {
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
function acquireInstanceLock() {
    if (constants_1.IS_DEVELOPMENT)
        return result_1.Result.ok(true);
    try {
        const dir = path.dirname(LOCK_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Check existing lock
        if (fs.existsSync(LOCK_FILE)) {
            const content = fs.readFileSync(LOCK_FILE, 'utf-8');
            const lockData = JSON.parse(content);
            // Check if the locking process is still alive
            try {
                process.kill(lockData.pid, 0); // Signal 0 = check if process exists
                // Process is alive — check if it's from a different path
                if (lockData.path !== constants_1.DSB_ROOT) {
                    return result_1.Result.ok(false); // Parallel instance from different location
                }
                // Same path, different PID — previous instance didn't clean up
            }
            catch (_a) {
                // Process is dead — stale lock, safe to overwrite
            }
        }
        // Write our lock
        const lockData = {
            pid: process.pid,
            path: constants_1.DSB_ROOT,
            timestamp: new Date().toISOString(),
        };
        fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2), 'utf-8');
        return result_1.Result.ok(true);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to acquire instance lock: ${message}`);
    }
}
/**
 * Release the instance lock.
 */
function releaseInstanceLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            fs.unlinkSync(LOCK_FILE);
        }
    }
    catch (_a) {
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
function runAllCopyDetectionChecks() {
    if (constants_1.IS_DEVELOPMENT)
        return { detected: false };
    // Check path mismatch
    const pathCheck = checkPathMismatch();
    if (pathCheck.detected)
        return pathCheck;
    // Check cloud sync
    const cloudCheck = checkCloudSync();
    if (cloudCheck.detected)
        return cloudCheck;
    // Check git repo
    const gitCheck = checkGitRepo();
    if (gitCheck.detected)
        return gitCheck;
    return { detected: false };
}
