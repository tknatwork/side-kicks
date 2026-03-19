"use strict";
/**
 * Integrity Verification — File hash manifest and tamper detection.
 *
 * At build time, a manifest of SHA-256 hashes is generated and HMAC-signed.
 * At runtime, the toolkit verifies its own files against this manifest.
 *
 * @module integrity
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
exports.generateManifest = generateManifest;
exports.verifyIntegrity = verifyIntegrity;
exports.verifyRandomSubset = verifyRandomSubset;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const result_1 = require("./result");
const crypto_1 = require("./crypto");
const constants_1 = require("./constants");
// ============================================================================
// SECTION 2: MANIFEST OPERATIONS
// ============================================================================
const MANIFEST_PATH = path.resolve(constants_1.DSB_ROOT, 'packages', 'guardrails', 'dist', 'integrity-manifest.json');
/**
 * Generate an integrity manifest for all critical files.
 * Called at build/packaging time only.
 *
 * @param signingSecret - The secret used to sign the manifest (never shipped).
 * @param buildVersion - The build version string.
 * @returns The generated manifest.
 */
function generateManifest(signingSecret, buildVersion) {
    const criticalPaths = getCriticalFilePaths();
    const files = {};
    for (const relativePath of criticalPaths) {
        const absolutePath = path.resolve(constants_1.DSB_ROOT, relativePath);
        const hashResult = (0, crypto_1.sha256File)(absolutePath);
        if (!hashResult.ok) {
            // Skip files that don't exist (not yet built)
            continue;
        }
        files[relativePath] = hashResult.value;
    }
    if (Object.keys(files).length === 0) {
        return result_1.Result.err('No critical files found to hash. Has the project been built?');
    }
    // Sign the files map
    const filesJson = JSON.stringify(files, Object.keys(files).sort());
    const signature = (0, crypto_1.hmacSha256)(filesJson, signingSecret);
    const manifest = {
        files,
        signature,
        buildVersion,
        generatedAt: new Date().toISOString(),
    };
    return result_1.Result.ok(manifest);
}
/**
 * Verify the integrity of the toolkit against the manifest.
 *
 * @returns Check result with lists of modified, missing, and added files.
 */
function verifyIntegrity() {
    if (constants_1.INTEGRITY_BYPASS) {
        return {
            status: 'bypassed',
            modifiedFiles: [],
            missingFiles: [],
            addedFiles: [],
        };
    }
    // Load manifest
    if (!fs.existsSync(MANIFEST_PATH)) {
        return {
            status: 'missing_manifest',
            modifiedFiles: [],
            missingFiles: [],
            addedFiles: [],
        };
    }
    let manifest;
    try {
        const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
        manifest = JSON.parse(content);
    }
    catch (_a) {
        return {
            status: 'tampered',
            modifiedFiles: ['integrity-manifest.json'],
            missingFiles: [],
            addedFiles: [],
        };
    }
    // Verify each file
    const modifiedFiles = [];
    const missingFiles = [];
    for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
        const absolutePath = path.resolve(constants_1.DSB_ROOT, relativePath);
        const hashResult = (0, crypto_1.sha256File)(absolutePath);
        if (!hashResult.ok) {
            missingFiles.push(relativePath);
            continue;
        }
        if (hashResult.value !== expectedHash) {
            modifiedFiles.push(relativePath);
        }
    }
    const isTampered = modifiedFiles.length > 0 || missingFiles.length > 0;
    return {
        status: isTampered ? 'tampered' : 'valid',
        modifiedFiles,
        missingFiles,
        addedFiles: [], // We don't track additions for now
    };
}
/**
 * Verify a random subset of files (used for heartbeat checks).
 *
 * @param count - Number of files to randomly check.
 * @returns Whether all checked files are intact.
 */
function verifyRandomSubset(count = 5) {
    if (constants_1.INTEGRITY_BYPASS) {
        return { status: 'bypassed', modifiedFiles: [], missingFiles: [], addedFiles: [] };
    }
    if (!fs.existsSync(MANIFEST_PATH)) {
        return { status: 'missing_manifest', modifiedFiles: [], missingFiles: [], addedFiles: [] };
    }
    let manifest;
    try {
        const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
        manifest = JSON.parse(content);
    }
    catch (_a) {
        return { status: 'tampered', modifiedFiles: ['integrity-manifest.json'], missingFiles: [], addedFiles: [] };
    }
    const allFiles = Object.entries(manifest.files);
    const selected = selectRandom(allFiles, Math.min(count, allFiles.length));
    const modifiedFiles = [];
    const missingFiles = [];
    for (const [relativePath, expectedHash] of selected) {
        const absolutePath = path.resolve(constants_1.DSB_ROOT, relativePath);
        const hashResult = (0, crypto_1.sha256File)(absolutePath);
        if (!hashResult.ok) {
            missingFiles.push(relativePath);
            continue;
        }
        if (hashResult.value !== expectedHash) {
            modifiedFiles.push(relativePath);
        }
    }
    const isTampered = modifiedFiles.length > 0 || missingFiles.length > 0;
    return { status: isTampered ? 'tampered' : 'valid', modifiedFiles, missingFiles, addedFiles: [] };
}
// ============================================================================
// SECTION 3: CRITICAL FILE PATHS
// ============================================================================
/**
 * Returns the list of critical file paths to include in the integrity manifest.
 * These are relative to DSB_ROOT.
 */
function getCriticalFilePaths() {
    // This list is populated at build time by scanning the dist/ directories
    // For now, return the known critical paths
    return [
        'packages/core/dist/index.js',
        'packages/mcp-server/dist/index.js',
        'packages/orchestration-server/dist/index.js',
        'packages/builder-plugin/code.js',
        'packages/style-generator-plugin/code.js',
        'packages/guardrails/dist/index.js',
        'packages/licensing/dist/index.js',
        '.claude/CLAUDE.md',
    ];
}
// ============================================================================
// SECTION 4: HELPERS
// ============================================================================
function selectRandom(array, count) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
}
