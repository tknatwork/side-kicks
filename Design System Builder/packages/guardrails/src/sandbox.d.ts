/**
 * Sandbox — High-level convenience API for safe file operations.
 *
 * Wraps Node.js fs operations with guardrail enforcement.
 * All file I/O in DSB should go through this module instead of using fs directly.
 *
 * @module sandbox
 */
import { Result } from './result';
/**
 * Safely read a file within the sandbox.
 *
 * @param filePath - Path to the file (will be validated).
 * @returns File contents as string, or an error.
 */
export declare function safeReadFile(filePath: string): Result<string, string>;
/**
 * Safely read a JSON file within the sandbox.
 *
 * @param filePath - Path to the JSON file.
 * @returns Parsed JSON content, or an error.
 */
export declare function safeReadJson<T = unknown>(filePath: string): Result<T, string>;
/**
 * Safely write a file within the sandbox.
 *
 * @param filePath - Path to write to (will be validated).
 * @param content - Content to write.
 * @returns The written path, or an error.
 */
export declare function safeWriteFile(filePath: string, content: string): Result<string, string>;
/**
 * Safely write a JSON file within the sandbox.
 *
 * @param filePath - Path to write to.
 * @param data - Data to serialize as JSON.
 * @returns The written path, or an error.
 */
export declare function safeWriteJson(filePath: string, data: unknown): Result<string, string>;
/**
 * Safely check if a file exists within the sandbox.
 *
 * @param filePath - Path to check.
 * @returns true if file exists, false if not, or an error if path is outside sandbox.
 */
export declare function safeExists(filePath: string): Result<boolean, string>;
/**
 * Safely list files in a directory within the sandbox.
 *
 * @param dirPath - Path to the directory.
 * @returns Array of filenames, or an error.
 */
export declare function safeListDir(dirPath: string): Result<string[], string>;
/**
 * Safely delete a file within the sandbox (restricted to workspace/temp/).
 *
 * @param filePath - Path to delete.
 * @returns Confirmation or error.
 */
export declare function safeDelete(filePath: string): Result<string, string>;
//# sourceMappingURL=sandbox.d.ts.map