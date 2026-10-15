import { createHash } from "node:crypto";
import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

/**
 * Finds and bundles Figma Code Connect template files (`*.figma.ts` /
 * `*.figma.js`, the parserless format of Code Connect CLI v2) so
 * code-connect-runtime.ts can run them locally.
 *
 * A template may import only `figma` and relative helper files, and nothing
 * outside the directory it was loaded from (symlinks included).
 */

export interface TemplateHeader {
  /** Figma URL of the component, from `// url=`. */
  url?: string;
  /** Code location, from `// source=`. */
  source?: string;
  /** Code component name, from `// component=`. */
  component?: string;
}

export interface LoadedTemplate {
  /** Path relative to the root it was loaded from. */
  file: string;
  header: TemplateHeader;
  /** The url's file key and node id (colon form), when the url parses. */
  fileKey?: string;
  nodeId?: string;
  /** Self-contained CommonJS bundle; `figma` stays an external require. */
  bundle: string;
  hash: string;
}

export interface LoadResult {
  templates: LoadedTemplate[];
  skipped: Array<{ file: string; reason: string }>;
  errors: Array<{ file: string; error: string }>;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", ".next", ".turbo"]);
const MAX_TEMPLATES = 500;
const MAX_BUNDLE_CHARS = 512_000;

/** `// url=…`, `// source=…`, `// component=…` from the file's leading comments. */
export const parseHeader = (code: string): TemplateHeader => {
  const header: TemplateHeader = {};
  for (const line of code.split("\n").slice(0, 30)) {
    const m = line.match(/^\s*\/\/\s*(url|source|component)\s*=\s*(.+?)\s*$/);
    if (m) header[m[1] as keyof TemplateHeader] = m[2];
  }
  return header;
};

/** File key (the branch key for branch URLs) and node id from a Figma URL. */
export const parseFigmaUrl = (url: string): { fileKey?: string; nodeId?: string } => {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const at = parts.findIndex((p) => p === "design" || p === "file" || p === "board" || p === "slides");
    let fileKey = at >= 0 ? parts[at + 1] : undefined;
    if (at >= 0 && parts[at + 2] === "branch" && parts[at + 3]) fileKey = parts[at + 3];
    const rawNode = u.searchParams.get("node-id");
    const nodeId = rawNode ? rawNode.replace(/-/g, ":") : undefined;
    return { ...(fileKey ? { fileKey } : {}), ...(nodeId && /^\d+:\d+$/.test(nodeId) ? { nodeId } : {}) };
  } catch {
    return {};
  }
};

/** The component name a template is keyed by when its url can't be resolved:
 *  the file name, e.g. `Button.figma.ts` → `Button`. */
export const nameFromFile = (file: string): string => path.basename(file).replace(/\.figma\.(ts|js)$/, "");

const isInside = (root: string, target: string): boolean => {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

/** Template files under root, without following symlinked directories. */
export const findTemplateFiles = async (
  root: string
): Promise<{ files: string[]; skipped: LoadResult["skipped"] }> => {
  const files: string[] = [];
  const skipped: LoadResult["skipped"] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full);
      } else if (entry.isFile()) {
        if (/\.figma\.(ts|js)$/.test(entry.name)) {
          if (files.length < MAX_TEMPLATES) files.push(full);
          else skipped.push({ file: path.relative(root, full), reason: `more than ${MAX_TEMPLATES} templates` });
        } else if (/\.figma\.(tsx|jsx)$/.test(entry.name)) {
          skipped.push({
            file: path.relative(root, full),
            reason: "parser-based Code Connect (figma.connect), deprecated in CLI v2 — `figma connect migrate` converts it to a .figma.ts template",
          });
        }
      }
    }
  };
  await walk(root);
  return { files: files.sort(), skipped };
};

/** Bundles one template into a CommonJS string with `figma` left external.
 *  Bare imports other than `figma`, and files outside root, are refused. */
export const bundleTemplate = async (file: string, root: string): Promise<string> => {
  const esbuild = await import("esbuild");
  const result = await esbuild.build({
    entryPoints: [file],
    absWorkingDir: root,
    bundle: true,
    write: false,
    format: "cjs",
    platform: "neutral",
    target: "es2020",
    logLevel: "silent",
    plugins: [
      {
        name: "code-connect-jail",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === "entry-point") return undefined;
            if (args.path === "figma") return { path: "figma", external: true };
            if (args.path.startsWith("./") || args.path.startsWith("../")) return undefined;
            return {
              errors: [{ text: `a template may import only 'figma' and relative files, not '${args.path}'` }],
            };
          });
          build.onLoad({ filter: /.*/ }, async (args) => {
            const real = await realpath(args.path);
            if (!isInside(root, real)) {
              return { errors: [{ text: `${args.path} is outside the template directory` }] };
            }
            return undefined;
          });
        },
      },
    ],
  });
  const code = result.outputFiles[0]?.text ?? "";
  if (code.length > MAX_BUNDLE_CHARS) {
    throw new Error(`bundle is ${code.length} characters (limit ${MAX_BUNDLE_CHARS})`);
  }
  return code;
};

/** Finds, parses and bundles every template under root (already jailed and
 *  realpath'd by the caller). Per-file failures are collected, not thrown. */
export const loadTemplates = async (root: string): Promise<LoadResult> => {
  const { files, skipped } = await findTemplateFiles(root);
  const templates: LoadedTemplate[] = [];
  const errors: LoadResult["errors"] = [];
  for (const full of files) {
    const file = path.relative(root, full);
    try {
      const header = parseHeader(await readFile(full, "utf8"));
      const bundle = await bundleTemplate(full, root);
      const { fileKey, nodeId } = header.url ? parseFigmaUrl(header.url) : {};
      templates.push({
        file,
        header,
        ...(fileKey ? { fileKey } : {}),
        ...(nodeId ? { nodeId } : {}),
        bundle,
        hash: createHash("sha256").update(bundle).digest("hex").slice(0, 16),
      });
    } catch (err) {
      const esbuildErrors = (err as { errors?: Array<{ text: string }> }).errors;
      errors.push({
        file,
        error: esbuildErrors?.length
          ? esbuildErrors.map((e) => e.text).join("; ")
          : err instanceof Error
            ? err.message
            : String(err),
      });
    }
  }
  return { templates, skipped, errors };
};

/** The directory to load from: inside the server's working directory, after
 *  resolving symlinks. */
export const resolveTemplateRoot = async (dir: string, workspaceRoot: string): Promise<string> => {
  const workspace = await realpath(workspaceRoot);
  const root = await realpath(path.resolve(workspace, dir));
  if (!isInside(workspace, root)) {
    throw new Error(`dir must be inside the MCP server working directory: ${workspace}`);
  }
  return root;
};
