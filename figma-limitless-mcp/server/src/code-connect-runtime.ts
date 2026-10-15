import vm from "node:vm";

/**
 * Runs Figma Code Connect templates (`*.figma.ts`, bundled by
 * code-connect-loader.ts) locally against an instance's layers, the way
 * Figma's own runtime renders them for Dev Mode and its MCP.
 *
 * Sandbox: templates are repo code an agent chose to load, so they run in a
 * separate vm context that holds NO host object. The runtime below is
 * serialized with toString() and evaluated inside it, data goes in as a JSON
 * literal, and only strings come back. String-to-code (eval / new Function)
 * is off and every run has a timeout. Node's vm is not a full security
 * boundary, which is why nothing from the host is handed in at all.
 */

/** A layer as describe_instance_trees reports it. */
export interface TemplateLayer {
  id: string;
  type: string;
  name: string;
  characters?: string;
  component?: {
    name?: string | null;
    variant?: string;
    key?: string | null;
    setKey?: string;
    properties?: Record<string, string | boolean>;
    types?: Record<string, string>;
  };
  swapProp?: string;
  children?: TemplateLayer[];
}

export interface TemplateJob {
  /** Bundled CommonJS code, one per template. */
  bundles: string[];
  /** Mapping lookup key (component key, set key or name) → index in bundles. */
  templateFor: Record<string, number>;
  /** Code for nested instances whose mapping has no template, by layer id. */
  preRendered: Record<string, { snippet: string; imports?: string[] }>;
  /** Instance id → its layers. */
  trees: Record<string, TemplateLayer>;
}

export interface TemplateRender {
  snippet: string;
  language: string;
  imports: string[];
  id?: string;
  metadata?: unknown;
  warnings: string[];
}

export type TemplateOutcome = TemplateRender | { error: string };

const BOOT_TIMEOUT_MS = 2_000;
const RENDER_TIMEOUT_MS = 1_000;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The in-sandbox runtime. Self-contained (no imports, no outer variables): it
 * is serialized and evaluated inside the vm context. Defines
 * globalThis.__ccRender(instanceId) → JSON string.
 */
function ccRuntime(DATA: any, TEMPLATES: any[]): void {
  const own = (o: any, k: any): boolean =>
    o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);
  const MAX_DEPTH = 6;
  let warnings: string[] = [];
  const warn = (message: string): void => {
    if (warnings.length < 50 && warnings.indexOf(message) < 0) warnings.push(message);
  };

  // Every layer by id, for slot sections that point at a layer.
  const layersById: Record<string, any> = {};
  const index = (layer: any): void => {
    layersById[layer.id] = layer;
    (layer.children || []).forEach(index);
  };
  Object.keys(DATA.trees).forEach((id) => index(DATA.trees[id]));

  const SECTION_TYPES = ["CODE", "INSTANCE", "SLOT", "ERROR"];
  const isSection = (v: any): boolean =>
    v !== null && typeof v === "object" && SECTION_TYPES.indexOf(v.type) >= 0 && !v.__handle__;
  const isTemplateResult = (v: any): boolean =>
    v !== null && typeof v === "object" && v.type === "SECTIONS" && Array.isArray(v.sections);

  const componentName = (layer: any): string =>
    (layer.component && layer.component.name) || layer.name;

  const templateIndex = (layer: any): number | undefined => {
    const c = layer.component;
    if (!c) return undefined;
    for (const k of [c.key, c.setKey, c.name]) {
      if (typeof k === "string" && k !== "" && own(DATA.templateFor, k)) return DATA.templateFor[k];
    }
    return undefined;
  };
  const preRendered = (layer: any): any => (own(DATA.preRendered, layer.id) ? DATA.preRendered[layer.id] : undefined);

  // ---- values → sections ---------------------------------------------------
  const fccToCode = (v: any): string => {
    switch (v.$type) {
      case "template-string":
        return "`" + v.$value + "`";
      case "object":
        return stringifyObject(v.$value);
      case "array":
        return "[" + (v.$value || []).map((x: any) => propValueCode(x)).join(", ") + "]";
      default:
        return String(v.$value);
    }
  };
  const isFcc = (v: any): boolean => v !== null && typeof v === "object" && typeof v.$type === "string" && "$value" in v;
  const propValueCode = (v: any): string => {
    if (isFcc(v)) return fccToCode(v);
    if (typeof v === "string") return JSON.stringify(v);
    return String(v);
  };
  const stringifyObject = (obj: any): string => {
    if (obj === null || typeof obj !== "object") return propValueCode(obj);
    const entries = Object.keys(obj).map((k) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${propValueCode(obj[k])}`);
    return entries.length ? `{ ${entries.join(", ")} }` : "{}";
  };

  const pushCode = (out: any[], code: string): void => {
    if (code === "") return;
    const last = out[out.length - 1];
    if (last && last.type === "CODE") last.code += code;
    else out.push({ type: "CODE", code });
  };
  const toSections = (value: any, out: any[]): void => {
    if (value === undefined || value === null) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      pushCode(out, String(value));
    } else if (isTemplateResult(value)) {
      value.sections.forEach((s: any) => toSections(s, out));
    } else if (Array.isArray(value)) {
      value.forEach((v) => toSections(v, out));
    } else if (value.__handle__ === "INSTANCE") {
      toSections(value.executeTemplate().example, out);
    } else if (value.__handle__ === "TEXT") {
      pushCode(out, value.textContent);
    } else if (value.__handle__ === "ERROR") {
      out.push({ type: "ERROR", message: value.message });
    } else if (isSection(value)) {
      if (value.type === "CODE") pushCode(out, String(value.code));
      else out.push(value);
    } else if (isFcc(value)) {
      pushCode(out, fccToCode(value));
    } else if (value.type === "VALUE" && "value" in value) {
      toSections(value.value, out);
    } else {
      warn("a template interpolated an object that is not code (rendered as text)");
      pushCode(out, String(value));
    }
  };
  const tag =
    (language: string) =>
    (strings: any, ...values: any[]): any => {
      const sections: any[] = [];
      for (let i = 0; i < strings.length; i++) {
        pushCode(sections, strings[i]);
        if (i < values.length) toSections(values[i], sections);
      }
      return { type: "SECTIONS", language, sections };
    };

  // ---- handles ---------------------------------------------------------------
  const errorHandle = (message: string): any => ({
    __handle__: "ERROR",
    type: "ERROR",
    message,
    __render__: () => [{ type: "ERROR", message }],
    executeTemplate: () => ({ example: [{ type: "ERROR", message }] }),
  });
  const textHandle = (layer: any, path: string[]): any => ({
    __handle__: "TEXT",
    type: "TEXT",
    name: layer.name,
    textContent: layer.characters || "",
    path,
    __render__: () => layer.characters || "",
  });

  /** Ordered-subsequence match of `want` within the ancestor names `have`. */
  const pathMatches = (have: string[], want: any): boolean => {
    if (!Array.isArray(want) || want.length === 0) return true;
    let i = 0;
    for (const name of have) if (name === want[i]) i++;
    return i === want.length;
  };
  /** Descendants with their ancestor-name paths; stops at nested instances
   *  unless traverseInstances. */
  const descendants = (root: any, opts: any): Array<{ layer: any; path: string[] }> => {
    const found: Array<{ layer: any; path: string[] }> = [];
    const walk = (node: any, path: string[]): void => {
      for (const child of node.children || []) {
        if (pathMatches(path, opts && opts.path)) found.push({ layer: child, path });
        const descend = child.type !== "INSTANCE" || (opts && opts.traverseInstances === true);
        if (descend) walk(child, path.concat([child.name]));
      }
    };
    walk(root, []);
    return found;
  };

  const templateCache: Record<string, any> = {};
  const runTemplate = (t: number, layer: any, depth: number): any => {
    const cacheKey = `${t}:${layer.id}`;
    if (own(templateCache, cacheKey)) return templateCache[cacheKey];
    const module: any = { exports: {} };
    const figma = makeFigma(layer, depth);
    const req = (name: string): any => {
      if (name === "figma") return figma;
      throw new Error(`a template may only import 'figma', not '${name}'`);
    };
    TEMPLATES[t](req, module, module.exports);
    const exported = module.exports;
    const out = exported && exported.default !== undefined ? exported.default : exported;
    if (!out || typeof out !== "object" || out.example === undefined) {
      throw new Error("the template must export default { example, ... }");
    }
    templateCache[cacheKey] = out;
    return out;
  };

  const executeTemplate = (layer: any, depth: number): any => {
    const symbolId = (layer.component && (layer.component.setKey || layer.component.key)) || "";
    if (depth > MAX_DEPTH) {
      return { example: [{ type: "ERROR", message: "Code Connect templates nest too deep" }] };
    }
    const t = templateIndex(layer);
    if (t !== undefined) {
      try {
        const out = runTemplate(t, layer, depth + 1);
        const sections: any[] = [];
        toSections(out.example, sections);
        const imports = Array.isArray(out.imports) ? out.imports.filter((x: any) => typeof x === "string") : [];
        const metadata = out.metadata && typeof out.metadata === "object" ? out.metadata : {};
        return {
          example: [{ type: "INSTANCE", guid: layer.id, symbolId, resultSections: sections, nestedImports: imports }],
          metadata: Object.assign({}, metadata, { __props: metadata.props || {} }),
        };
      } catch (e: any) {
        return { example: [{ type: "ERROR", message: `${componentName(layer)}: ${e && e.message}` }] };
      }
    }
    const pre = preRendered(layer);
    if (pre) {
      return {
        example: [
          { type: "INSTANCE", guid: layer.id, symbolId, resultSections: [{ type: "CODE", code: pre.snippet }], nestedImports: pre.imports || [] },
        ],
        metadata: { __props: {} },
      };
    }
    warn(`no code mapping for nested instance '${componentName(layer)}'`);
    return { example: [{ type: "INSTANCE", guid: layer.id, symbolId, resultSections: [] }], metadata: { __props: {} } };
  };

  const instanceHandle = (layer: any, depth: number, path?: string[]): any => {
    const c = layer.component || {};
    const props: Record<string, any> = c.properties || {};
    const types: Record<string, string> = c.types || {};
    const name = componentName(layer);
    const slotLayers = (): any[] =>
      descendants(layer, {}).map((d) => d.layer).filter((l: any) => l.type === "SLOT");

    const handle: any = {
      __handle__: "INSTANCE",
      type: "INSTANCE",
      id: layer.id,
      name: layer.name,
      symbolId: c.setKey || c.key || "",
      path,
      get properties() {
        const out: Record<string, { value: any }> = {};
        Object.keys(props).forEach((k) => (out[k] = { value: props[k] }));
        return out;
      },
      get children() {
        const out: any[] = [];
        const walk = (node: any, p: string[]): void => {
          for (const child of node.children || []) {
            if (child.type === "INSTANCE") out.push(instanceHandle(child, depth, p));
            else if (child.type === "TEXT") out.push(textHandle(child, p));
            else walk(child, p.concat([child.name]));
          }
        };
        walk(layer, []);
        return out;
      },
      getPropertyValue(prop: string): any {
        return own(props, prop) ? props[prop] : errorHandle(`'${name}' has no property '${prop}'`);
      },
      getString(prop: string): string {
        const v = props[prop];
        if (typeof v === "string") return v;
        warn(`'${name}' has no text property '${prop}'`);
        return "";
      },
      getBoolean(prop: string, mapping?: any): any {
        const v = props[prop];
        let b: boolean;
        if (typeof v === "boolean") b = v;
        else if (typeof v === "string" && /^(true|false)$/i.test(v)) b = v.toLowerCase() === "true";
        else {
          warn(`'${name}' has no boolean property '${prop}'`);
          b = false;
        }
        if (mapping && typeof mapping === "object") return mapping[b ? "true" : "false"];
        return b;
      },
      getEnum(prop: string, mapping: any): any {
        if (!own(props, prop)) {
          warn(`'${name}' has no property '${prop}'`);
          return undefined;
        }
        const v = String(props[prop]);
        if (own(mapping, v)) return mapping[v];
        warn(`'${name}' property '${prop}' is '${v}', which the template's mapping doesn't list`);
        return undefined;
      },
      getInstanceSwap(prop: string): any {
        const hit = descendants(layer, {}).find((d) => d.layer.type === "INSTANCE" && d.layer.swapProp === prop);
        return hit ? instanceHandle(hit.layer, depth, hit.path) : undefined;
      },
      getSlot(prop: string): any {
        const slots = slotLayers();
        const slotProps = Object.keys(types).filter((k) => types[k] === "SLOT");
        // No layer↔property link in the Plugin API: same name, else the only
        // pair, else document order.
        let slot = slots.find((s: any) => s.name === prop);
        if (!slot && slots.length === 1 && slotProps.length === 1 && slotProps[0] === prop) slot = slots[0];
        if (!slot && slotProps.indexOf(prop) >= 0) slot = slots[slotProps.indexOf(prop)];
        if (!slot) return undefined;
        const result: any = [{ type: "SLOT", guid: slot.id, propertyName: prop }];
        Object.defineProperty(result, "connectedInstances", {
          value: (slot.children || [])
            .filter((l: any) => l.type === "INSTANCE" && (templateIndex(l) !== undefined || preRendered(l)))
            .map((l: any) => instanceHandle(l, depth)),
        });
        return result;
      },
      hasCodeConnect(): boolean {
        return templateIndex(layer) !== undefined || preRendered(layer) !== undefined;
      },
      codeConnectId(): string | null {
        const t = templateIndex(layer);
        if (t === undefined) return null;
        try {
          const out = runTemplate(t, layer, depth + 1);
          return typeof out.id === "string" ? out.id : null;
        } catch {
          return null;
        }
      },
      findInstance(layerName: string, opts?: any): any {
        const hit = descendants(layer, opts).find((d) => d.layer.type === "INSTANCE" && d.layer.name === layerName);
        return hit ? instanceHandle(hit.layer, depth, hit.path) : errorHandle(`no instance layer named '${layerName}' in '${name}'`);
      },
      findText(layerName: string, opts?: any): any {
        const hit = descendants(layer, opts).find((d) => d.layer.type === "TEXT" && d.layer.name === layerName);
        return hit ? textHandle(hit.layer, hit.path) : errorHandle(`no text layer named '${layerName}' in '${name}'`);
      },
      findConnectedInstance(id: string, opts?: any): any {
        for (const d of descendants(layer, opts)) {
          if (d.layer.type !== "INSTANCE") continue;
          const h = instanceHandle(d.layer, depth, d.path);
          if (h.codeConnectId() === id) return h;
        }
        return errorHandle(`no connected instance with id '${id}' in '${name}'`);
      },
      findConnectedInstances(selector: any, opts?: any): any[] {
        return descendants(layer, opts)
          .filter((d) => d.layer.type === "INSTANCE")
          .map((d) => instanceHandle(d.layer, depth, d.path))
          .filter((h) => h.hasCodeConnect() && selector(h));
      },
      findLayers(selector: any, opts?: any): any[] {
        return descendants(layer, opts)
          .filter((d) => d.layer.type === "INSTANCE" || d.layer.type === "TEXT")
          .map((d) => (d.layer.type === "INSTANCE" ? instanceHandle(d.layer, depth, d.path) : textHandle(d.layer, d.path)))
          .filter((h) => selector(h));
      },
      executeTemplate(): any {
        return executeTemplate(layer, depth);
      },
      __render__(): any {
        return executeTemplate(layer, depth).example;
      },
    };
    return handle;
  };

  const makeFigma = (layer: any, depth: number): any => {
    const selected = instanceHandle(layer, depth);
    const properties = {
      string: (p: string) => selected.getString(p),
      boolean: (p: string, o?: any) => selected.getBoolean(p, o),
      enum: (p: string, o: any) => selected.getEnum(p, o),
      instance: (p: string) => {
        const h = selected.getInstanceSwap(p);
        return h ? h.executeTemplate().example : undefined;
      },
      slot: (p: string) => selected.getSlot(p),
      children: (names: string[]) => {
        const out: any[] = [];
        for (const h of selected.children) {
          if (h.type === "INSTANCE" && names.indexOf(h.name) >= 0) toSections(h.executeTemplate().example, out);
        }
        return out;
      },
    };
    selected.__properties__ = properties;
    const renderChildrenWithPrefix = (children: any, prefix: string): any[] => {
      const out: any[] = [];
      toSections(children, out);
      return out.map((s) => (s.type === "CODE" ? { type: "CODE", code: s.code.replace(/\n/g, "\n" + prefix) } : s));
    };
    return {
      selectedInstance: selected,
      currentLayer: selected,
      properties,
      batch: {},
      code: tag("raw"),
      tsx: tag("tsx"),
      html: tag("html"),
      swift: tag("swift"),
      kotlin: tag("kotlin"),
      value: (raw: any, preview: any) => ({ type: "VALUE", value: raw, preview }),
      // Approximations of Figma's helpers, enough for templates migrated from
      // the parser-based format.
      helpers: {
        react: {
          renderProp(name: string, prop: any): any {
            if (prop === undefined || prop === null || prop === false) return "";
            if (prop === true) return ` ${name}`;
            if (typeof prop === "string") return ` ${name}=${JSON.stringify(prop)}`;
            if (typeof prop === "number") return ` ${name}={${prop}}`;
            if (isFcc(prop)) return ` ${name}={${fccToCode(prop)}}`;
            return tag("tsx")([` ${name}={`, "}"], prop);
          },
          renderChildren(prop: any): any {
            if (isFcc(prop)) return fccToCode(prop);
            return prop === undefined || prop === null ? "" : prop;
          },
          renderPropValue(prop: any): any {
            if (isFcc(prop)) return fccToCode(prop);
            if (typeof prop === "string") return JSON.stringify(prop);
            return prop;
          },
          stringifyObject,
          jsxElement: (v: string) => ({ $value: v, $type: "jsx-element" }),
          function: (v: string) => ({ $value: v, $type: "function" }),
          identifier: (v: string) => ({ $value: v, $type: "identifier" }),
          object: (v: any) => ({ $value: v, $type: "object" }),
          templateString: (v: string) => ({ $value: v, $type: "template-string" }),
          reactComponent: (v: string) => ({ $value: v, $type: "react-component" }),
          array: (v: any[]) => ({ $value: v, $type: "array" }),
          isReactComponentArray: (prop: any) => Array.isArray(prop) && prop.every((p: any) => isSection(p) || Array.isArray(p)),
        },
        swift: { renderChildren: (children: any, prefix: string) => renderChildrenWithPrefix(children, prefix) },
        kotlin: { renderChildren: (children: any, prefix: string) => renderChildrenWithPrefix(children, prefix) },
      },
    };
  };

  // ---- sections → text -------------------------------------------------------
  const tidy = (text: string): string => {
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    const indent = lines.reduce((min, l) => Math.min(min, (l.match(/^[ \t]*/) as any)[0].length), Infinity);
    return lines.map((l) => l.slice(indent === Infinity ? 0 : indent)).join("\n").trim();
  };
  const render = (sections: any[], imports: string[]): string => {
    let out = "";
    const append = (text: string): void => {
      if (text.indexOf("\n") < 0) {
        out += text;
        return;
      }
      // Indent a multi-line nested snippet to where it's interpolated.
      const lastLine = out.slice(out.lastIndexOf("\n") + 1);
      const indent = (lastLine.match(/^[ \t]*/) as any)[0];
      out += text.replace(/\n/g, "\n" + indent);
    };
    for (const s of sections) {
      if (s.type === "CODE") out += s.code;
      else if (s.type === "INSTANCE") {
        (s.nestedImports || []).forEach((i: string) => imports.push(i));
        append(tidy(render(s.resultSections || [], imports)));
      } else if (s.type === "SLOT") {
        const slot = layersById[s.guid];
        const parts: string[] = [];
        for (const child of (slot && slot.children) || []) {
          if (child.type === "INSTANCE") {
            parts.push(tidy(render(executeTemplate(child, 1).example, imports)));
          } else if (child.type === "TEXT") {
            parts.push(child.characters || "");
          }
        }
        if (!slot) warn(`slot '${s.propertyName}' was not found`);
        append(parts.filter((p) => p !== "").join("\n"));
      } else if (s.type === "ERROR") {
        warn(String(s.message));
      }
    }
    return out;
  };

  (globalThis as any).__ccRender = (instanceId: string): string => {
    warnings = [];
    try {
      const layer = DATA.trees[instanceId];
      if (!layer) return JSON.stringify({ error: "instance layers were not provided" });
      const t = templateIndex(layer);
      if (t === undefined) return JSON.stringify({ error: "no template for this instance" });
      const out = runTemplate(t, layer, 0);
      const sections: any[] = [];
      toSections(out.example, sections);
      const imports: string[] = Array.isArray(out.imports) ? out.imports.filter((x: any) => typeof x === "string") : [];
      const snippet = tidy(render(sections, imports));
      let metadata: unknown;
      try {
        metadata = out.metadata === undefined ? undefined : JSON.parse(JSON.stringify(out.metadata));
      } catch {
        metadata = undefined;
      }
      return JSON.stringify({
        snippet,
        language: isTemplateResult(out.example) ? out.example.language : "raw",
        imports: imports.filter((x, i) => imports.indexOf(x) === i),
        ...(typeof out.id === "string" ? { id: out.id } : {}),
        ...(metadata === undefined ? {} : { metadata }),
        warnings,
      });
    } catch (e: any) {
      let message = "template failed";
      try {
        message = String(e && e.message !== undefined ? e.message : e);
      } catch {
        /* a hostile error object: keep the generic message */
      }
      return JSON.stringify({ error: message });
    }
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** An error's message as a plain data property — never through a getter,
 *  since the error may come from the sandbox's realm. */
const errorMessage = (err: unknown): string => {
  if (err !== null && typeof err === "object") {
    const message = Object.getOwnPropertyDescriptor(err, "message")?.value;
    if (typeof message === "string") return message;
  }
  return "template failed";
};

/** A context with no host object in it: a fresh realm's own global where Node
 *  supports it, else a prototype-less object (a plain `{}` would hand the
 *  sandbox the host's Object and, through it, the host's Function). */
const createSandbox = (): vm.Context => {
  const dontContextify = (vm as unknown as { constants?: { DONT_CONTEXTIFY?: symbol } }).constants
    ?.DONT_CONTEXTIFY;
  const contextObject = (dontContextify ?? Object.create(null)) as vm.Context;
  return vm.createContext(contextObject, {
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: "afterEvaluate",
  });
};

/**
 * Renders the given instances with their templates. Every instance id must
 * have a tree in job.trees and a template reachable through job.templateFor.
 * Failures are per instance and never throw.
 */
export const runTemplates = (job: TemplateJob, instanceIds: string[]): Record<string, TemplateOutcome> => {
  const results: Record<string, TemplateOutcome> = {};
  const fail = (message: string): Record<string, TemplateOutcome> => {
    for (const id of instanceIds) results[id] = { error: message };
    return results;
  };
  const data = { templateFor: job.templateFor, preRendered: job.preRendered, trees: job.trees };
  const templates = job.bundles
    .map((code) => `function (require, module, exports) {\n${code}\n}`)
    .join(",\n");
  const bootstrap =
    `(function () { try { (${ccRuntime.toString()})(${JSON.stringify(data)}, [${templates}]); return "ok"; }` +
    ` catch (e) { try { return "error: " + String(e && e.message); } catch (_) { return "error"; } } })()`;

  let context: vm.Context;
  try {
    context = createSandbox();
    const status: unknown = new vm.Script(bootstrap, { filename: "code-connect-templates.js" }).runInContext(context, {
      timeout: BOOT_TIMEOUT_MS,
    });
    if (status !== "ok") return fail(typeof status === "string" ? status : "templates failed to load");
  } catch (err) {
    return fail(`templates failed to load: ${errorMessage(err)}`);
  }

  for (const id of instanceIds) {
    try {
      const json: unknown = new vm.Script(`__ccRender(${JSON.stringify(id)})`).runInContext(context, {
        timeout: RENDER_TIMEOUT_MS,
      });
      results[id] = typeof json === "string" ? (JSON.parse(json) as TemplateOutcome) : { error: "template returned no result" };
    } catch (err) {
      // Only engine errors get here (the runtime catches its own), e.g. the
      // timeout; read the message without triggering any getter.
      results[id] = { error: errorMessage(err) };
    }
  }
  return results;
};
