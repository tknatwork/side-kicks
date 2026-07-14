// Per-rule config for the linter's opt-in / parameterized rules. Validation is
// manual (the pure lint core stays zod-free; the tool-layer Zod schema in
// schema.ts guards the transport shape separately). resolveRuleConfig throws a
// LintConfigError with a clear message on bad/missing config for an enabled
// rule — the runner records it under config_errors and skips the rule rather
// than crashing the whole lint. Untrusted input is never dereferenced blindly.

export class LintConfigError extends Error {
  constructor(
    public ruleId: string,
    message: string
  ) {
    super(message);
    this.name = "LintConfigError";
  }
}

export interface RuleConfigMeta {
  /** Human/AI-readable shape, surfaced in available_optin. */
  configShape: string;
  /** Resolved config used when none is supplied, or null when config is REQUIRED. */
  defaults: unknown;
  /** Validate + merge raw user config into the typed value the detector receives. */
  resolve: (raw: unknown) => unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

function asInt(
  v: unknown,
  ruleId: string,
  field: string,
  min: number,
  max?: number
): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || (max != null && v > max)) {
    const range = max != null ? `[${min}..${max}]` : `>= ${min}`;
    throw new LintConfigError(ruleId, `'${field}' must be an integer ${range}`);
  }
  return v;
}

function asStringArray(v: unknown, ruleId: string, field: string): string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new LintConfigError(ruleId, `'${field}' must be an array of strings`);
  }
  return v as string[];
}

const RESOLVED_TYPES = new Set(["COLOR", "FLOAT", "STRING", "BOOLEAN"]);

export const RULE_CONFIG: Record<string, RuleConfigMeta> = {
  "variant-count-ceiling-60": {
    configShape: "{ ceiling?: number }  // int >= 1, default 60",
    defaults: { ceiling: 60 },
    resolve: (raw) => {
      if (raw == null) return { ceiling: 60 };
      if (!isObj(raw)) throw new LintConfigError("variant-count-ceiling-60", "config must be an object");
      return { ceiling: raw.ceiling == null ? 60 : asInt(raw.ceiling, "variant-count-ceiling-60", "ceiling", 1) };
    },
  },
  "numeric-scale-zero-padded": {
    configShape: "{ width?: number }  // int 1..6, default 3",
    defaults: { width: 3 },
    resolve: (raw) => {
      if (raw == null) return { width: 3 };
      if (!isObj(raw)) throw new LintConfigError("numeric-scale-zero-padded", "config must be an object");
      return { width: raw.width == null ? 3 : asInt(raw.width, "numeric-scale-zero-padded", "width", 1, 6) };
    },
  },
  "min-font-size": {
    configShape: "{ floor?: number }  // px, int 1..32, default 12 (WCAG hard floor)",
    defaults: { floor: 12 },
    resolve: (raw) => {
      if (raw == null) return { floor: 12 };
      if (!isObj(raw)) throw new LintConfigError("min-font-size", "config must be an object");
      return { floor: raw.floor == null ? 12 : asInt(raw.floor, "min-font-size", "floor", 1, 32) };
    },
  },
  "codesyntax-web-matches-name": {
    configShape: "{ minSharedSegments?: number }  // int >= 1, default 1",
    defaults: { minSharedSegments: 1 },
    resolve: (raw) => {
      if (raw == null) return { minSharedSegments: 1 };
      if (!isObj(raw)) throw new LintConfigError("codesyntax-web-matches-name", "config must be an object");
      return {
        minSharedSegments:
          raw.minSharedSegments == null ? 1 : asInt(raw.minSharedSegments, "codesyntax-web-matches-name", "minSharedSegments", 1),
      };
    },
  },
  "multi-brand-alias-discipline": {
    configShape: "{ brandPrefix: string (required, e.g. 'brand'), roles?: string[] (default ['accent','action','brand','primary']) }",
    defaults: null, // config REQUIRED — the brand layer must be declared
    resolve: (raw) => {
      if (!isObj(raw)) throw new LintConfigError("multi-brand-alias-discipline", "needs config { brandPrefix: string }");
      if (typeof raw.brandPrefix !== "string" || raw.brandPrefix.length === 0) {
        throw new LintConfigError("multi-brand-alias-discipline", "'brandPrefix' must be a non-empty string");
      }
      const roles =
        raw.roles == null
          ? ["accent", "action", "brand", "primary"]
          : asStringArray(raw.roles, "multi-brand-alias-discipline", "roles");
      return { brandPrefix: raw.brandPrefix, roles };
    },
  },
  "semantic-role-allowlist": {
    configShape: "{ allowlist: string[] (required, non-empty), resolvedType?: 'COLOR'|'FLOAT'|'STRING'|'BOOLEAN' (default COLOR) }",
    defaults: null, // config REQUIRED — no universal role vocabulary
    resolve: (raw) => {
      if (!isObj(raw)) throw new LintConfigError("semantic-role-allowlist", "needs config { allowlist: string[] }");
      const allowlist = asStringArray(raw.allowlist, "semantic-role-allowlist", "allowlist");
      if (allowlist.length === 0) throw new LintConfigError("semantic-role-allowlist", "'allowlist' must be non-empty");
      const resolvedType = raw.resolvedType == null ? "COLOR" : raw.resolvedType;
      if (typeof resolvedType !== "string" || !RESOLVED_TYPES.has(resolvedType)) {
        throw new LintConfigError("semantic-role-allowlist", "'resolvedType' must be COLOR | FLOAT | STRING | BOOLEAN");
      }
      return { allowlist: allowlist.map((s) => s.toLowerCase()), resolvedType };
    },
  },
  "top-segment-in-tier-vocabulary": {
    configShape: "{ vocab: { primitive?: string[], semantic?: string[], component?: string[] } (>= 1 non-empty list) }",
    defaults: null, // config REQUIRED — the vocabulary is the team's own choice
    resolve: (raw) => {
      if (!isObj(raw) || !isObj(raw.vocab)) {
        throw new LintConfigError("top-segment-in-tier-vocabulary", "needs config { vocab: { semantic?: string[], ... } }");
      }
      const src = raw.vocab;
      const vocab: Record<string, string[]> = {};
      let any = false;
      for (const tier of ["primitive", "semantic", "component"] as const) {
        if (src[tier] == null) continue;
        const list = asStringArray(src[tier], "top-segment-in-tier-vocabulary", `vocab.${tier}`);
        vocab[tier] = list.map((s) => s.toLowerCase());
        if (list.length > 0) any = true;
      }
      if (!any) throw new LintConfigError("top-segment-in-tier-vocabulary", "'vocab' must have at least one non-empty tier list");
      return { vocab };
    },
  },
};

/** Resolve a rule's config (defaults merged + validated), or undefined if the
 *  rule takes no config. Throws LintConfigError on invalid/missing config. */
export function resolveRuleConfig(ruleId: string, raw: unknown): unknown {
  const meta = RULE_CONFIG[ruleId];
  if (!meta) return undefined;
  return meta.resolve(raw);
}
