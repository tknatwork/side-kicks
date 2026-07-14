// Server-side lint runner. The plugin's `lint_run` gathers a LintSnapshot of
// the design system (variable graph + styles + components, after
// loadAllPagesAsync); this module runs the registered detectors over that
// snapshot. Detectors are added tier-by-tier in later waves; the scaffold
// registry is empty, so runLint reports the rule inventory + which rules are
// not yet implemented. Pure functions — no Figma API, no network — so it runs
// identically on leader or follower.

import { RULES, RULE_BY_ID, type RuleSeverity } from "./registry.js";

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

/** A detector receives the snapshot and returns findings for one rule. */
export type Detector = (snap: LintSnapshot) => Omit<
  Finding,
  "severity" | "category" | "fix_hint" | "skill_uri"
>[];

/**
 * Detector registry, keyed by rule id. Populated tier-by-tier (Waves 3–7).
 * A rule with no detector here is reported under `not_yet_implemented`.
 */
export const DETECTORS: Record<string, Detector> = {};

export interface LintOptions {
  only?: string[];
  categories?: string[];
  severity?: "error" | "warn" | "all";
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
  };
  findings: Finding[];
  not_yet_implemented: string[];
  scope: { pageCount: number; scannedAllPages: boolean; variables: number; collections: number; components: number };
}

export function runLint(snap: LintSnapshot, opts: LintOptions = {}): LintReport {
  const wanted = RULES.filter((r) => {
    if (opts.only && !opts.only.includes(r.id)) return false;
    if (opts.categories && !opts.categories.includes(r.category)) return false;
    return true;
  });

  const findings: Finding[] = [];
  const pending: string[] = [];
  let rulesRun = 0;
  const rulesWithFindings = new Set<string>();

  for (const rule of wanted) {
    const detector = DETECTORS[rule.id];
    if (!detector) {
      pending.push(rule.id);
      continue;
    }
    rulesRun++;
    for (const partial of detector(snap)) {
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

  return {
    summary: {
      errors: filtered.filter((f) => f.severity === "error").length,
      warnings: filtered.filter((f) => f.severity === "warn").length,
      infos: filtered.filter((f) => f.severity === "info").length,
      passed: rulesRun - rulesWithFindings.size,
      rules_total: wanted.length,
      rules_run: rulesRun,
      rules_pending: pending.length,
    },
    findings: filtered,
    not_yet_implemented: pending,
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
export function ruleInventory(): Array<{ id: string; category: string; severity: RuleSeverity; implemented: boolean }> {
  return RULES.map((r) => ({
    id: r.id,
    category: r.category,
    severity: r.severity,
    implemented: r.id in DETECTORS,
  }));
}

export { RULE_BY_ID };
