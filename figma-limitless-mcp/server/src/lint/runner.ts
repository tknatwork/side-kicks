// Server-side lint runner. The plugin's `lint_run` gathers a LintSnapshot of
// the design system (variable graph + styles + components, after
// loadAllPagesAsync); this module runs the registered detectors over that
// snapshot. Detectors are added tier-by-tier in later waves; the scaffold
// registry is empty, so runLint reports the rule inventory + which rules are
// not yet implemented. Pure functions — no Figma API, no network — so it runs
// identically on leader or follower.

import { RULES, RULE_BY_ID, type RuleSeverity } from "./registry.js";
import { RULE_CONFIG, resolveRuleConfig, LintConfigError } from "./config.js";

/** One variable's serialized form (aliases become { alias: variableId }). */
export interface SnapVariable {
  id: string;
  name: string;
  collectionId: string;
  resolvedType: string;
  scopes: string[];
  hiddenFromPublishing: boolean;
  codeSyntax: Record<string, string>;
  description: string;
  /** modeId -> raw value | { alias: variableId } */
  valuesByMode: Record<string, unknown>;
}

export interface SnapCollection {
  id: string;
  name: string;
  defaultModeId: string;
  modes: Array<{ modeId: string; name: string }>;
}

export interface SnapStyle {
  id: string;
  name: string;
  styleType: "PAINT" | "TEXT" | "EFFECT" | "GRID";
}

export interface SnapComponent {
  id: string;
  name: string;
  type: "COMPONENT" | "COMPONENT_SET";
  propertyDefinitions?: Record<string, unknown>;
}

/** One node->variable binding edge (a node field bound to a variable). */
export interface SnapBinding {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  field: string;
  variableId: string;
}

export interface LintSnapshot {
  collections: SnapCollection[];
  variables: SnapVariable[];
  styles: SnapStyle[];
  components: SnapComponent[];
  nodeBindings?: SnapBinding[];
  bindingsTruncated?: boolean;
  meta: { pageCount: number; scannedAllPages: boolean };
}

export interface Finding {
  rule_id: string;
  severity: RuleSeverity;
  category: string;
  message: string;
  fix_hint: string;
  skill_uri: string;
  variableId?: string;
  nodeId?: string;
}

/**
 * A detector receives the snapshot and returns findings for one rule. The
 * optional second arg carries this rule's resolved+validated config (see
 * config.ts) for parameterized/opt-in rules; the 30+ non-configurable detectors
 * ignore it (a narrower function is assignable to this type).
 */
export type Detector = (
  snap: LintSnapshot,
  config?: unknown
) => Omit<Finding, "severity" | "category" | "fix_hint" | "skill_uri">[];

/**
 * Detector registry, keyed by rule id. Populated tier-by-tier (Waves 3–7).
 * A rule with no detector here is reported under `not_yet_implemented`.
 */
export const DETECTORS: Record<string, Detector> = {};

export interface LintOptions {
  only?: string[];
  categories?: string[];
  severity?: "error" | "warn" | "all";
  /** Turn ON opt-in (defaultOn:false) rules by rule_id. */
  enable?: string[];
  /** Turn OFF otherwise-default-on rules by rule_id. */
  disable?: string[];
  /** Per-rule config for parameterized rules, keyed by rule_id (see config.ts). */
  config?: Record<string, unknown>;
}

/** An opt-in rule the AI could turn on, with how to do it. */
export interface OptInInfo {
  rule_id: string;
  category: string;
  title: string;
  config_shape?: string;
  config_defaults?: unknown;
  enable_hint: {
    tool: "lint_design_system";
    args: { enable: string[]; config?: Record<string, unknown> };
  };
}

export interface LintReport {
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    passed: number;
    rules_total: number;
    rules_run: number;
    rules_pending: number;
    rules_opt_in_available: number;
  };
  findings: Finding[];
  not_yet_implemented: string[];
  /** Rules skipped because their supplied config was invalid/missing. */
  config_errors: Array<{ rule_id: string; message: string }>;
  /** Rules whose detector threw (isolated so one bug can't abort the lint). */
  rule_failures: Array<{ rule_id: string; message: string }>;
  /** Opt-in rules that are implemented but off this run — what the AI can turn on. */
  available_optin: OptInInfo[];
  scope: { pageCount: number; scannedAllPages: boolean; variables: number; collections: number; components: number };
}

export function runLint(snap: LintSnapshot, opts: LintOptions = {}): LintReport {
  const enable = new Set(opts.enable ?? []);
  const disable = new Set(opts.disable ?? []);
  const onlySet = opts.only ? new Set(opts.only) : null;
  // An opt-in rule runs only when explicitly asked for (enable[] or named in only[]).
  const requested = (id: string): boolean => enable.has(id) || (onlySet?.has(id) ?? false);

  const wanted = RULES.filter((r) => {
    if (onlySet && !onlySet.has(r.id)) return false;
    if (opts.categories && !opts.categories.includes(r.category)) return false;
    if (disable.has(r.id)) return false;
    if (r.defaultOn === false && !requested(r.id)) return false;
    return true;
  });
  const wantedIds = new Set(wanted.map((r) => r.id));

  const findings: Finding[] = [];
  const pending: string[] = [];
  const configErrors: Array<{ rule_id: string; message: string }> = [];
  const ruleFailures: Array<{ rule_id: string; message: string }> = [];
  let rulesRun = 0;
  const rulesWithFindings = new Set<string>();

  for (const rule of wanted) {
    const detector = DETECTORS[rule.id];
    if (!detector) {
      pending.push(rule.id);
      continue;
    }

    // Resolve+validate this rule's config; a bad/missing config is recorded and
    // the rule skipped — never crash the whole lint over one rule's input.
    let config: unknown;
    try {
      config = resolveRuleConfig(rule.id, opts.config?.[rule.id]);
    } catch (e) {
      if (e instanceof LintConfigError) {
        configErrors.push({ rule_id: rule.id, message: e.message });
        continue;
      }
      throw e;
    }

    rulesRun++;
    // A detector bug must not abort the entire lint — isolate per-rule failures.
    let partials;
    try {
      partials = detector(snap, config);
    } catch (e) {
      ruleFailures.push({ rule_id: rule.id, message: e instanceof Error ? e.message : String(e) });
      continue;
    }
    for (const partial of partials) {
      findings.push({
        ...partial,
        rule_id: rule.id,
        severity: rule.severity,
        category: rule.category,
        fix_hint: rule.fixHint,
        skill_uri: rule.skillUri,
      });
      rulesWithFindings.add(rule.id);
    }
  }

  const sev = opts.severity ?? "all";
  const filtered =
    sev === "all"
      ? findings
      : findings.filter((f) =>
          sev === "error" ? f.severity === "error" : f.severity !== "info"
        );

  // Opt-in rules the AI could turn on but didn't run this pass.
  const availableOptin: OptInInfo[] = RULES.filter(
    (r) => r.defaultOn === false && r.id in DETECTORS && !wantedIds.has(r.id)
  ).map((r) => {
    const cfg = RULE_CONFIG[r.id];
    const configRequired = cfg != null && cfg.defaults == null;
    return {
      rule_id: r.id,
      category: r.category,
      title: r.title,
      ...(cfg ? { config_shape: cfg.configShape, config_defaults: cfg.defaults } : {}),
      enable_hint: {
        tool: "lint_design_system" as const,
        args: {
          enable: [r.id],
          ...(configRequired ? { config: { [r.id]: "<required — see config_shape>" } } : {}),
        },
      },
    };
  });

  return {
    summary: {
      errors: filtered.filter((f) => f.severity === "error").length,
      warnings: filtered.filter((f) => f.severity === "warn").length,
      infos: filtered.filter((f) => f.severity === "info").length,
      passed: rulesRun - rulesWithFindings.size,
      rules_total: wanted.length,
      rules_run: rulesRun,
      rules_pending: pending.length,
      rules_opt_in_available: availableOptin.length,
    },
    findings: filtered,
    not_yet_implemented: pending,
    config_errors: configErrors,
    rule_failures: ruleFailures,
    available_optin: availableOptin,
    scope: {
      pageCount: snap.meta.pageCount,
      scannedAllPages: snap.meta.scannedAllPages,
      variables: snap.variables.length,
      collections: snap.collections.length,
      components: snap.components.length,
    },
  };
}

/** Metadata helper for tooling that wants the full rule inventory. */
export function ruleInventory(): Array<{
  id: string;
  category: string;
  severity: RuleSeverity;
  implemented: boolean;
  defaultOn: boolean;
}> {
  return RULES.map((r) => ({
    id: r.id,
    category: r.category,
    severity: r.severity,
    implemented: r.id in DETECTORS,
    defaultOn: r.defaultOn !== false,
  }));
}

export { RULE_BY_ID };
