"use strict";
/**
 * @dsb/guardrails — Sandbox enforcement, path validation, and safety for DSB.
 *
 * This is the foundation package. Every other DSB package depends on it.
 * All file I/O must go through these guardrails.
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordTamperEvent = exports.evaluateTamperLevel = exports.verifyRandomSubset = exports.verifyIntegrity = exports.generateManifest = exports.getMachineFingerprint = exports.hmacSha256 = exports.sha256File = exports.sha256 = exports.decrypt = exports.encrypt = exports.deriveKey = exports.safeDelete = exports.safeListDir = exports.safeExists = exports.safeWriteJson = exports.safeWriteFile = exports.safeReadJson = exports.safeReadFile = exports.cleanupOldSnapshots = exports.listSnapshots = exports.loadSnapshot = exports.createSnapshot = exports.getAuditLogPath = exports.readAuditLog = exports.auditLog = exports.guardWrite = exports.guardRead = exports.guardOperation = exports.checkDirectorySize = exports.checkFilePolicy = exports.validateDeletePath = exports.validatePath = exports.INTEGRITY_BYPASS = exports.LICENSE_BYPASS = exports.IS_DEVELOPMENT = exports.DEFAULT_ORCHESTRATION_PORT = exports.DEFAULT_PLUGIN_PORT = exports.ALLOWED_HOSTS = exports.MAX_WORKSPACE_SIZE = exports.MAX_CONTEXT_SIZE = exports.MAX_FILE_SIZE = exports.SECRET_PATTERNS = exports.BLOCKED_EXTENSIONS = exports.ALLOWED_EXTENSIONS = exports.WRITE_ALLOWED_ROOTS = exports.READ_ALLOWED_ROOTS = exports.resolveDsbRoot = exports.DSB_ROOT = exports.Result = void 0;
exports.executeNuclearWipe = exports.runAllCopyDetectionChecks = exports.releaseInstanceLock = exports.acquireInstanceLock = exports.checkGitRepo = exports.checkCloudSync = exports.checkPathMismatch = exports.registerInstallPath = exports.executeScramble = exports.getCurrentTamperLevel = exports.isLockedOut = exports.checkAutoEscalation = void 0;
// Result type — the universal error handling pattern
var result_1 = require("./result");
Object.defineProperty(exports, "Result", { enumerable: true, get: function () { return result_1.Result; } });
// Constants — sandbox configuration
var constants_1 = require("./constants");
Object.defineProperty(exports, "DSB_ROOT", { enumerable: true, get: function () { return constants_1.DSB_ROOT; } });
Object.defineProperty(exports, "resolveDsbRoot", { enumerable: true, get: function () { return constants_1.resolveDsbRoot; } });
Object.defineProperty(exports, "READ_ALLOWED_ROOTS", { enumerable: true, get: function () { return constants_1.READ_ALLOWED_ROOTS; } });
Object.defineProperty(exports, "WRITE_ALLOWED_ROOTS", { enumerable: true, get: function () { return constants_1.WRITE_ALLOWED_ROOTS; } });
Object.defineProperty(exports, "ALLOWED_EXTENSIONS", { enumerable: true, get: function () { return constants_1.ALLOWED_EXTENSIONS; } });
Object.defineProperty(exports, "BLOCKED_EXTENSIONS", { enumerable: true, get: function () { return constants_1.BLOCKED_EXTENSIONS; } });
Object.defineProperty(exports, "SECRET_PATTERNS", { enumerable: true, get: function () { return constants_1.SECRET_PATTERNS; } });
Object.defineProperty(exports, "MAX_FILE_SIZE", { enumerable: true, get: function () { return constants_1.MAX_FILE_SIZE; } });
Object.defineProperty(exports, "MAX_CONTEXT_SIZE", { enumerable: true, get: function () { return constants_1.MAX_CONTEXT_SIZE; } });
Object.defineProperty(exports, "MAX_WORKSPACE_SIZE", { enumerable: true, get: function () { return constants_1.MAX_WORKSPACE_SIZE; } });
Object.defineProperty(exports, "ALLOWED_HOSTS", { enumerable: true, get: function () { return constants_1.ALLOWED_HOSTS; } });
Object.defineProperty(exports, "DEFAULT_PLUGIN_PORT", { enumerable: true, get: function () { return constants_1.DEFAULT_PLUGIN_PORT; } });
Object.defineProperty(exports, "DEFAULT_ORCHESTRATION_PORT", { enumerable: true, get: function () { return constants_1.DEFAULT_ORCHESTRATION_PORT; } });
Object.defineProperty(exports, "IS_DEVELOPMENT", { enumerable: true, get: function () { return constants_1.IS_DEVELOPMENT; } });
Object.defineProperty(exports, "LICENSE_BYPASS", { enumerable: true, get: function () { return constants_1.LICENSE_BYPASS; } });
Object.defineProperty(exports, "INTEGRITY_BYPASS", { enumerable: true, get: function () { return constants_1.INTEGRITY_BYPASS; } });
// Path validation
var path_validator_1 = require("./path-validator");
Object.defineProperty(exports, "validatePath", { enumerable: true, get: function () { return path_validator_1.validatePath; } });
Object.defineProperty(exports, "validateDeletePath", { enumerable: true, get: function () { return path_validator_1.validateDeletePath; } });
// File policy
var file_policy_1 = require("./file-policy");
Object.defineProperty(exports, "checkFilePolicy", { enumerable: true, get: function () { return file_policy_1.checkFilePolicy; } });
Object.defineProperty(exports, "checkDirectorySize", { enumerable: true, get: function () { return file_policy_1.checkDirectorySize; } });
// Operation guard — the primary approval gate
var operation_guard_1 = require("./operation-guard");
Object.defineProperty(exports, "guardOperation", { enumerable: true, get: function () { return operation_guard_1.guardOperation; } });
Object.defineProperty(exports, "guardRead", { enumerable: true, get: function () { return operation_guard_1.guardRead; } });
Object.defineProperty(exports, "guardWrite", { enumerable: true, get: function () { return operation_guard_1.guardWrite; } });
// Audit logging
var audit_log_1 = require("./audit-log");
Object.defineProperty(exports, "auditLog", { enumerable: true, get: function () { return audit_log_1.auditLog; } });
Object.defineProperty(exports, "readAuditLog", { enumerable: true, get: function () { return audit_log_1.readAuditLog; } });
Object.defineProperty(exports, "getAuditLogPath", { enumerable: true, get: function () { return audit_log_1.getAuditLogPath; } });
// Rollback / snapshots
var rollback_1 = require("./rollback");
Object.defineProperty(exports, "createSnapshot", { enumerable: true, get: function () { return rollback_1.createSnapshot; } });
Object.defineProperty(exports, "loadSnapshot", { enumerable: true, get: function () { return rollback_1.loadSnapshot; } });
Object.defineProperty(exports, "listSnapshots", { enumerable: true, get: function () { return rollback_1.listSnapshots; } });
Object.defineProperty(exports, "cleanupOldSnapshots", { enumerable: true, get: function () { return rollback_1.cleanupOldSnapshots; } });
// Safe file operations — convenience wrappers
var sandbox_1 = require("./sandbox");
Object.defineProperty(exports, "safeReadFile", { enumerable: true, get: function () { return sandbox_1.safeReadFile; } });
Object.defineProperty(exports, "safeReadJson", { enumerable: true, get: function () { return sandbox_1.safeReadJson; } });
Object.defineProperty(exports, "safeWriteFile", { enumerable: true, get: function () { return sandbox_1.safeWriteFile; } });
Object.defineProperty(exports, "safeWriteJson", { enumerable: true, get: function () { return sandbox_1.safeWriteJson; } });
Object.defineProperty(exports, "safeExists", { enumerable: true, get: function () { return sandbox_1.safeExists; } });
Object.defineProperty(exports, "safeListDir", { enumerable: true, get: function () { return sandbox_1.safeListDir; } });
Object.defineProperty(exports, "safeDelete", { enumerable: true, get: function () { return sandbox_1.safeDelete; } });
// Crypto — encryption, hashing, key derivation
var crypto_1 = require("./crypto");
Object.defineProperty(exports, "deriveKey", { enumerable: true, get: function () { return crypto_1.deriveKey; } });
Object.defineProperty(exports, "encrypt", { enumerable: true, get: function () { return crypto_1.encrypt; } });
Object.defineProperty(exports, "decrypt", { enumerable: true, get: function () { return crypto_1.decrypt; } });
Object.defineProperty(exports, "sha256", { enumerable: true, get: function () { return crypto_1.sha256; } });
Object.defineProperty(exports, "sha256File", { enumerable: true, get: function () { return crypto_1.sha256File; } });
Object.defineProperty(exports, "hmacSha256", { enumerable: true, get: function () { return crypto_1.hmacSha256; } });
// Machine fingerprint
var machine_fingerprint_1 = require("./machine-fingerprint");
Object.defineProperty(exports, "getMachineFingerprint", { enumerable: true, get: function () { return machine_fingerprint_1.getMachineFingerprint; } });
// Integrity verification
var integrity_1 = require("./integrity");
Object.defineProperty(exports, "generateManifest", { enumerable: true, get: function () { return integrity_1.generateManifest; } });
Object.defineProperty(exports, "verifyIntegrity", { enumerable: true, get: function () { return integrity_1.verifyIntegrity; } });
Object.defineProperty(exports, "verifyRandomSubset", { enumerable: true, get: function () { return integrity_1.verifyRandomSubset; } });
// Tamper response
var tamper_response_1 = require("./tamper-response");
Object.defineProperty(exports, "evaluateTamperLevel", { enumerable: true, get: function () { return tamper_response_1.evaluateTamperLevel; } });
Object.defineProperty(exports, "recordTamperEvent", { enumerable: true, get: function () { return tamper_response_1.recordTamperEvent; } });
Object.defineProperty(exports, "checkAutoEscalation", { enumerable: true, get: function () { return tamper_response_1.checkAutoEscalation; } });
Object.defineProperty(exports, "isLockedOut", { enumerable: true, get: function () { return tamper_response_1.isLockedOut; } });
Object.defineProperty(exports, "getCurrentTamperLevel", { enumerable: true, get: function () { return tamper_response_1.getCurrentTamperLevel; } });
Object.defineProperty(exports, "executeScramble", { enumerable: true, get: function () { return tamper_response_1.executeScramble; } });
// Copy detection
var copy_detector_1 = require("./copy-detector");
Object.defineProperty(exports, "registerInstallPath", { enumerable: true, get: function () { return copy_detector_1.registerInstallPath; } });
Object.defineProperty(exports, "checkPathMismatch", { enumerable: true, get: function () { return copy_detector_1.checkPathMismatch; } });
Object.defineProperty(exports, "checkCloudSync", { enumerable: true, get: function () { return copy_detector_1.checkCloudSync; } });
Object.defineProperty(exports, "checkGitRepo", { enumerable: true, get: function () { return copy_detector_1.checkGitRepo; } });
Object.defineProperty(exports, "acquireInstanceLock", { enumerable: true, get: function () { return copy_detector_1.acquireInstanceLock; } });
Object.defineProperty(exports, "releaseInstanceLock", { enumerable: true, get: function () { return copy_detector_1.releaseInstanceLock; } });
Object.defineProperty(exports, "runAllCopyDetectionChecks", { enumerable: true, get: function () { return copy_detector_1.runAllCopyDetectionChecks; } });
// Nuclear wipe
var nuclear_wipe_1 = require("./nuclear-wipe");
Object.defineProperty(exports, "executeNuclearWipe", { enumerable: true, get: function () { return nuclear_wipe_1.executeNuclearWipe; } });
