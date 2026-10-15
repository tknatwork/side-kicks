/**
 * Code-Connect-style resolution for local code mappings (set_code_mapping).
 * A mapping can say how a component's Figma properties become code props;
 * get_design_context then gives each mapped instance a snippet for its CURRENT
 * values and collapses its layers, so the agent uses the real component
 * instead of rebuilding it from frames. Pure functions: no Figma, no I/O.
 */

import type { TemplateJob, TemplateLayer, TemplateOutcome } from "./code-connect-runtime.js";

export type CodeValue = string | number | boolean | null;

export interface PropMapping {
  /** The code prop the Figma property feeds. */
  prop: string;
  /** Figma value → code value; values not listed pass through unchanged. */
  values?: Record<string, CodeValue>;
}

export interface CodeMapping {
  source: string;
  snippet?: string;
  language?: string;
  notes?: string;
  /** Code component name, e.g. "Button". Enables a resolved snippet. */
  component?: string;
  imports?: string[];
  /** Keyed by Figma property name (as get_design_context reports it). */
  props?: Record<string, PropMapping>;
  /** Figma TEXT property whose value becomes the element's children. */
  children?: string;
  /** A Code Connect template loaded by load_code_connect_templates. The
   *  bundle is only present when mappings are read with includeTemplates. */
  template?: { file: string; url?: string; hash: string; bundle?: string };
}

/** What the plugin attaches to INSTANCE nodes (describeInstances). */
export interface DescribedComponent {
  name?: string | null;
  key?: string | null;
  setKey?: string;
  properties?: Record<string, string | boolean>;
}

export interface ContextNode {
  id?: string;
  children?: ContextNode[];
  childCount?: number;
  component?: DescribedComponent;
  code?: Record<string, unknown>;
}

export interface MappingCoverage {
  matched: number;
  /** Components used here that have no mapping, most-used first. */
  unmapped: Array<{ name: string; instances: number }>;
}

/** Snippets are rendered as JSX only for these languages (or none given). */
const JSX_LANGUAGES = new Set(["tsx", "jsx"]);
const MAX_UNMAPPED_LISTED = 10;

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Code prop → value for the instance's current Figma property values. */
export const resolveProps = (
  mapping: CodeMapping,
  properties: Record<string, string | boolean>
): Record<string, CodeValue> => {
  const out: Record<string, CodeValue> = {};
  for (const [figmaName, pm] of Object.entries(mapping.props ?? {})) {
    if (!has(properties, figmaName)) continue;
    const raw = properties[figmaName];
    out[pm.prop] = pm.values && has(pm.values, String(raw)) ? pm.values[String(raw)] : raw;
  }
  return out;
};

const jsxAttribute = (name: string, value: CodeValue): string | null => {
  if (value === null || value === false) return null; // omitted, as React code would
  if (value === true) return name;
  if (typeof value === "number") return `${name}={${value}}`;
  return /^[^"{}<>\\\n]*$/.test(value) ? `${name}="${value}"` : `${name}={${JSON.stringify(value)}}`;
};

const jsxText = (text: string): string =>
  /^[^{}<>\n]+$/.test(text) && text.trim() === text ? text : `{${JSON.stringify(text)}}`;

export const renderJsx = (
  component: string,
  props: Record<string, CodeValue>,
  childText?: string
): string => {
  const attributes = Object.entries(props)
    .map(([name, value]) => jsxAttribute(name, value))
    .filter((a): a is string => a !== null);
  const open = [component, ...attributes].join(" ");
  return childText ? `<${open}>${jsxText(childText)}</${component}>` : `<${open} />`;
};

/** The `code` block for one mapped instance. */
export const codeFor = (
  mapping: CodeMapping,
  properties: Record<string, string | boolean>,
  matchedBy: string
): Record<string, unknown> => {
  const props = resolveProps(mapping, properties);
  const childValue = mapping.children !== undefined ? properties[mapping.children] : undefined;
  const childText = typeof childValue === "string" ? childValue : undefined;
  const asJsx =
    mapping.component !== undefined &&
    (mapping.language === undefined || JSX_LANGUAGES.has(mapping.language.toLowerCase()));
  return {
    source: mapping.source,
    ...(mapping.language ? { language: mapping.language } : {}),
    ...(mapping.imports && mapping.imports.length > 0 ? { imports: mapping.imports } : {}),
    ...(asJsx
      ? { snippet: renderJsx(mapping.component!, props, childText) }
      : {
          ...(mapping.snippet ? { snippet: mapping.snippet } : {}),
          // Other languages: the resolved values, for the agent to write in that language.
          ...(mapping.component !== undefined
            ? { component: mapping.component, props, ...(childText !== undefined ? { children: childText } : {}) }
            : {}),
        }),
    ...(mapping.notes ? { notes: mapping.notes } : {}),
    matchedBy,
  };
};

/** The mapping key an instance matches: component key, then set key, then name. */
export const matchMapping = (
  component: DescribedComponent | undefined,
  mappings: Record<string, CodeMapping>
): string | undefined =>
  component
    ? [component.key, component.setKey, component.name].find(
        (k): k is string => typeof k === "string" && k !== "" && has(mappings, k)
      )
    : undefined;

/** The `code` block for an instance whose template ran (or failed: then the
 *  props/static mapping stands in and the error is reported). */
const codeFromTemplate = (
  mapping: CodeMapping,
  properties: Record<string, string | boolean>,
  matchedBy: string,
  outcome: TemplateOutcome
): Record<string, unknown> => {
  const file = mapping.template?.file;
  if ("error" in outcome) {
    return { ...codeFor(mapping, properties, matchedBy), template: file, templateError: outcome.error };
  }
  return {
    source: mapping.source,
    language: outcome.language,
    ...(outcome.imports.length > 0 ? { imports: outcome.imports } : {}),
    snippet: outcome.snippet,
    ...(mapping.notes ? { notes: mapping.notes } : {}),
    matchedBy,
    template: file,
    ...(outcome.warnings.length > 0 ? { warnings: outcome.warnings } : {}),
  };
};

/**
 * Attaches `code` to every instance with a mapping (matched by component key,
 * then component-set key, then component name) and, unless `expandMapped`,
 * replaces its children with childCount — the snippet stands for them.
 * `rendered` holds Code Connect template output by instance id.
 * Mutates the tree; returns coverage for the instances it saw.
 */
export const applyCodeMappings = (
  roots: ContextNode[],
  mappings: Record<string, CodeMapping>,
  expandMapped = false,
  rendered: Record<string, TemplateOutcome> = {}
): MappingCoverage => {
  let matched = 0;
  const unmapped = new Map<string, number>();
  const visit = (node: ContextNode): void => {
    const c = node.component;
    if (c) {
      const hit = matchMapping(c, mappings);
      if (hit) {
        matched++;
        const outcome = node.id !== undefined && has(rendered, node.id) ? rendered[node.id] : undefined;
        node.code = outcome
          ? codeFromTemplate(mappings[hit], c.properties ?? {}, hit, outcome)
          : codeFor(mappings[hit], c.properties ?? {}, hit);
        if (!expandMapped && node.children) {
          node.childCount = node.children.length;
          delete node.children;
        }
      } else if (c.name) {
        unmapped.set(c.name, (unmapped.get(c.name) ?? 0) + 1);
      }
    }
    node.children?.forEach(visit);
  };
  roots.forEach(visit);
  return {
    matched,
    unmapped: [...unmapped.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_UNMAPPED_LISTED)
      .map(([name, instances]) => ({ name, instances })),
  };
};

/** True when any node in the tree is a described instance. */
export const hasDescribedInstances = (roots: ContextNode[]): boolean =>
  roots.some((n) => n.component !== undefined || hasDescribedInstances(n.children ?? []));

/** At most this many instances are rendered with templates per read; the
 *  rest fall back to their props/static mapping. */
export const MAX_TEMPLATE_RENDERS = 60;

/** Ids of instances whose mapping carries a template (with its bundle). */
export const templateTargets = (
  roots: ContextNode[],
  mappings: Record<string, CodeMapping>
): string[] => {
  const ids: string[] = [];
  const visit = (node: ContextNode): void => {
    const hit = matchMapping(node.component, mappings);
    if (hit && mappings[hit].template?.bundle && node.id !== undefined && ids.length < MAX_TEMPLATE_RENDERS) {
      ids.push(node.id);
    }
    node.children?.forEach(visit);
  };
  roots.forEach(visit);
  return ids;
};

/**
 * Everything the template runtime needs for these instance trees: each
 * template bundle once, which mapping key reaches it, and pre-rendered code for
 * nested instances whose mapping has no template (so a template can nest them).
 */
export const buildTemplateJob = (
  trees: Record<string, TemplateLayer>,
  mappings: Record<string, CodeMapping>
): TemplateJob => {
  const bundles: string[] = [];
  const byHash = new Map<string, number>();
  const templateFor: Record<string, number> = {};
  for (const [key, mapping] of Object.entries(mappings)) {
    const t = mapping.template;
    if (!t?.bundle) continue;
    let index = byHash.get(t.hash);
    if (index === undefined) {
      index = bundles.push(t.bundle) - 1;
      byHash.set(t.hash, index);
    }
    templateFor[key] = index;
  }
  const preRendered: TemplateJob["preRendered"] = {};
  const visit = (layer: TemplateLayer): void => {
    const hit = layer.type === "INSTANCE" ? matchMapping(layer.component, mappings) : undefined;
    if (hit && !mappings[hit].template?.bundle) {
      const code = codeFor(mappings[hit], layer.component?.properties ?? {}, hit);
      if (typeof code.snippet === "string") {
        preRendered[layer.id] = {
          snippet: code.snippet,
          ...(Array.isArray(code.imports) ? { imports: code.imports as string[] } : {}),
        };
      }
    }
    layer.children?.forEach(visit);
  };
  Object.values(trees).forEach(visit);
  return { bundles, templateFor, preRendered, trees };
};
