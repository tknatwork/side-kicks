/**
 * @dsb/core — Shared library for the Design System Builder toolkit.
 *
 * Re-exports all public modules:
 * - Token schema types
 * - Three-tier engine (alias validation, token generation)
 * - Color converter and palette generator
 * - Token validator
 * - Export formats (current JSON + W3C DTCG)
 * - Style generator (pure computation for building style plans)
 * - Learning (context persistence + workspace file reader)
 * - Crypto (config encryption, project manifest, integrity checking)
 * - Monitoring (tamper daemon, lockdown, connectivity)
 * - Build (state machine, pipeline definition)
 * - Telemetry (event types, collector)
 * - Result type (re-exported from @dsb/guardrails)
 *
 * @module core
 */

// Result type — re-export from guardrails for convenience
export { Result } from '@dsb/guardrails';
export type { Result as ResultType, Success, Failure } from '@dsb/guardrails';

// Token schema types
export type {
  RgbColor,
  HslColor,
  HsbColor,
  FigmaRgba,
  ColorValue,
  VariableValueType,
  PrimitiveValue,
  AliasReference,
  VariableValue,
  VariableDefinition,
  TierLevel,
  TierConfig,
  TierArchitecture,
  VariableGroup,
  CollectionExport,
  NestedVariables,
  ExportVariableValue,
  DesignSystemSpec,
  FrameworkTarget,
  PaletteSpec,
  TypographySpec,
  SpacingSpec,
  BreakpointSpec,
} from './tokens/schema';

// Three-tier engine
export {
  isAlias,
  validateAliasChain,
  validateCrossTierAliases,
  detectCircularAliases,
  buildTierArchitecture,
  buildTierMapping,
  generatePrimitives,
  generateSemanticTokens,
  generateComponentTokens,
  generateAllTokens,
} from './tokens/three-tier-engine';

// Color converter
export {
  figmaToHex,
  figmaToRgb,
  figmaToCss,
  figmaToHsl,
  figmaToHsb,
  figmaToAllFormats,
  hexToFigma,
  hexToAllFormats,
  hslToFigma,
} from './color/converter';

// Palette generator
export {
  generateColorScale,
  generateColorScheme,
  generateNeutralPalette,
} from './color/palette-generator';
export type {
  ColorScheme,
  PaletteStep,
  GeneratedPalette,
} from './color/palette-generator';

// Token validator
export {
  validateTokens,
  getPlanLimits,
} from './validation/token-validator';
export type {
  ValidationSeverity,
  ValidationIssue,
  ValidationReport,
  ValidationStats,
  PlanLimits,
} from './validation/token-validator';

// Export formats
export {
  exportCurrentFormat,
  importCurrentFormat,
} from './export/current-format';

export {
  exportDtcgFormat,
  exportDtcgMultiMode,
} from './export/dtcg-format';
export type {
  DtcgType,
  DtcgToken,
  DtcgGroup,
  DtcgDocument,
  DtcgExportOptions,
} from './export/dtcg-format';

// Style generator
export {
  buildStylePlan,
} from './styles/style-generator';
export type {
  ResolvedVariable,
  ColorStyleDef,
  TextStyleDef,
  EffectStyleDef,
  GridStyleDef,
  StyleDef,
  FontRequirement,
  StyleGenerationPlan,
  StyleGenerationConfig,
} from './styles/style-generator';

// Learning — context persistence
export {
  saveGlobalContext,
  loadGlobalContext,
  saveProjectContext,
  loadProjectContext,
  loadMergedContext,
} from './learning/context-store';
export type {
  GlobalContext,
  ProjectContext,
} from './learning/context-store';

// Learning — workspace file reader
export {
  listContextFiles,
  listSpecFiles,
  listExportFiles,
  listReportFiles,
  readContextFile,
  readContextJson,
  readSpecFile,
  readSpecJson,
  readMultipleContextFiles,
} from './learning/workspace-reader';
export type {
  WorkspaceFile,
  WorkspaceManifest,
} from './learning/workspace-reader';

// Learning — structural fingerprinting types
export type {
  CollectionTier,
  CollectionTopology,
  NamingSeparator,
  GroupingStrategy,
  ShadeNaming,
  NamingCasing,
  NamingConventions,
  AliasTopology,
  ScalePatterns,
  StyleStrategy,
  SourceMetadata,
  SourceFormat,
  StructuralFingerprint,
  ExtractorConfig,
  ExtractionResult,
  PatternSynthesis,
  StructurePreference,
} from './learning/types';

// Learning — fingerprint extractors
export { FingerprintExtractor } from './learning/fingerprint-extractor';
export { FigmaTokenExtractor } from './learning/extractors/figma-token-extractor';
export { CssTokenExtractor } from './learning/extractors/css-token-extractor';
export { DtcgTokenExtractor } from './learning/extractors/dtcg-token-extractor';

// Learning — pattern synthesis (multi-source learning)
export { synthesizePatterns } from './learning/pattern-synthesizer';

// Learning — learner pipeline (study → learn → recommend)
export { DesignSystemLearner } from './learning/learner';
export type {
  GenerationRecommendation,
  RecommendedTier,
  RecommendationConfidence,
} from './learning/learner';

// Learning — token generator (study → learn → generate)
export { TokenGenerator, generateTokenSystem } from './learning/token-generator';
export type {
  GeneratedTokenSystem,
  GeneratedTier,
  GenerationSummary,
} from './learning/token-generator';

// ============================================================================
// CRYPTO — Config encryption, project manifest, integrity checking
// ============================================================================

// Config cipher — AES-256-GCM encryption for config payloads
export {
  generateSessionKey,
  encryptConfig,
  decryptConfig,
  sessionKeyFromHex,
} from './crypto/config-cipher';
export type {
  EncryptedConfig,
  SessionKey,
} from './crypto/config-cipher';

// Project manifest — Runtime file integrity for the DSB project folder
export {
  generateProjectManifest,
  saveProjectManifest,
  loadProjectManifest,
  verifyProjectManifest,
  verifySingleFile,
} from './crypto/manifest';
export type {
  ProjectManifest,
  ManifestVerification,
} from './crypto/manifest';

// Integrity checker — Per-tool-call integrity guard
export {
  checkIntegrity,
  fullIntegrityCheck,
  formatIntegrityError,
} from './crypto/integrity-checker';
export type {
  IntegrityGate,
} from './crypto/integrity-checker';

// ============================================================================
// MONITORING — Tamper daemon, lockdown, connectivity
// ============================================================================

// Tamper daemon — File watcher with hash verification
export { TamperDaemon } from './monitoring/tamper-daemon';
export type {
  TamperEvent,
  TamperDaemonConfig,
  DaemonState,
} from './monitoring/tamper-daemon';

// Lockdown — State management for tamper-triggered lockdown
export { LockdownManager } from './monitoring/lockdown';
export type {
  LockdownState,
  LockdownReason,
} from './monitoring/lockdown';

// Connectivity — Internet connection checks
export {
  checkConnectivity,
  checkDns,
  checkHttps,
} from './monitoring/connectivity';
export type {
  ConnectivityResult,
  ConnectivityStatus,
} from './monitoring/connectivity';

// ============================================================================
// BUILD — State machine + pipeline definition
// ============================================================================

// Build state — Crash-recoverable build state persistence
export {
  saveBuildState,
  loadBuildState,
  clearBuildState,
  advanceStep,
  failStep,
  pauseBuild,
} from './build/build-state';
export type {
  BuildState,
  BuildStep,
  BuildStatus,
  StepResult,
  StepError,
} from './build/build-state';

// Build pipeline — Step definitions and ordering
export {
  PIPELINE_STEPS,
  PIPELINE_ORDER,
  getDefaultPendingSteps,
  getNextStep,
  estimateRemainingTokens,
  formatBuildPlan,
} from './build/build-pipeline';
export type {
  PipelineStepDef,
} from './build/build-pipeline';

// Build orchestrator — Plans builds using spec + learned recommendations
export {
  planBuild,
} from './build/build-orchestrator';
export type {
  StepCommand,
  CommandExpectation,
  StepPlan,
  StepExpectedOutput,
  BuildExecutionPlan,
  PlanSummary,
} from './build/build-orchestrator';

// ============================================================================
// TELEMETRY — Event types + collector
// ============================================================================

// Telemetry events — Type definitions and factory functions
export {
  generateTelemetrySessionId,
  uiEvent,
  buildEvent,
  errorEvent,
  sessionEvent,
} from './telemetry/events';
export type {
  TelemetryEvent,
  EventCategory,
} from './telemetry/events';

// Telemetry collector — In-memory buffer with periodic flush
export { TelemetryCollector } from './telemetry/collector';
export type {
  CollectorConfig,
  CollectorStats,
} from './telemetry/collector';
