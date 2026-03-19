"use strict";
/**
 * Guardrails constants — shared configuration for the sandbox system.
 *
 * @module constants
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
exports.INTEGRITY_BYPASS = exports.LICENSE_BYPASS = exports.IS_DEVELOPMENT = exports.DEFAULT_ORCHESTRATION_PORT = exports.DEFAULT_PLUGIN_PORT = exports.ALLOWED_HOSTS = exports.MAX_WORKSPACE_SIZE = exports.MAX_CONTEXT_SIZE = exports.MAX_FILE_SIZE = exports.SECRET_PATTERNS = exports.BLOCKED_EXTENSIONS = exports.ALLOWED_EXTENSIONS = exports.WRITE_ALLOWED_ROOTS = exports.READ_ALLOWED_ROOTS = exports.DSB_ROOT = void 0;
exports.resolveDsbRoot = resolveDsbRoot;
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
// ============================================================================
// SECTION 1: ENVIRONMENT DETECTION
// ============================================================================
/**
 * Resolve the DSB root directory.
 * In production: the Design System Builder installation folder.
 * Falls back to env var or cwd.
 */
function resolveDsbRoot() {
    if (process.env['DSB_ROOT']) {
        return path.resolve(process.env['DSB_ROOT']);
    }
    // Walk up from packages/guardrails/src/ to the root
    return path.resolve(__dirname, '..', '..', '..');
}
exports.DSB_ROOT = resolveDsbRoot();
// ============================================================================
// SECTION 2: SANDBOX BOUNDARIES
// ============================================================================
/** Directories that can be read from. */
exports.READ_ALLOWED_ROOTS = Object.freeze([
    path.resolve(exports.DSB_ROOT, 'workspace', 'context'),
    path.resolve(exports.DSB_ROOT, 'workspace', 'exports'),
    path.resolve(exports.DSB_ROOT, 'workspace', 'specs'),
    path.resolve(exports.DSB_ROOT, 'workspace', 'reports'),
    path.resolve(exports.DSB_ROOT, 'workspace', 'temp'),
    path.resolve(exports.DSB_ROOT, 'templates'),
    path.resolve(exports.DSB_ROOT, '.dsb'),
    path.resolve(os.homedir(), '.dsb'),
]);
/** Directories that can be written to. */
exports.WRITE_ALLOWED_ROOTS = Object.freeze([
    path.resolve(exports.DSB_ROOT, 'workspace', 'exports'),
    path.resolve(exports.DSB_ROOT, 'workspace', 'specs'),
    path.resolve(exports.DSB_ROOT, 'workspace', 'reports'),
    path.resolve(exports.DSB_ROOT, 'workspace', 'temp'),
    path.resolve(exports.DSB_ROOT, '.dsb'),
    path.resolve(os.homedir(), '.dsb'),
]);
// ============================================================================
// SECTION 3: FILE POLICY
// ============================================================================
/** File extensions allowed for context input (workspace/context/). */
exports.ALLOWED_EXTENSIONS = new Set([
    '.json', '.tokens', '.tokens.json',
    '.pdf', '.md', '.txt',
    '.css', '.scss', '.less',
    '.ts', '.tsx', '.js', '.jsx',
    '.vue', '.svelte',
    '.yaml', '.yml',
    '.config.js', '.config.ts',
    '.svg', '.png', '.jpg', '.jpeg', '.webp',
]);
/** File extensions that are always blocked — never processed. */
exports.BLOCKED_EXTENSIONS = new Set([
    '.exe', '.app', '.dmg', '.msi',
    '.sh', '.bat', '.cmd', '.ps1',
    '.env', '.env.local',
    '.pem', '.key', '.cert', '.crt',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.db', '.sqlite', '.sql',
    '.doc', '.docx', '.xls', '.xlsx',
]);
/** Patterns in filenames that indicate secrets — always blocked. */
exports.SECRET_PATTERNS = Object.freeze([
    /\.env(\..+)?$/,
    /credentials/i,
    /secret/i,
    /\.pem$/,
    /\.key$/,
    /id_rsa/,
    /id_ed25519/,
]);
// ============================================================================
// SECTION 4: SIZE LIMITS
// ============================================================================
/** Maximum size per file in bytes (10 MB). */
exports.MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Maximum total size of workspace/context/ in bytes (100 MB). */
exports.MAX_CONTEXT_SIZE = 100 * 1024 * 1024;
/** Maximum total workspace size in bytes (500 MB). */
exports.MAX_WORKSPACE_SIZE = 500 * 1024 * 1024;
// ============================================================================
// SECTION 5: NETWORK
// ============================================================================
/** Allowed network destinations. */
exports.ALLOWED_HOSTS = Object.freeze([
    'localhost',
    '127.0.0.1',
    'api.figma.com',
    'api.gumroad.com',
]);
/** Default ports. */
exports.DEFAULT_PLUGIN_PORT = 9876;
exports.DEFAULT_ORCHESTRATION_PORT = 9877;
// ============================================================================
// SECTION 6: DEVELOPMENT FLAGS
// ============================================================================
exports.IS_DEVELOPMENT = process.env['DEVELOPMENT_MODE'] === 'true';
exports.LICENSE_BYPASS = process.env['LICENSE_BYPASS'] === 'true';
exports.INTEGRITY_BYPASS = process.env['INTEGRITY_BYPASS'] === 'true';
