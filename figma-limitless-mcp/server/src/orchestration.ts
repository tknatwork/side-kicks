import { mkdirSync, existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { VERSION } from "./version.js";

/**
 * Orchestrator — the "limitless" layer that lives on the LEADER.
 *
 * Everything here is designed around three failure modes AI sessions hit:
 *  1. Context loss / compaction — the journal + checkpoints let a fresh
 *     session reconstruct exactly what was already done and resume.
 *  2. Multiple agents clobbering each other — named TTL locks serialize
 *     work on shared targets without blocking unrelated work.
 *  3. Token waste on re-orientation — the digest cache serves a compact
 *     file map instantly when nothing changed (doc-events invalidate it).
 *
 * All state is disk-backed under ~/.figma-limitless-mcp so a leader crash,
 * server restart, or leader-election handover loses nothing.
 */

const STATE_ROOT = path.join(homedir(), ".figma-limitless-mcp");
const JOURNAL_DIR = path.join(STATE_ROOT, "journal");
const CHECKPOINT_DIR = path.join(STATE_ROOT, "checkpoints");
const CODE_MAPPING_DIR = path.join(STATE_ROOT, "code-mappings");
const LOCKS_FILE = path.join(STATE_ROOT, "locks.json");

const JOURNAL_ROTATE_BYTES = 5 * 1024 * 1024;
const MAX_CHECKPOINT_BYTES = 256 * 1024;
const MAX_JOURNAL_PREVIEW_CHARS = 500;
const DEFAULT_LOCK_TTL_S = 120;
const MAX_LOCK_TTL_S = 3600;
const GLOBAL_BUCKET = "global";

export interface JournalEntry {
  seq: number;
  ts: string;
  agent: string;
  tool: string;
  fileKey: string;
  nodeIds?: string[];
  preview?: string;
  ok: boolean;
  error?: string;
  durMs: number;
}

interface LockEntry {
  name: string;
  agent: string;
  acquiredAt: string;
  expiresAt: number;
}

interface FileActivity {
  lastDocEventTs: number;
  docEventCount: number;
  changeKinds: Record<string, number>;
}

interface CachedDigest {
  digest: unknown;
  cachedAt: number;
  docEventCountAtCache: number;
  scope: string;
}

/** Tools whose calls are recorded in the journal (mutations + escape hatch). */
export const JOURNALED_TOOLS = new Set([
  "set_node_visibility",
  "set_text_content",
  "set_text_properties",
  "set_node_properties",
  "set_solid_fill",
  "set_gradient_fill",
  "set_effects",
  "set_stroke_properties",
  "set_auto_layout",
  "create_frame",
  "create_text",
  "create_shape",
  "create_image",
  "duplicate_nodes",
  "reparent_nodes",
  "group_nodes",
  "ungroup_node",
  "delete_nodes",
  "create_text_style",
  "update_text_style",
  "apply_text_style",
  "load_fonts",
  "execute_code",
  "write_variables",
  "set_grid_layout",
  "set_annotation",
  "apply_animation_style",
  "apply_shader",
  "set_reactions",
  "set_flow_starting_point",
  "create_component_from_node",
  "combine_as_variants",
  "add_component_property",
  "instantiate_component",
  "set_instance_properties",
  "swap_instance",
  "apply_style",
  "create_paint_style",
  "create_effect_style",
  "import_library_asset",
  "create_slot",
  "dev_resources",
]);

/** Journaled for audit, but never a document mutation — must not invalidate digests. */
export const NON_INVALIDATING_TOOLS = new Set(["load_fonts"]);

/** Meta tools handled by the orchestrator — never forwarded to the plugin. */
export const META_TOOLS = new Set([
  "save_checkpoint",
  "load_checkpoint",
  "get_journal",
  "acquire_lock",
  "release_lock",
  "get_workspace_status",
  "set_code_mapping",
  "get_code_mappings",
]);

const sanitize = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "_";

/**
 * Collision-proof file stem: names like 'pass 1' and 'pass:1' sanitize
 * identically, so a short hash of the RAW name keeps them distinct.
 */
const checkpointStem = (name: string): string =>
  `${sanitize(name)}-${createHash("sha1").update(name).digest("hex").slice(0, 8)}`;

export class Orchestrator {
  private seq = 0;
  private locks = new Map<string, LockEntry>();
  private activity = new Map<string, FileActivity>();
  private digests = new Map<string, CachedDigest>();
  private startedAt = Date.now();

  constructor() {
    mkdirSync(JOURNAL_DIR, { recursive: true });
    mkdirSync(CHECKPOINT_DIR, { recursive: true });
    mkdirSync(CODE_MAPPING_DIR, { recursive: true });
    this.loadLocks();
    this.seq = this.recoverSeq();
  }

  // ---------------------------------------------------------------- journal

  /** Called by the leader around every journaled plugin op. */
  record(entry: Omit<JournalEntry, "seq" | "ts">): void {
    try {
      this.seq++;
      const full: JournalEntry = {
        ...entry,
        seq: this.seq,
        ts: new Date().toISOString(),
      };
      const file = this.journalPath(entry.fileKey);
      this.rotateIfNeeded(file);
      appendFileSync(file, JSON.stringify(full) + "\n");
    } catch (err) {
      // Journaling must never break the op itself.
      console.error("journal write failed:", err);
    }
  }

  private journalPath(fileKey: string): string {
    return path.join(JOURNAL_DIR, sanitize(fileKey || GLOBAL_BUCKET) + ".jsonl");
  }

  private rotateIfNeeded(file: string): void {
    try {
      if (existsSync(file) && statSync(file).size > JOURNAL_ROTATE_BYTES) {
        renameSync(file, file + ".1");
      }
    } catch {
      /* rotation is best-effort */
    }
  }

  private recoverSeq(): number {
    // Continue the sequence across restarts so "have I seen seq N" stays
    // meaningful to resuming agents.
    let max = 0;
    try {
      for (const f of readdirSync(JOURNAL_DIR)) {
        // Rotated files (.jsonl.1) count too — a crash right after rotation
        // must not reset the sequence.
        if (!f.endsWith(".jsonl") && !f.endsWith(".jsonl.1")) continue;
        const lines = readFileSync(path.join(JOURNAL_DIR, f), "utf8")
          .trimEnd()
          .split("\n");
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
          try {
            const e = JSON.parse(lines[i]) as JournalEntry;
            if (typeof e.seq === "number" && e.seq > max) max = e.seq;
          } catch {
            /* skip torn line */
          }
        }
      }
    } catch {
      /* fresh state dir */
    }
    return max;
  }

  getJournal(params: Record<string, unknown>): unknown {
    const fileKey = typeof params.fileKey === "string" ? params.fileKey : undefined;
    const limit = Math.min(
      typeof params.limit === "number" && params.limit > 0 ? params.limit : 50,
      500
    );
    const toolFilter = typeof params.tool === "string" ? params.tool : undefined;
    const agentFilter = typeof params.agent === "string" ? params.agent : undefined;

    const files: string[] = [];
    if (fileKey) {
      const p = this.journalPath(fileKey);
      if (existsSync(p)) files.push(p);
    } else {
      try {
        for (const f of readdirSync(JOURNAL_DIR)) {
          if (f.endsWith(".jsonl")) files.push(path.join(JOURNAL_DIR, f));
        }
      } catch {
        /* none */
      }
    }

    const entries: JournalEntry[] = [];
    for (const file of files) {
      try {
        for (const line of readFileSync(file, "utf8").trimEnd().split("\n")) {
          if (!line) continue;
          try {
            entries.push(JSON.parse(line) as JournalEntry);
          } catch {
            /* torn line */
          }
        }
      } catch {
        /* unreadable */
      }
    }

    const filtered = entries
      .filter((e) => (toolFilter ? e.tool === toolFilter : true))
      .filter((e) => (agentFilter ? e.agent === agentFilter : true))
      .sort((a, b) => a.seq - b.seq)
      .slice(-limit);

    return {
      totalReturned: filtered.length,
      latestSeq: this.seq,
      entries: filtered,
    };
  }

  // ------------------------------------------------------------ checkpoints

  saveCheckpoint(params: Record<string, unknown>): unknown {
    const name = typeof params.name === "string" ? params.name : "";
    if (!name) throw new Error("name is required for save_checkpoint");
    if (!("data" in params)) throw new Error("data is required for save_checkpoint");
    const agent = typeof params.agent === "string" ? params.agent : "unknown";
    const fileKey =
      typeof params.fileKey === "string" && params.fileKey
        ? params.fileKey
        : GLOBAL_BUCKET;

    const payload = {
      name,
      agent,
      fileKey,
      ts: new Date().toISOString(),
      data: params.data,
    };
    const json = JSON.stringify(payload, null, 2);
    if (json.length > MAX_CHECKPOINT_BYTES) {
      throw new Error(
        `Checkpoint too large (${json.length} bytes > ${MAX_CHECKPOINT_BYTES}). Store a summary, not raw dumps.`
      );
    }
    const dir = path.join(CHECKPOINT_DIR, sanitize(fileKey));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, checkpointStem(name) + ".json"), json);
    return { saved: true, name, fileKey, ts: payload.ts, bytes: json.length };
  }

  loadCheckpoint(params: Record<string, unknown>): unknown {
    const name = typeof params.name === "string" ? params.name : undefined;
    const fileKey =
      typeof params.fileKey === "string" && params.fileKey
        ? params.fileKey
        : GLOBAL_BUCKET;
    const dir = path.join(CHECKPOINT_DIR, sanitize(fileKey));

    if (name) {
      const p = path.join(dir, checkpointStem(name) + ".json");
      if (!existsSync(p)) {
        return { found: false, name, fileKey, hint: "Use load_checkpoint without a name to list available checkpoints." };
      }
      const checkpoint = JSON.parse(readFileSync(p, "utf8"));
      if (checkpoint.name !== name) {
        return { found: false, name, fileKey, hint: "Checkpoint file did not match the requested name." };
      }
      return { found: true, checkpoint };
    }

    const list: Array<{ name: string; agent: string; ts: string; bytes: number }> = [];
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".json")) continue;
        try {
          const meta = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
          list.push({
            name: meta.name,
            agent: meta.agent,
            ts: meta.ts,
            bytes: statSync(path.join(dir, f)).size,
          });
        } catch {
          /* skip */
        }
      }
    }
    list.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return { found: list.length > 0, fileKey, checkpoints: list };
  }

  // ------------------------------------------------------------------ locks

  private loadLocks(): void {
    try {
      if (existsSync(LOCKS_FILE)) {
        const raw = JSON.parse(readFileSync(LOCKS_FILE, "utf8")) as LockEntry[];
        const now = Date.now();
        for (const lock of raw) {
          if (lock.expiresAt > now) this.locks.set(lock.name, lock);
        }
      }
    } catch {
      /* corrupt locks file — start clean */
    }
  }

  private persistLocks(): void {
    try {
      writeFileSync(LOCKS_FILE, JSON.stringify([...this.locks.values()], null, 2));
    } catch {
      /* best-effort */
    }
  }

  private pruneLocks(): void {
    const now = Date.now();
    let changed = false;
    for (const [name, lock] of this.locks) {
      if (lock.expiresAt <= now) {
        this.locks.delete(name);
        changed = true;
      }
    }
    if (changed) this.persistLocks();
  }

  acquireLock(params: Record<string, unknown>): unknown {
    const name = typeof params.name === "string" ? params.name : "";
    const agent = typeof params.agent === "string" ? params.agent : "";
    if (!name || !agent) throw new Error("name and agent are required for acquire_lock");
    const ttl = Math.min(
      typeof params.ttlSeconds === "number" && params.ttlSeconds > 0
        ? params.ttlSeconds
        : DEFAULT_LOCK_TTL_S,
      MAX_LOCK_TTL_S
    );

    this.pruneLocks();
    const existing = this.locks.get(name);
    if (existing && existing.agent !== agent) {
      return {
        acquired: false,
        name,
        holder: existing.agent,
        expiresAt: new Date(existing.expiresAt).toISOString(),
        hint: "Wait for expiry, ask the holder to release, or work on a different lock.",
      };
    }

    const lock: LockEntry = {
      name,
      agent,
      acquiredAt: new Date().toISOString(),
      expiresAt: Date.now() + ttl * 1000,
    };
    this.locks.set(name, lock);
    this.persistLocks();
    return {
      acquired: true,
      name,
      agent,
      renewed: existing?.agent === agent,
      expiresAt: new Date(lock.expiresAt).toISOString(),
    };
  }

  releaseLock(params: Record<string, unknown>): unknown {
    const name = typeof params.name === "string" ? params.name : "";
    const agent = typeof params.agent === "string" ? params.agent : "";
    if (!name || !agent) throw new Error("name and agent are required for release_lock");

    this.pruneLocks();
    const existing = this.locks.get(name);
    if (!existing) return { released: false, name, reason: "not held" };
    if (existing.agent !== agent && params.force !== true) {
      return {
        released: false,
        name,
        reason: `held by ${existing.agent}`,
        hint: "Pass force: true only if the holder is known-dead.",
      };
    }
    this.locks.delete(name);
    this.persistLocks();
    return { released: true, name };
  }

  // ------------------------------------------------- doc events + digests

  recordDocEvent(fileKey: string, payload: Record<string, unknown>): void {
    const entry = this.activity.get(fileKey) ?? {
      lastDocEventTs: 0,
      docEventCount: 0,
      changeKinds: {},
    };
    entry.lastDocEventTs = Date.now();
    entry.docEventCount += typeof payload.changes === "number" ? payload.changes : 1;
    const kinds = payload.kinds as Record<string, number> | undefined;
    if (kinds) {
      for (const [kind, count] of Object.entries(kinds)) {
        entry.changeKinds[kind] = (entry.changeKinds[kind] ?? 0) + count;
      }
    }
    this.activity.set(fileKey, entry);
  }

  /** Returns a fresh cached digest, or null if the caller must fetch from the plugin. */
  getCachedDigest(fileKey: string, scope: string): CachedDigest | null {
    const cached = this.digests.get(fileKey);
    if (!cached || cached.scope !== scope) return null;
    const activity = this.activity.get(fileKey);
    const eventsSinceCache =
      (activity?.docEventCount ?? 0) - cached.docEventCountAtCache;
    return eventsSinceCache === 0 ? cached : null;
  }

  /** Current doc-event count — snapshot BEFORE fetching a digest so events that land mid-computation invalidate it. */
  getActivityCount(fileKey: string): number {
    return this.activity.get(fileKey)?.docEventCount ?? 0;
  }

  storeDigest(
    fileKey: string,
    scope: string,
    digest: unknown,
    baselineDocEventCount: number
  ): void {
    this.digests.set(fileKey, {
      digest,
      cachedAt: Date.now(),
      docEventCountAtCache: baselineDocEventCount,
      scope,
    });
  }

  /**
   * Drops per-file volatile state. Called on plugin connect AND disconnect —
   * edits made while the plugin was closed produce no events, so any cached
   * digest from a previous connection must be considered stale.
   */
  dropFileState(fileKey: string): void {
    this.digests.delete(fileKey);
    this.activity.delete(fileKey);
  }

  // ---------------------------------------------------------- code mappings

  private codeMappingPath(fileKey: string): string {
    return path.join(CODE_MAPPING_DIR, sanitize(fileKey || GLOBAL_BUCKET) + ".json");
  }

  private readCodeMappings(fileKey: string): Record<string, unknown> {
    const p = this.codeMappingPath(fileKey);
    try {
      if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      /* corrupt — start clean */
    }
    return {};
  }

  /**
   * Local Code-Connect equivalent: durable node/component → source-code
   * mappings, stored server-side and served to any agent. Independent
   * tooling — nothing here touches Figma's Code Connect service.
   */
  setCodeMapping(params: Record<string, unknown>): unknown {
    const target = typeof params.target === "string" ? params.target : "";
    if (!target) {
      throw new Error("target is required (a nodeId, component key, or component name)");
    }
    const fileKey =
      typeof params.fileKey === "string" && params.fileKey
        ? params.fileKey
        : GLOBAL_BUCKET;
    const mappings = this.readCodeMappings(fileKey);

    if (params.remove === true) {
      delete mappings[target];
    } else {
      const source = typeof params.source === "string" ? params.source : "";
      if (!source) throw new Error("source is required (e.g. 'src/components/Button.tsx')");
      mappings[target] = {
        source,
        ...(typeof params.snippet === "string" ? { snippet: params.snippet } : {}),
        ...(typeof params.language === "string" ? { language: params.language } : {}),
        ...(typeof params.notes === "string" ? { notes: params.notes } : {}),
        agent: typeof params.agent === "string" ? params.agent : "unknown",
        ts: new Date().toISOString(),
      };
    }
    writeFileSync(this.codeMappingPath(fileKey), JSON.stringify(mappings, null, 2));
    return {
      saved: params.remove !== true,
      removed: params.remove === true,
      target,
      fileKey,
      totalMappings: Object.keys(mappings).length,
    };
  }

  getCodeMappings(params: Record<string, unknown>): unknown {
    const fileKey =
      typeof params.fileKey === "string" && params.fileKey
        ? params.fileKey
        : GLOBAL_BUCKET;
    const mappings = this.readCodeMappings(fileKey);
    const targets = Array.isArray(params.targets)
      ? (params.targets as unknown[]).filter((t): t is string => typeof t === "string")
      : null;
    const selected = targets
      ? Object.fromEntries(targets.map((t) => [t, mappings[t] ?? null]))
      : mappings;
    return { fileKey, count: Object.keys(selected).length, mappings: selected };
  }

  // ----------------------------------------------------------------- status

  getWorkspaceStatus(connectedFiles: Array<{ fileKey: string; fileName: string }>): unknown {
    this.pruneLocks();
    const checkpointBuckets: Record<string, number> = {};
    try {
      for (const bucket of readdirSync(CHECKPOINT_DIR)) {
        const dir = path.join(CHECKPOINT_DIR, bucket);
        try {
          checkpointBuckets[bucket] = readdirSync(dir).filter((f) =>
            f.endsWith(".json")
          ).length;
        } catch {
          /* skip */
        }
      }
    } catch {
      /* none */
    }

    return {
      server: { name: "figma-limitless-mcp", version: VERSION, uptimeS: Math.round((Date.now() - this.startedAt) / 1000) },
      stateRoot: STATE_ROOT,
      journalLatestSeq: this.seq,
      connectedFiles: connectedFiles.map((f) => {
        const activity = this.activity.get(f.fileKey);
        const digest = this.digests.get(f.fileKey);
        return {
          ...f,
          docEvents: activity?.docEventCount ?? 0,
          lastChangeAgoS: activity
            ? Math.round((Date.now() - activity.lastDocEventTs) / 1000)
            : null,
          digestCached: digest
            ? { scope: digest.scope, ageS: Math.round((Date.now() - digest.cachedAt) / 1000), stale: this.getCachedDigest(f.fileKey, digest.scope) === null }
            : null,
        };
      }),
      locks: [...this.locks.values()].map((l) => ({
        name: l.name,
        agent: l.agent,
        expiresAt: new Date(l.expiresAt).toISOString(),
      })),
      checkpoints: checkpointBuckets,
    };
  }

  // ------------------------------------------------------------ dispatcher

  /** Handle a meta tool. Throws on unknown tool or invalid input. */
  handleMeta(
    tool: string,
    params: Record<string, unknown>,
    connectedFiles: Array<{ fileKey: string; fileName: string }>
  ): unknown {
    switch (tool) {
      case "save_checkpoint":
        return this.saveCheckpoint(params);
      case "load_checkpoint":
        return this.loadCheckpoint(params);
      case "get_journal":
        return this.getJournal(params);
      case "acquire_lock":
        return this.acquireLock(params);
      case "release_lock":
        return this.releaseLock(params);
      case "get_workspace_status":
        return this.getWorkspaceStatus(connectedFiles);
      case "set_code_mapping":
        return this.setCodeMapping(params);
      case "get_code_mappings":
        return this.getCodeMappings(params);
      default:
        throw new Error(`Unknown meta tool: ${tool}`);
    }
  }
}

/** Builds the journal preview string for an op (truncated, secrets-free). */
export function journalPreview(params?: Record<string, unknown>): string | undefined {
  if (!params || Object.keys(params).length === 0) return undefined;
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === "imageBase64") {
      clone[key] = `<${String(value).length} b64 chars>`;
    } else {
      clone[key] = value;
    }
  }
  const json = JSON.stringify(clone);
  return json.length > MAX_JOURNAL_PREVIEW_CHARS
    ? json.slice(0, MAX_JOURNAL_PREVIEW_CHARS) + "…"
    : json;
}
