// Code Connect templates run locally: real *.figma.ts files are bundled with
// esbuild, executed in the sandbox against instance layers, and rendered by
// get_design_context through the real MCP SDK. Also: the loader's jail and the
// sandbox's isolation.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.HOME = mkdtempSync(path.join(tmpdir(), "limitless-cc-home-"));
const { loadTemplates, parseFigmaUrl, resolveTemplateRoot } = await import("../dist/code-connect-loader.js");
const { runTemplates } = await import("../dist/code-connect-runtime.js");
const { applyCodeMappings, buildTemplateJob } = await import("../dist/code-mapping.js");

// ---- fixture repo -------------------------------------------------------------
// loadTemplates expects a realpath'd root (resolveTemplateRoot does this in
// production); macOS tmpdir() sits behind the /var -> /private/var symlink.
const workspace = realpathSync(mkdtempSync(path.join(tmpdir(), "limitless-cc-ws-")));
const repo = path.join(workspace, "repo");
const write = (rel, text) => {
  mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  writeFileSync(path.join(repo, rel), text);
};
write("figma/Button.figma.ts", `// url=https://www.figma.com/design/FILEKEY/DS?node-id=1-2
// source=src/ui/button.tsx
// component=Button
import figma from 'figma'
import { sizes } from './shared'
const instance = figma.selectedInstance
const size: string = instance.getEnum('Size', sizes)
const disabled = instance.getBoolean('Disabled')
const icon = instance.getInstanceSwap('Icon')
let iconCode
if (icon && icon.type === 'INSTANCE') iconCode = icon.executeTemplate().example
export default {
  example: figma.tsx\`
    <Button
      size="\${size}"
      \${disabled ? 'disabled' : ''}
      \${iconCode ? figma.tsx\`icon={\${iconCode}}\` : ''}
    >
      \${instance.getString('Label')}
    </Button>
  \`,
  imports: ['import { Button } from "@/ui/button"'],
  id: 'button',
  metadata: { nestable: true },
}
`);
write("figma/shared.ts", `export const sizes = { Small: 'sm', Large: 'lg' } as const\n`);
write("figma/StarIcon.figma.ts", `import figma from 'figma'
export default { example: figma.tsx\`<StarIcon />\`, imports: ['import { StarIcon } from "@/icons"'], id: 'star' }
`);
write("figma/Card.figma.ts", `import figma from 'figma'
const i = figma.selectedInstance
const title = i.findText('Title')
const badge = i.findInstance('Badge', { traverseInstances: true })
export default {
  example: figma.tsx\`<Card title="\${title.type === 'TEXT' ? title.textContent : ''}">
  \${i.getSlot('Content')}
  \${badge.type === 'INSTANCE' ? badge.executeTemplate().example : ''}
</Card>\`,
  id: 'card',
}
`);
// The import must be used: TypeScript drops unused imports before resolving them.
write("figma/Bad.figma.ts", `import figma from 'figma'\nimport React from 'react'\nexport default { example: figma.code\`\${String(React)}\`, id: 'bad' }\n`);
writeFileSync(path.join(workspace, "outside.ts"), "export const x = 1\n");
write("figma/Escape.figma.ts", `import figma from 'figma'\nimport { x } from '../../outside'\nexport default { example: figma.code\`\${x}\`, id: 'escape' }\n`);
write("figma/Legacy.figma.tsx", "figma.connect(Button, 'url', {})\n");
write("node_modules/pkg/Ignored.figma.ts", "export default {}\n");

let loaded;
const templates = () => (loaded ??= loadTemplates(repo));
const bundleOf = async (name) => (await templates()).templates.find((t) => t.file.endsWith(name));

test("the loader bundles templates with their relative helpers and reads the headers", async () => {
  const { templates: list, skipped, errors } = await templates();
  assert.deepEqual(list.map((t) => t.file).sort(), ["figma/Button.figma.ts", "figma/Card.figma.ts", "figma/StarIcon.figma.ts"]);
  const button = await bundleOf("Button.figma.ts");
  assert.deepEqual(button.header, {
    url: "https://www.figma.com/design/FILEKEY/DS?node-id=1-2", source: "src/ui/button.tsx", component: "Button",
  });
  assert.deepEqual([button.fileKey, button.nodeId], ["FILEKEY", "1:2"]);
  assert.match(button.bundle, /Small: "sm"/, "the relative helper is bundled in");
  assert.match(button.bundle, /require\("figma"\)/, "figma stays external");
  assert.deepEqual(skipped.map((s) => s.file), ["figma/Legacy.figma.tsx"]);
  assert.match(skipped[0].reason, /figma connect migrate/);
  const byFile = Object.fromEntries(errors.map((e) => [e.file, e.error]));
  assert.match(byFile["figma/Bad.figma.ts"], /only 'figma' and relative files, not 'react'/);
  assert.match(byFile["figma/Escape.figma.ts"], /outside the template directory/);
});

test("figma URLs: file key, branch key and colon node id", () => {
  assert.deepEqual(parseFigmaUrl("https://figma.com/design/abc/Name?node-id=42-100"), { fileKey: "abc", nodeId: "42:100" });
  assert.deepEqual(parseFigmaUrl("https://www.figma.com/design/abc/branch/br1/Name?node-id=1-2"), { fileKey: "br1", nodeId: "1:2" });
  assert.deepEqual(parseFigmaUrl("not a url"), {});
});

test("the template directory must stay inside the working directory, symlinks included", async () => {
  assert.equal(await resolveTemplateRoot("repo", workspace), await resolveTemplateRoot(".", repo));
  await assert.rejects(resolveTemplateRoot("..", workspace), /inside the MCP server working directory/);
  symlinkSync(tmpdir(), path.join(workspace, "link-out"));
  await assert.rejects(resolveTemplateRoot("link-out", workspace), /inside the MCP server working directory/);
});

// ---- rendering --------------------------------------------------------------
const buttonTree = {
  id: "10:1", type: "INSTANCE", name: "Button",
  component: { name: "Button", setKey: "set-btn", properties: { Size: "Small", Disabled: true, Label: "Save", Icon: "77:1" },
    types: { Size: "VARIANT", Disabled: "BOOLEAN", Label: "TEXT", Icon: "INSTANCE_SWAP" } },
  children: [
    { id: "10:2", type: "INSTANCE", name: "Star", swapProp: "Icon", component: { name: "StarIcon", key: "k-star", properties: {}, types: {} } },
    { id: "10:3", type: "TEXT", name: "Label", characters: "Save" },
  ],
};
const cardTree = {
  id: "20:1", type: "INSTANCE", name: "Card",
  component: { name: "Card", key: "k-card", properties: {}, types: { Content: "SLOT" } },
  children: [
    { id: "20:2", type: "TEXT", name: "Title", characters: "Plan" },
    { id: "20:3", type: "SLOT", name: "Content", children: [
      { id: "20:4", type: "INSTANCE", name: "Avatar", component: { name: "Avatar", key: "k-av", properties: { Size: "Large" }, types: {} } },
      { id: "20:5", type: "INSTANCE", name: "Mystery", component: { name: "Mystery", key: "k-m", properties: {}, types: {} } },
    ] },
    { id: "20:6", type: "FRAME", name: "Footer", children: [
      { id: "20:7", type: "INSTANCE", name: "Pill", component: { name: "Pill", key: "k-pill", properties: {}, types: {} },
        children: [{ id: "20:8", type: "INSTANCE", name: "Badge", component: { name: "StarIcon", key: "k-star", properties: {}, types: {} } }] },
    ] },
  ],
};
const mappingsFor = async () => {
  const t = async (name) => {
    const b = await bundleOf(name);
    return { file: b.file, hash: b.hash, bundle: b.bundle };
  };
  return {
    "set-btn": { source: "src/ui/button.tsx", template: await t("Button.figma.ts") },
    "k-star": { source: "src/icons.tsx", template: await t("StarIcon.figma.ts") },
    "k-card": { source: "src/ui/card.tsx", template: await t("Card.figma.ts") },
    // A plain props mapping, nested inside a template's slot.
    "k-av": { source: "src/ui/avatar.tsx", component: "Avatar", props: { Size: { prop: "size", values: { Large: "lg" } } },
      imports: ["import { Avatar } from '@/ui/avatar'"] },
  };
};

test("a template renders the instance's current values, nesting other templates and their imports", async () => {
  const mappings = await mappingsFor();
  const out = runTemplates(buildTemplateJob({ "10:1": buttonTree }, mappings), ["10:1"]);
  assert.deepEqual(out["10:1"], {
    snippet: '<Button\n  size="sm"\n  disabled\n  icon={<StarIcon />}\n>\n  Save\n</Button>',
    language: "tsx",
    imports: ['import { Button } from "@/ui/button"', 'import { StarIcon } from "@/icons"'],
    id: "button",
    metadata: { nestable: true },
    warnings: [],
  });
});

test("findText, slots (with props-mapped and unmapped content) and traverseInstances", async () => {
  const mappings = await mappingsFor();
  const out = runTemplates(buildTemplateJob({ "20:1": cardTree }, mappings), ["20:1"]);
  assert.equal(out["20:1"].snippet, '<Card title="Plan">\n  <Avatar size="lg" />\n  <StarIcon />\n</Card>');
  assert.deepEqual(out["20:1"].imports, ["import { Avatar } from '@/ui/avatar'", 'import { StarIcon } from "@/icons"']);
  assert.deepEqual(out["20:1"].warnings, ["no code mapping for nested instance 'Mystery'"]);
});

test("the sandbox exposes no Node APIs and no way back to the host", async () => {
  const probe = `var figma = require('figma'); var r = [];
    [() => typeof process, () => typeof globalThis.require,
     () => this.constructor.constructor('return process')(),
     () => figma.selectedInstance.getString.constructor('return process')(),
     () => eval('1'), () => new Function('return 1')(), () => require('fs')]
    .forEach(function (f) { try { r.push(String(f())) } catch (e) { r.push('blocked') } });
    module.exports = { example: figma.code\`\${r.join(',')}\`, id: 'probe' };`;
  const tree = { id: "1:1", type: "INSTANCE", name: "P", component: { name: "Probe", properties: {} } };
  const out = runTemplates({ bundles: [probe], templateFor: { Probe: 0 }, preRendered: {}, trees: { "1:1": tree } }, ["1:1"]);
  assert.equal(out["1:1"].snippet, "undefined,undefined,blocked,blocked,blocked,blocked,blocked");
});

test("a hung or throwing template fails alone; the props mapping stands in", async () => {
  const hang = "require('figma'); for (;;) {}";
  const boom = "var figma = require('figma'); throw new Error('boom: ' + figma.selectedInstance.name);";
  const ok = "var figma = require('figma'); module.exports = { example: figma.code`fine`, id: 'ok' };";
  const tree = (id, name) => ({ id, type: "INSTANCE", name, component: { name, properties: { Size: "Small" } } });
  const t0 = Date.now();
  const out = runTemplates(
    { bundles: [hang, boom, ok], templateFor: { Hang: 0, Boom: 1, Ok: 2 }, preRendered: {},
      trees: { a: tree("a", "Hang"), b: tree("b", "Boom"), c: tree("c", "Ok") } },
    ["a", "b", "c"]
  );
  assert.match(out.a.error, /timed out/);
  assert.equal(out.b.error, "boom: Boom");
  assert.equal(out.c.snippet, "fine");
  assert.ok(Date.now() - t0 < 5_000);

  const roots = [{ id: "b", type: "INSTANCE", component: { name: "Boom", properties: { Size: "Small" } } }];
  applyCodeMappings(roots, { Boom: { source: "boom.tsx", component: "Boom", props: { Size: { prop: "size" } }, template: { file: "Boom.figma.ts", hash: "h" } } }, false, out);
  assert.deepEqual(roots[0].code, {
    source: "boom.tsx", snippet: '<Boom size="Small" />', matchedBy: "Boom", template: "Boom.figma.ts", templateError: "boom: Boom",
  });
});

// ---- end to end through the MCP SDK ----------------------------------------
const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
const { registerTools } = await import("../dist/tools.js");
const { Orchestrator } = await import("../dist/orchestration.js");

const orchestrator = new Orchestrator();
const sent = [];
const fakeNode = {
  agentSupplier: null,
  listConnectedFiles: () => [{ fileKey: "FILEKEY", fileName: "DS" }],
  send: (tool, ids, fileKey) => fakeNode.sendWithParams(tool, ids, {}, fileKey),
  sendWithParams: async (tool, nodeIds, params) => {
    sent.push(tool);
    const ok = (data) => ({ type: tool, requestId: "", data });
    if (["store_code_templates", "get_code_mappings", "set_code_mapping"].includes(tool)) {
      return ok(orchestrator.handleMeta(tool, { ...params, fileKey: "FILEKEY" }, []));
    }
    if (tool === "resolve_components") return ok({ components: Object.fromEntries(nodeIds.map((id) => [id, { setKey: "set-btn" }])) });
    if (tool === "describe_instance_trees") return ok({ trees: { "10:1": buttonTree } });
    if (tool === "get_design_context") {
      return ok({ context: [{ id: "0:1", type: "PAGE", children: [{ id: "10:1", type: "INSTANCE", name: "Button",
        component: { name: "Button", setKey: "set-btn", properties: buttonTree.component.properties }, children: [{ id: "10:3", type: "TEXT" }] }] }] });
    }
    throw new Error(`unexpected ${tool}`);
  },
};
const server = new McpServer({ name: "t", version: "0" });
registerTools(server, fakeNode, 0);
const client = new Client({ name: "c", version: "0" });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(b), client.connect(a)]);
after(async () => {
  await client.close();
  await server.close();
});
const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  assert.equal(res.isError, undefined, res.content?.[0]?.text);
  return JSON.parse(res.content[0].text);
};

test("load → get_design_context renders the template; agents never see the bundle", async () => {
  process.chdir(workspace);
  const result = await call("load_code_connect_templates", { dir: "repo" });
  const button = result.loaded.find((l) => l.file === "figma/Button.figma.ts");
  assert.deepEqual(button, { file: "figma/Button.figma.ts", target: "set-btn", matchedBy: "component set key", component: "Button" });
  assert.equal(result.loaded.find((l) => l.file === "figma/StarIcon.figma.ts").matchedBy, "file name");
  assert.equal(result.errors.length, 2);

  const listed = await call("get_code_mappings", {});
  assert.equal(listed.mappings["set-btn"].template.bundle, undefined);
  assert.equal(listed.mappings["set-btn"].template.file, "figma/Button.figma.ts");

  const ctx = await call("get_design_context", {});
  const instance = ctx.context[0].children[0];
  // StarIcon.figma.ts was keyed by its file name, which the nested icon's component name matches.
  assert.equal(instance.code.snippet, '<Button\n  size="sm"\n  disabled\n  icon={<StarIcon />}\n>\n  Save\n</Button>');
  assert.equal(instance.code.template, "figma/Button.figma.ts");
  assert.equal(instance.code.language, "tsx");
  assert.equal(instance.children, undefined, "the snippet replaces the layers");
  assert.ok(sent.includes("describe_instance_trees"));
});

test("editing a mapping's other fields keeps its template", async () => {
  await call("set_code_mapping", { target: "set-btn", source: "src/ui/button.tsx", notes: "primary CTA" });
  const listed = await call("get_code_mappings", { targets: ["set-btn"] });
  assert.equal(listed.mappings["set-btn"].template.file, "figma/Button.figma.ts");
  assert.equal(listed.mappings["set-btn"].notes, "primary CTA");
});
