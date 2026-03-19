"use strict";
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
exports.executeNuclearWipe = executeNuclearWipe;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const constants_1 = require("./constants");
// ============================================================================
// SECTION 2: NUCLEAR WIPE EXECUTION
// ============================================================================
const WIPE_LOG_PATH = path.resolve(os.homedir(), '.dsb', 'wipe-log.json');
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
function executeNuclearWipe(reason, registeredPath, machineFingerprint) {
    // NEVER execute in development mode
    if (constants_1.IS_DEVELOPMENT) {
        console.warn('[DSB] Nuclear wipe requested but DEVELOPMENT_MODE is active — skipping.');
        return;
    }
    // Step 1: Log the wipe event BEFORE wiping (evidence persists outside DSB folder)
    logWipeEvent(reason, registeredPath, machineFingerprint);
    // Step 2: Identify what to preserve and what to destroy
    const preservePaths = new Set([
        path.resolve(constants_1.DSB_ROOT, 'workspace', 'context'),
        path.resolve(constants_1.DSB_ROOT, 'workspace', 'exports'),
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
        const absolutePath = path.resolve(constants_1.DSB_ROOT, relativePath);
        if (preservePaths.has(absolutePath))
            continue;
        safeRemoveDir(absolutePath);
    }
    // Step 4: Destroy root files
    for (const fileName of destroyFiles) {
        const absolutePath = path.resolve(constants_1.DSB_ROOT, fileName);
        safeRemoveFile(absolutePath);
    }
    // Step 5: Write the WIPED.md explanation file
    try {
        fs.writeFileSync(path.resolve(constants_1.DSB_ROOT, 'WIPED.md'), WIPED_MD_CONTENT, 'utf-8');
    }
    catch (_a) {
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
function logWipeEvent(reason, registeredPath, machineFingerprint) {
    const entry = {
        timestamp: new Date().toISOString(),
        reason,
        detectedPath: constants_1.DSB_ROOT,
        registeredPath,
        machineFingerprint,
    };
    try {
        const dir = path.dirname(WIPE_LOG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Append to existing log
        let existingEntries = [];
        if (fs.existsSync(WIPE_LOG_PATH)) {
            const content = fs.readFileSync(WIPE_LOG_PATH, 'utf-8');
            existingEntries = JSON.parse(content);
        }
        existingEntries.push(entry);
        fs.writeFileSync(WIPE_LOG_PATH, JSON.stringify(existingEntries, null, 2), 'utf-8');
    }
    catch (_a) {
        // If we can't log, proceed with the wipe anyway
    }
}
// ============================================================================
// SECTION 4: SAFE REMOVAL HELPERS
// ============================================================================
function safeRemoveDir(dirPath) {
    try {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }
    catch (_a) {
        // Continue with other deletions
    }
}
function safeRemoveFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    catch (_a) {
        // Continue with other deletions
    }
}
