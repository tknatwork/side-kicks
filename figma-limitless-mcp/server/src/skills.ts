// Offline design-system skills layer (knowledge half).
// Reads the bundled Markdown docs shipped in dist/skills/ (copied from
// server/skills/ at build time). Pure local file reads — no network, no
// plugin round-trip — so every server instance (leader or follower) serves
// its own bundled copy. The docs encode the canonical Primitive -> Semantic
// -> Component build order and the 57-rule lint catalog.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ruleInventory } from "./lint/index.js";

const SKILLS_DIR = fileURLToPath(new URL("./skills/", import.meta.url));

interface SkillIndexEntry {
  slug: string;
  title: string;
  summary: string;
  when_to_use: string;
  uri: string;
  related_rules: string[];
}

interface SkillIndex {
  skills: SkillIndexEntry[];
  canonical: string;
  rules_catalog: string;
  rule_count: number;
}

// The two special docs that aren't in index.skills but are readable by slug.
const SPECIAL_SLUGS = new Set(["canonical-structure", "lint-rules"]);
const SLUG_RE = /^[a-z0-9-]+$/;

let indexCache: SkillIndex | null = null;

async function loadIndex(): Promise<SkillIndex> {
  if (!indexCache) {
    indexCache = JSON.parse(
      await readFile(`${SKILLS_DIR}index.json`, "utf8")
    ) as SkillIndex;
  }
  return indexCache;
}

/** list_skills — the bundled skill catalog, optionally keyword-filtered. */
export async function listSkills(query?: string): Promise<unknown> {
  const idx = await loadIndex();
  let skills = idx.skills;
  if (query && query.trim()) {
    const q = query.toLowerCase();
    skills = skills.filter(
      (k) =>
        k.title.toLowerCase().includes(q) ||
        k.summary.toLowerCase().includes(q) ||
        k.slug.includes(q)
    );
  }
  return {
    start_here: {
      slug: "canonical-structure",
      uri: idx.canonical,
      note: "The flawless build order — read this (or call get_build_recipe) before building a design system.",
    },
    rules_catalog: {
      slug: "lint-rules",
      uri: idx.rules_catalog,
      rule_count: idx.rule_count,
    },
    skills: skills.map((k) => ({
      slug: k.slug,
      title: k.title,
      summary: k.summary,
      when_to_use: k.when_to_use,
      uri: k.uri,
      related_rules: k.related_rules,
    })),
  };
}

/** read_skill — the full Markdown of one bundled skill (whitelisted slug). */
export async function readSkill(slug: string): Promise<unknown> {
  const idx = await loadIndex();
  const known = new Set(idx.skills.map((k) => k.slug));
  // Whitelist + charset guard: no path traversal possible.
  if (!SLUG_RE.test(slug) || (!known.has(slug) && !SPECIAL_SLUGS.has(slug))) {
    throw new Error(
      `Unknown skill '${slug}'. Call list_skills for available slugs (six skills plus 'canonical-structure' and 'lint-rules').`
    );
  }
  const markdown = await readFile(`${SKILLS_DIR}${slug}.md`, "utf8");
  const meta = idx.skills.find((k) => k.slug === slug);
  return {
    slug,
    title: meta?.title ?? slug,
    uri: `skill://design-system/${slug}`,
    related_rules: meta?.related_rules ?? [],
    markdown,
  };
}

// Build-order steps -> the lint rule_ids that gate each step. Some ids are
// forward-declared (their detector lands in a later wave); getBuildRecipe splits
// each gate into enforced-now vs pending at runtime from the live registry, so
// this list never drifts out of sync with what lint_design_system can actually
// check.
const STEP_GATES: Record<string, string[]> = {
  collections: ["three-tier-collections-exist"],
  primitives: [
    "primitive-raw-values-only",
    "primitive-hidden-from-publishing",
    "no-node-binds-primitive",
  ],
  semantic: [
    "semantic-alias-in-every-mode",
    "alias-one-tier-down",
    "no-all-scopes-on-typed-token",
    "color-role-scope-match",
  ],
  component: [
    "component-token-must-alias-semantic",
    "alias-graph-acyclic-max-depth-2",
  ],
  components: ["variant-matrix-complete", "property-name-convention-unique"],
  codegen: [
    "published-variable-has-codesyntax-web",
    "no-raw-value-on-component-node",
  ],
  a11y: [
    "fg-bg-pair-contrast",
    "border-icon-graphical-contrast",
    "min-font-size",
  ],
  all: [],
};
const STEP_ORDER = [
  "collections",
  "primitives",
  "semantic",
  "component",
  "components",
  "codegen",
  "a11y",
];

/** Set of rule_ids whose detector is actually wired up right now. */
function implementedRuleIds(): Set<string> {
  return new Set(ruleInventory().filter((r) => r.implemented).map((r) => r.id));
}

/**
 * Turn a step's gate rule_ids into an actionable, self-healing lint gate:
 * which rules are enforced now (runnable via lint_design_system), which are
 * still forward-declared, and the exact call to close the build->lint->fix loop.
 */
function buildGate(gateIds: string[]): unknown {
  const impl = implementedRuleIds();
  const enforced = gateIds.filter((id) => impl.has(id));
  const pending = gateIds.filter((id) => !impl.has(id));
  return {
    enforced_now: enforced,
    forward_declared: pending, // detectors land in a later wave; not yet checked
    run: enforced.length
      ? { tool: "lint_design_system", args: { only: enforced } }
      : null,
    instruction: enforced.length
      ? "After finishing this step, run the `run` call before advancing to next_step. Treat severity:error findings as blocking — fix them. Warnings are advisory (this DS's structure is your choice): resolve or consciously accept. Re-run until the gate is clean, then proceed."
      : "No detector is enforced for this step yet — follow the markdown guidance and continue.",
  };
}

/** get_build_recipe — canonical build order + the actionable lint gate for a step. */
export async function getBuildRecipe(step?: string): Promise<unknown> {
  const s = step && step in STEP_GATES ? step : "all";
  const markdown = await readFile(`${SKILLS_DIR}canonical-structure.md`, "utf8");
  const idx = STEP_ORDER.indexOf(s);
  const next =
    s === "all" || idx < 0 || idx + 1 >= STEP_ORDER.length
      ? null
      : STEP_ORDER[idx + 1];
  return {
    step: s,
    markdown,
    lint_gate: buildGate(STEP_GATES[s]),
    next_step: next,
  };
}
