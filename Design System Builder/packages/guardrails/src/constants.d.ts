/**
 * Guardrails constants — shared configuration for the sandbox system.
 *
 * @module constants
 */
/**
 * Resolve the DSB root directory.
 * In production: the Design System Builder installation folder.
 * Falls back to env var or cwd.
 */
export declare function resolveDsbRoot(): string;
export declare const DSB_ROOT: string;
/** Directories that can be read from. */
export declare const READ_ALLOWED_ROOTS: readonly string[];
/** Directories that can be written to. */
export declare const WRITE_ALLOWED_ROOTS: readonly string[];
/** File extensions allowed for context input (workspace/context/). */
export declare const ALLOWED_EXTENSIONS: ReadonlySet<string>;
/** File extensions that are always blocked — never processed. */
export declare const BLOCKED_EXTENSIONS: ReadonlySet<string>;
/** Patterns in filenames that indicate secrets — always blocked. */
export declare const SECRET_PATTERNS: readonly RegExp[];
/** Maximum size per file in bytes (10 MB). */
export declare const MAX_FILE_SIZE: number;
/** Maximum total size of workspace/context/ in bytes (100 MB). */
export declare const MAX_CONTEXT_SIZE: number;
/** Maximum total workspace size in bytes (500 MB). */
export declare const MAX_WORKSPACE_SIZE: number;
/** Allowed network destinations. */
export declare const ALLOWED_HOSTS: readonly string[];
/** Default ports. */
export declare const DEFAULT_PLUGIN_PORT: number;
export declare const DEFAULT_ORCHESTRATION_PORT: number;
export declare const IS_DEVELOPMENT: boolean;
export declare const LICENSE_BYPASS: boolean;
export declare const INTEGRITY_BYPASS: boolean;
//# sourceMappingURL=constants.d.ts.map