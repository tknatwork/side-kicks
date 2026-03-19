/**
 * @dsb/guardrails — Sandbox enforcement, path validation, and safety for DSB.
 *
 * This is the foundation package. Every other DSB package depends on it.
 * All file I/O must go through these guardrails.
 *
 * @packageDocumentation
 */

// Result type — the universal error handling pattern
export { Result } from './result';
export type { Success, Failure } from './result';

// Constants — sandbox configuration
export {
  DSB_ROOT,
  resolveDsbRoot,
  READ_ALLOWED_ROOTS,
  WRITE_ALLOWED_ROOTS,
  ALLOWED_EXTENSIONS,
  BLOCKED_EXTENSIONS,
  SECRET_PATTERNS,
  MAX_FILE_SIZE,
  MAX_CONTEXT_SIZE,
  MAX_WORKSPACE_SIZE,
  ALLOWED_HOSTS,
  DEFAULT_PLUGIN_PORT,
  DEFAULT_ORCHESTRATION_PORT,
  IS_DEVELOPMENT,
  LICENSE_BYPASS,
  INTEGRITY_BYPASS,
} from './constants';

// Path validation
export { validatePath, validateDeletePath } from './path-validator';
export type { FileOperation, PathValidationResult } from './path-validator';

// File policy
export { checkFilePolicy, checkDirectorySize } from './file-policy';
export type { FilePolicyVerdict, FilePolicyResult } from './file-policy';

// Operation guard — the primary approval gate
export { guardOperation, guardRead, guardWrite } from './operation-guard';
export type { OperationApproval, GuardOptions } from './operation-guard';

// Audit logging
export { auditLog, readAuditLog, getAuditLogPath } from './audit-log';
export type { AuditAction, AuditEntry } from './audit-log';

// Rollback / snapshots
export { createSnapshot, loadSnapshot, listSnapshots, cleanupOldSnapshots } from './rollback';
export type { RollbackSnapshot, RollbackManifest } from './rollback';

// Safe file operations — convenience wrappers
export {
  safeReadFile,
  safeReadJson,
  safeWriteFile,
  safeWriteJson,
  safeExists,
  safeListDir,
  safeDelete,
} from './sandbox';

// Crypto — encryption, hashing, key derivation
export { deriveKey, encrypt, decrypt, sha256, sha256File, hmacSha256 } from './crypto';
export type { EncryptedPayload } from './crypto';

// Machine fingerprint
export { getMachineFingerprint } from './machine-fingerprint';

// Integrity verification
export { generateManifest, verifyIntegrity, verifyRandomSubset } from './integrity';
export type { IntegrityManifest, IntegrityStatus, IntegrityCheckResult } from './integrity';

// Tamper response
export {
  evaluateTamperLevel,
  recordTamperEvent,
  checkAutoEscalation,
  isLockedOut,
  getCurrentTamperLevel,
  executeScramble,
} from './tamper-response';
export type { TamperLevel, TamperEvent, TamperState } from './tamper-response';

// Copy detection
export {
  registerInstallPath,
  checkPathMismatch,
  checkCloudSync,
  checkGitRepo,
  acquireInstanceLock,
  releaseInstanceLock,
  runAllCopyDetectionChecks,
} from './copy-detector';
export type { CopyDetectionReason, CopyDetectionResult } from './copy-detector';

// Nuclear wipe
export { executeNuclearWipe } from './nuclear-wipe';
export type { WipeLogEntry } from './nuclear-wipe';
