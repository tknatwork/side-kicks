"use strict";
/**
 * Machine Fingerprint — Cross-platform machine identification.
 *
 * Generates a deterministic fingerprint for the current machine.
 * Used for license binding (one license = one machine).
 *
 * Platform-specific:
 *   macOS:   IOPlatformSerialNumber + username
 *   Windows: MachineGuid from registry + username
 *   Linux:   /etc/machine-id + username
 *
 * @module machine-fingerprint
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
exports.getMachineFingerprint = getMachineFingerprint;
const os = __importStar(require("node:os"));
const fs = __importStar(require("node:fs"));
const crypto = __importStar(require("node:crypto"));
const node_child_process_1 = require("node:child_process");
const result_1 = require("./result");
// ============================================================================
// SECTION 1: PUBLIC API
// ============================================================================
/**
 * Generate a deterministic machine fingerprint.
 *
 * @returns SHA-256 hash of platform ID + username.
 */
function getMachineFingerprint() {
    const platformIdResult = getPlatformId();
    if (!platformIdResult.ok)
        return platformIdResult;
    const username = os.userInfo().username;
    const combined = `${platformIdResult.value}:${username}`;
    const fingerprint = crypto.createHash('sha256').update(combined).digest('hex');
    return result_1.Result.ok(fingerprint);
}
// ============================================================================
// SECTION 2: PLATFORM-SPECIFIC ID RETRIEVAL
// ============================================================================
function getPlatformId() {
    const platform = os.platform();
    switch (platform) {
        case 'darwin':
            return getMacOsId();
        case 'win32':
            return getWindowsId();
        case 'linux':
            return getLinuxId();
        default:
            return result_1.Result.err(`Unsupported platform: ${platform}. DSB supports macOS, Windows, and Linux.`);
    }
}
/**
 * macOS: Read IOPlatformSerialNumber via ioreg.
 * Uses execFileSync (no shell) to avoid injection risks.
 */
function getMacOsId() {
    try {
        // ioreg with fixed arguments — no user input, safe to exec
        const output = (0, node_child_process_1.execFileSync)('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], {
            encoding: 'utf-8',
            timeout: 5000,
        });
        const match = output.match(/"IOPlatformSerialNumber"\s*=\s*"([^"]+)"/);
        if (match && match[1]) {
            return result_1.Result.ok(match[1]);
        }
        // Fallback: hardware UUID via system_profiler
        const uuidOutput = (0, node_child_process_1.execFileSync)('system_profiler', ['SPHardwareDataType'], {
            encoding: 'utf-8',
            timeout: 5000,
        });
        const uuidMatch = uuidOutput.match(/Hardware UUID:\s*(.+)/);
        if (uuidMatch && uuidMatch[1]) {
            return result_1.Result.ok(uuidMatch[1].trim());
        }
        return result_1.Result.err('Could not determine macOS machine ID. Please contact support.');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to read macOS machine ID: ${message}`);
    }
}
/**
 * Windows: Read MachineGuid from registry.
 * Uses execFileSync (no shell) to avoid injection risks.
 */
function getWindowsId() {
    try {
        const output = (0, node_child_process_1.execFileSync)('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf-8', timeout: 5000 });
        const match = output.match(/MachineGuid\s+REG_SZ\s+(.+)/);
        if (match && match[1]) {
            return result_1.Result.ok(match[1].trim());
        }
        return result_1.Result.err('Could not read Windows MachineGuid from registry.');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to read Windows machine ID: ${message}`);
    }
}
/**
 * Linux: Read /etc/machine-id.
 * Pure file read — no process execution needed.
 */
function getLinuxId() {
    try {
        // Primary: /etc/machine-id (systemd)
        if (fs.existsSync('/etc/machine-id')) {
            const id = fs.readFileSync('/etc/machine-id', 'utf-8').trim();
            if (id.length > 0)
                return result_1.Result.ok(id);
        }
        // Fallback: /var/lib/dbus/machine-id
        if (fs.existsSync('/var/lib/dbus/machine-id')) {
            const id = fs.readFileSync('/var/lib/dbus/machine-id', 'utf-8').trim();
            if (id.length > 0)
                return result_1.Result.ok(id);
        }
        return result_1.Result.err('Could not find /etc/machine-id or /var/lib/dbus/machine-id.');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return result_1.Result.err(`Failed to read Linux machine ID: ${message}`);
    }
}
