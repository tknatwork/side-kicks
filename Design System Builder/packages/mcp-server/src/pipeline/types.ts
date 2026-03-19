/**
 * Shared type definitions for the cross-file Figma pipeline.
 *
 * Used by: openpencil-adapter, impact-analyzer, write-governor,
 * pipeline-tools, file-role-tools.
 *
 * @module pipeline/types
 */

// ─── File Role ──────────────────────────────────────────────────────────────

/** The active Figma file's role in the pipeline. */
export type FileRole = 'source' | 'destination' | 'source+destination';

/** Persistent session state for cross-file orchestration. */
export interface PipelineSession {
  readonly sourceFileKey?: string;
  readonly destinationFileKey?: string;
  readonly role: FileRole;
  readonly openPencilPort: number;
}

// ─── Source Analysis ────────────────────────────────────────────────────────

/** Combined output of all OpenPencil adapter reads. */
export interface SourceAnalysis {
  readonly tree: SourceTree;
  readonly variables: VariableMap;
  readonly components: ComponentRegistry;
  readonly reactions: readonly ReactionRecord[];
  readonly fonts: FontManifest;
}

/** Full page/node hierarchy from OpenPencil `tree` command. */
export interface SourceTree {
  readonly pages: readonly PageNode[];
  readonly totalNodes: number;
}

/** A page in the Figma document. */
export interface PageNode {
  readonly id: string;
  readonly name: string;
  readonly children: readonly SourceNode[];
}

/** A node in the source tree (recursive). */
export interface SourceNode {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly children?: readonly SourceNode[];
  readonly properties?: Readonly<Record<string, unknown>>;
}

// ─── Variables ──────────────────────────────────────────────────────────────

/** All variable collections and their variables. */
export interface VariableMap {
  readonly collections: readonly VariableCollection[];
}

/** A Figma variable collection with modes. */
export interface VariableCollection {
  readonly id: string;
  readonly name: string;
  readonly modes: readonly string[];
  readonly variables: readonly VariableEntry[];
}

/** A single variable with per-mode values and alias chain. */
export interface VariableEntry {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly tier?: 'primitives' | 'semantic' | 'component' | 'breakpoints';
  readonly values: Readonly<Record<string, unknown>>;
  readonly aliasOf?: string;
  readonly referencedBy?: readonly string[];
}

// ─── Reactions (Prototype Connections) ──────────────────────────────────────

/** A prototype connection between two nodes. */
export interface ReactionRecord {
  readonly sourceNodeId: string;
  readonly trigger: string;
  readonly destinationNodeId: string;
  readonly transitionType?: string;
  readonly transitionDuration?: number;
  readonly transitionEasing?: string;
}

// ─── Fonts ──────────────────────────────────────────────────────────────────

/** All fonts used in the source file. */
export interface FontManifest {
  readonly fonts: readonly FontEntry[];
}

/** A single font face used in the file. */
export interface FontEntry {
  readonly family: string;
  readonly weight: number;
  readonly style: string;
  readonly source: 'google' | 'local' | 'unknown';
}

// ─── Component Registry ─────────────────────────────────────────────────────

/** All components: masters, variants, and instances. */
export interface ComponentRegistry {
  readonly masters: readonly ComponentMaster[];
  readonly totalInstances: number;
}

/** A master component with its variants. */
export interface ComponentMaster {
  readonly id: string;
  readonly name: string;
  readonly pageId: string;
  readonly variants: readonly ComponentVariant[];
  readonly instanceCount: number;
}

/** A component variant (child of master). */
export interface ComponentVariant {
  readonly id: string;
  readonly name: string;
  readonly properties: Readonly<Record<string, string>>;
}

/** An instance of a component. */
export interface ComponentInstance {
  readonly id: string;
  readonly masterId: string;
  readonly pageId: string;
  readonly overrides: readonly string[];
}

// ─── Property Changes ───────────────────────────────────────────────────────

/** A single property change to apply to the destination. */
export interface PropertyChange {
  readonly nodeId: string;
  readonly property: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly tier?: 'primitives' | 'semantic' | 'component' | 'breakpoints';
}

/** Optional scope for extraction (limits analysis to part of the file). */
export interface ExtractionScope {
  readonly pageIds?: readonly string[];
  readonly nodeIds?: readonly string[];
  readonly componentNames?: readonly string[];
}

// ─── Impact Analysis ────────────────────────────────────────────────────────

/** Full cascading impact report for a set of proposed changes. */
export interface ImpactReport {
  readonly tokens: ImpactTokens;
  readonly nodes: ImpactNodes;
  readonly instances: ImpactInstances;
  readonly prototypeWarnings: readonly PrototypeWarning[];
  readonly summary: string;
}

/** Token-level impact counts. */
export interface ImpactTokens {
  readonly tier1Affected: number;
  readonly tier2Affected: number;
  readonly tier3Affected: number;
  readonly affectedIds: readonly string[];
}

/** Node-level impact counts. */
export interface ImpactNodes {
  readonly directlyAffected: number;
  readonly inheritedAffected: number;
  readonly affectedIds: readonly string[];
}

/** Instance-level impact counts. */
export interface ImpactInstances {
  readonly mastersAffected: number;
  readonly instancesAffected: number;
  readonly affectedMasterIds: readonly string[];
}

/** Warning about prototype connections affected by a change. */
export interface PrototypeWarning {
  readonly reactionIndex: number;
  readonly sourceNodeId: string;
  readonly destinationNodeId: string;
  readonly reason: string;
}

// ─── Write Governor ─────────────────────────────────────────────────────────

/** Ordering group for command sequencing. */
export type CommandGroup =
  | 'variable-additions'
  | 'node-additions'
  | 'property-changes'
  | 'node-deletions'
  | 'variable-deletions';

/** A command to send through the write governor. */
export interface GovernorCommand {
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly group: CommandGroup;
  readonly dependsOn?: readonly string[];
}

/** A planned batch with dependency and verification checks. */
export interface BatchPlan {
  readonly commands: readonly GovernorCommand[];
  readonly group: CommandGroup;
  readonly dependencies: readonly DependencyCheck[];
  readonly verifications: readonly VerificationCheck[];
}

/** Pre-batch check: does a required entity exist in the destination? */
export interface DependencyCheck {
  readonly type: 'variable' | 'collection' | 'node' | 'style' | 'font';
  readonly id: string;
  readonly name: string;
  readonly queryCommand: { readonly type: string; readonly payload: Record<string, unknown> };
}

/** Result of a single batch execution. */
export interface BatchResult {
  readonly batchIndex: number;
  readonly group: CommandGroup;
  readonly commandCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly durationMs: number;
  readonly errors: readonly string[];
}

/** Post-batch check: was the entity actually created? */
export interface VerificationCheck {
  readonly type: 'variable' | 'collection' | 'node' | 'style';
  readonly id: string;
  readonly name: string;
  readonly queryCommand: { readonly type: string; readonly payload: Record<string, unknown> };
}

/** Full governor execution result. */
export interface GovernorResult {
  readonly totalCommands: number;
  readonly totalApplied: number;
  readonly totalFailed: number;
  readonly totalSkipped: number;
  readonly batches: readonly BatchResult[];
  readonly circuitBroken: boolean;
  readonly durationMs: number;
}

// ─── Verification ───────────────────────────────────────────────────────────

/** Configuration for three-channel verification. */
export interface VerificationConfig {
  readonly destinationFileKey?: string;
  readonly enableScreenshotVerification: boolean;
  readonly maxDependencyRetries: number;
  readonly dependencyRetryDelayMs: number;
}
