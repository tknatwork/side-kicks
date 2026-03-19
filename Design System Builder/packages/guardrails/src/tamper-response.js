"use strict";
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
exports.evaluateTamperLevel = evaluateTamperLevel;
exports.recordTamperEvent = recordTamperEvent;
exports.checkAutoEscalation = checkAutoEscalation;
exports.isLockedOut = isLockedOut;
exports.getCurrentTamperLevel = getCurrentTamperLevel;
exports.executeScramble = executeScramble;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const constants_1 = require("./constants");
const audit_log_1 = require("./audit-log");
// ============================================================================
// SECTION 2: TAMPER DETECTION
// ============================================================================
const TAMPER_STATE_PATH = path.resolve(constants_1.DSB_ROOT, '.dsb', 'tamper-state.json');
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
/**
 * Evaluate an integrity check result and determine the appropriate tamper level.
 *
 * @param checkResult - The result from verifyIntegrity().
 * @returns The tamper level to apply, or null if no tampering detected.
 */
function evaluateTamperLevel(checkResult) {
    if (constants_1.IS_DEVELOPMENT)
        return null;
    if (checkResult.status === 'valid' || checkResult.status === 'bypassed')
        return null;
    const modified = checkResult.modifiedFiles;
    const missing = checkResult.missingFiles;
    // Check for manifest tampering → Level 3 immediately
    if (modified.includes('integrity-manifest.json')) {
        return 3;
    }
    // Check for license code tampering → Level 3 immediately
    const licenseFiles = modified.filter(f => f.includes('licensing/') || f.includes('guardrails/'));
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
function recordTamperEvent(level, reason, modifiedFiles) {
    const event = {
        level,
        timestamp: new Date().toISOString(),
        reason,
        modifiedFiles,
    };
    const currentState = loadTamperState();
    const events = currentState ? [...currentState.events, event] : [event];
    const newState = {
        events,
        currentLevel: level,
        lockedOut: level >= 2,
        lastEventAt: event.timestamp,
    };
    saveTamperState(newState);
    (0, audit_log_1.auditLog)('DENIED', 'TAMPER_DETECTED', 'DENIED', `Level ${level}: ${reason}`);
    return newState;
}
/**
 * Check if the system should auto-escalate (24h after Level 1 → Level 2).
 */
function checkAutoEscalation() {
    if (constants_1.IS_DEVELOPMENT)
        return null;
    const state = loadTamperState();
    if (!state)
        return null;
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
function isLockedOut() {
    if (constants_1.IS_DEVELOPMENT)
        return false;
    const state = loadTamperState();
    return (state === null || state === void 0 ? void 0 : state.lockedOut) === true;
}
/**
 * Get the current tamper level.
 */
function getCurrentTamperLevel() {
    var _a;
    const state = loadTamperState();
    return (_a = state === null || state === void 0 ? void 0 : state.currentLevel) !== null && _a !== void 0 ? _a : null;
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
function executeScramble() {
    if (constants_1.IS_DEVELOPMENT)
        return;
    const filesToScramble = [
        '.claude/CLAUDE.md',
        // Agent prompts would be listed here when they exist
    ];
    for (const relativePath of filesToScramble) {
        const absolutePath = path.resolve(constants_1.DSB_ROOT, relativePath);
        try {
            if (fs.existsSync(absolutePath)) {
                fs.writeFileSync(absolutePath, SCRAMBLE_PLACEHOLDER, 'utf-8');
            }
        }
        catch (_a) {
            // Continue scrambling even if one file fails
        }
    }
    // Clear cached context
    const dsbDir = path.resolve(constants_1.DSB_ROOT, '.dsb');
    if (fs.existsSync(dsbDir)) {
        try {
            clearDirectory(dsbDir, ['tamper-state.json']); // Keep tamper state as evidence
        }
        catch (_b) {
            // Non-fatal
        }
    }
    (0, audit_log_1.auditLog)('DENIED', 'SCRAMBLE_EXECUTED', 'DENIED', 'Level 3 tamper response executed');
}
// ============================================================================
// SECTION 4: PERSISTENCE
// ============================================================================
function loadTamperState() {
    try {
        if (!fs.existsSync(TAMPER_STATE_PATH))
            return null;
        const content = fs.readFileSync(TAMPER_STATE_PATH, 'utf-8');
        return JSON.parse(content);
    }
    catch (_a) {
        return null;
    }
}
function saveTamperState(state) {
    try {
        const dir = path.dirname(TAMPER_STATE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(TAMPER_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    }
    catch (_a) {
        // Non-fatal — tamper state persistence is best-effort
    }
}
// ============================================================================
// SECTION 5: HELPERS
// ============================================================================
function clearDirectory(dirPath, preserve = []) {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
        if (preserve.includes(entry))
            continue;
        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        }
        else {
            fs.unlinkSync(fullPath);
        }
    }
}
