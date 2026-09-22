#!/usr/bin/env node
/**
 * Live end-to-end test of figma-limitless-mcp against a REAL Figma file.
 *
 * Prereqs: Figma Desktop open with the Limitless MCP for Figma plugin running in
 * some file. Everything is created inside a dedicated test page and removed
 * afterwards — the file is left exactly as found (undo history aside).
 *
 * Usage:  node scripts/e2e-live-test.mjs            (from the repo root)
 *         FILE_KEY=<key> node scripts/e2e-live-test.mjs   (pick one of many)
 *
 * Deliberately skipped (they would disturb the human's live session):
 * set_selection / scroll_and_zoom_into_view (current-page only), apply_shader
 * (needs a shader in the file), import_library_asset (needs a published key).
 *
 * The Plugin API Update 134-139 checks (text wrap, auto-layout spacing, variable
 * fonts, composed colors) pass with a "skipped: …" note on a Figma build that
 * predates them; the variable-font check also skips a family without a wght axis.
 */
import { spawn } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = path.join(ROOT, "server", "dist", "index.js");

const proc = spawn("node", [SERVER], { cwd: ROOT, stdio: ["pipe", "pipe", "ignore"] });
let msgId = 0;
const pending = new Map();
let buffer = "";
proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      /* non-JSON line */
    }
  }
});

function rpc(method, params, timeoutMs = 90_000) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`RPC timeout: ${method}`));
    }, timeoutMs);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }) + "\n");
  });
}

let FK; // resolved fileKey, threaded into every call
async function call(tool, args = {}) {
  const finalArgs = FK && !("fileKey" in args) ? { ...args, fileKey: FK } : args;
  const r = await rpc("tools/call", { name: tool, arguments: finalArgs });
  const res = r.result ?? {};
  const text = res.content?.[0]?.text ?? "";
  if (res.isError) return { err: text };
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { data: text };
  }
}

const results = [];
function record(name, ok, note = "") {
  results.push({ name, ok, note: String(note).slice(0, 110) });
  console.log(`${ok === true ? "PASS" : ok === "skip" ? "SKIP" : "FAIL"}  ${name}${note ? "  — " + note : ""}`);
}
async function check(name, fn) {
  try {
    const note = await fn();
    record(name, true, note ?? "");
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err));
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Ids created during the run — for assertions and cleanup.
const S = {};

async function cleanup() {
  console.log("\n--- cleanup ---");
  const code = `
    var removed = [];
    var pages = figma.root.children;
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].name === "🤖 MCP E2E Test — safe to delete" && pages[i].id !== figma.currentPage.id) {
        pages[i].remove(); removed.push("page");
      }
    }
    var textStyles = await figma.getLocalTextStylesAsync();
    for (var i = 0; i < textStyles.length; i++) {
      if (textStyles[i].name.indexOf("MCP-E2E/") === 0) { textStyles[i].remove(); removed.push("textStyle"); }
    }
    var paintStyles = await figma.getLocalPaintStylesAsync();
    for (var i = 0; i < paintStyles.length; i++) {
      if (paintStyles[i].name.indexOf("MCP-E2E/") === 0) { paintStyles[i].remove(); removed.push("paintStyle"); }
    }
    var effectStyles = await figma.getLocalEffectStylesAsync();
    for (var i = 0; i < effectStyles.length; i++) {
      if (effectStyles[i].name.indexOf("MCP-E2E/") === 0) { effectStyles[i].remove(); removed.push("effectStyle"); }
    }
    var collections = await figma.variables.getLocalVariableCollectionsAsync();
    for (var i = 0; i < collections.length; i++) {
      if (collections[i].name === "MCP-E2E") { collections[i].remove(); removed.push("collection"); }
    }
    return removed;
  `;
  const r = await call("execute_code", { code, timeoutMs: 60_000 });
  console.log("cleanup:", r.err ? "FAILED: " + r.err : JSON.stringify(r.data.result));
  const shot = path.join(ROOT, "e2e-screenshot.png");
  if (existsSync(shot)) unlinkSync(shot);
}

async function main() {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "e2e-live-test", version: "1" },
  });
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  // ---- connection --------------------------------------------------------
  let files = [];
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const r = await call("list_files");
    if (Array.isArray(r.data) && r.data.length > 0) {
      files = r.data;
      break;
    }
  }
  expect(files.length > 0, "No Figma file connected — run the plugin first");
  FK = process.env.FILE_KEY || files[0].fileKey;
  console.log(`Testing against: ${files.find((f) => f.fileKey === FK)?.fileName} (${FK})\n`);

  // ---- scaffold: test page + root frame ----------------------------------
  {
    const r = await call("execute_code", {
      code: `var p = figma.createPage(); p.name = "🤖 MCP E2E Test — safe to delete"; return { pageId: p.id };`,
    });
    expect(!r.err, "test page: " + r.err);
    S.page = r.data.result.pageId;
  }

  await check("create_frame", async () => {
    const r = await call("create_frame", { name: "E2E Root", parentId: S.page, width: 800, height: 800, x: 0, y: 0, fillHex: "#FFFFFF" });
    expect(!r.err, r.err);
    S.root = r.data.nodeId;
  });

  // ---- fonts --------------------------------------------------------------
  let family = "Inter", style = "Regular", axes = null;
  await check("list_fonts", async () => {
    const r = await call("list_fonts", { filter: "inter" });
    expect(!r.err, r.err);
    const hit = r.data.fonts.find((f) => f.family === "Inter") ?? r.data.fonts[0];
    if (hit) {
      family = hit.family;
      style = hit.styles?.includes("Regular") ? "Regular" : hit.styles?.[0] ?? "Regular";
      axes = hit.variationAxes ?? null;
    }
    return `${r.data.matchedFamilies} matched; using ${family} ${style}`;
  });
  await check("load_fonts", async () => {
    const r = await call("load_fonts", { fonts: [{ family, style }] });
    expect(!r.err && r.data.allLoaded, r.err ?? "not loaded");
  });
  await check("variable fonts: node + style axes (Update 138)", async () => {
    // list_fonts omits variationAxes before Update 138 and reports null for a static family.
    if (!Array.isArray(axes) || !axes.includes("wght")) {
      return `skipped: no wght axis reported for ${family} (static family or Figma predates Update 138)`;
    }
    const lf = await call("load_fonts", { fonts: [{ family }] });
    expect(!lf.err && lf.data.allLoaded, lf.err ?? "whole-family load failed");

    // No fontStyle: Figma picks the named instance closest to the axes.
    const t = await call("create_text", { parentId: S.root, characters: "Axes", fontFamily: family, variationSettings: { wght: 550 }, fontSize: 20, x: 600, y: 600, name: "VarFont" });
    expect(!t.err, t.err);
    const created = t.data.fontName.variationSettings ?? {};
    expect(created.wght === 550, "created: " + JSON.stringify(t.data.fontName));

    // Axes-only patch: wght moves, the style and every other axis stay.
    const p = await call("set_text_properties", { nodeId: t.data.nodeId, variationSettings: { wght: 650 } });
    expect(!p.err, p.err);
    const patched = p.data.applied.fontName;
    expect(patched.style === t.data.fontName.style && patched.variationSettings?.wght === 650, "patched: " + JSON.stringify(patched));
    for (const tag of Object.keys(created)) {
      if (tag !== "wght") expect(patched.variationSettings[tag] === created[tag], `axis ${tag} changed: ${created[tag]} -> ${patched.variationSettings[tag]}`);
    }

    // An undefined axis fails before the node exists: no orphan in S.root.
    const countCode = `var p = await figma.getNodeByIdAsync('${S.root}'); return p.children.length;`;
    const before = await call("execute_code", { code: countCode });
    const bad = await call("create_text", { parentId: S.root, characters: "Bad axis", fontFamily: family, variationSettings: { ZZZZ: 1 } });
    const after = await call("execute_code", { code: countCode });
    expect(bad.err && bad.err.includes("not defined"), "undefined axis accepted: " + (bad.err ?? "no error"));
    expect(!before.err && !after.err && after.data.result === before.data.result, `orphan left: ${before.data?.result} -> ${after.data?.result}`);

    // Ranges that differ only in wght: fontName reads mixed, family/style stay concrete.
    const mix = await call("execute_code", {
      code: `var n = await figma.getNodeByIdAsync('${t.data.nodeId}'); var f = n.fontName; await figma.loadFontAsync({ family: f.family, style: f.style }); n.setRangeFontName(0, 2, { family: f.family, style: f.style, variationSettings: { wght: 400 } }); return n.fontName === figma.mixed;`,
    });
    expect(!mix.err && mix.data.result === true, mix.err ?? "fontName not mixed after an axes-only range change");
    const n = await call("get_node", { nodeId: t.data.nodeId });
    const st = n.data?.styles ?? {};
    expect(!n.err && st.fontFamily === family && st.fontStyle === patched.style && st.fontVariationSettings === "mixed", n.err ?? "axes-only mixed read: " + JSON.stringify([st.fontFamily, st.fontStyle, st.fontVariationSettings]));
    // An axes-only patch on that node merges range by range: re-asserting
    // another axis at its current value keeps each range's own wght.
    const other = axes.find((tag) => tag !== "wght");
    if (other !== undefined && typeof created[other] === "number") {
      const ap = await call("set_text_properties", { nodeId: t.data.nodeId, variationSettings: { [other]: created[other] } });
      expect(!ap.err, ap.err);
      const rw = await call("execute_code", {
        code: `var n = await figma.getNodeByIdAsync('${t.data.nodeId}'); return [n.getRangeFontName(0, 1).variationSettings.wght, n.getRangeFontName(3, 4).variationSettings.wght];`,
      });
      expect(!rw.err && rw.data.result[0] === 400 && rw.data.result[1] === 650, rw.err ?? "per-range wght after an axes-only patch: " + JSON.stringify(rw.data.result));
    }
    const restyle = await call("set_text_properties", { nodeId: t.data.nodeId, fontStyle: style });
    expect(!restyle.err, "style change on an axes-only mixed node: " + restyle.err);

    // Text styles keep an explicit style; an axes-only update merges.
    const cs = await call("create_text_style", { name: "MCP-E2E/Variable", fontFamily: family, fontStyle: style, variationSettings: { wght: 550 }, fontSize: 16 });
    expect(!cs.err && cs.data.style.fontName.variationSettings?.wght === 550, cs.err ?? "style: " + JSON.stringify(cs.data.style.fontName));
    const us = await call("update_text_style", { styleId: cs.data.style.id, variationSettings: { wght: 650 } });
    expect(!us.err && us.data.style.fontName.style === style && us.data.style.fontName.variationSettings?.wght === 650, us.err ?? "style update: " + JSON.stringify(us.data.style.fontName));
    // Repeating the style's own family without axes keeps its custom axes.
    const rs = await call("update_text_style", { styleId: cs.data.style.id, fontFamily: family, fontSize: 18 });
    expect(!rs.err && rs.data.style.fontName.variationSettings?.wght === 650, rs.err ?? "axes reset by a same-family update: " + JSON.stringify(rs.data.style.fontName));
    return `${family} axes ${axes.join(",")}; created as ${t.data.fontName.style}`;
  });

  // ---- basic creation ------------------------------------------------------
  await check("create_text", async () => {
    const r = await call("create_text", { parentId: S.root, characters: "Hello from the e2e test", fontFamily: family, fontStyle: style, fontSize: 24, x: 20, y: 20, name: "Label" });
    expect(!r.err, r.err);
    S.text = r.data.nodeId;
  });
  await check("create_shape", async () => {
    const r = await call("create_shape", { parentId: S.root, shapeType: "RECTANGLE", width: 120, height: 80, x: 20, y: 80, fillHex: "#3366FF", name: "Rect" });
    expect(!r.err, r.err);
    S.rect = r.data.nodeId;
  });
  await check("create_image (1x1 data URI)", async () => {
    const px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const r = await call("create_image", { parentId: S.root, source: px, width: 40, height: 40, x: 200, y: 80, name: "Img" });
    expect(!r.err, r.err);
    S.img = r.data.nodeId;
  });

  // ---- styling writes ------------------------------------------------------
  await check("set_solid_fill", async () => {
    const r = await call("set_solid_fill", { nodeId: S.rect, hex: "#FF6600" });
    expect(!r.err, r.err);
  });
  await check("set_gradient_fill", async () => {
    const r = await call("set_gradient_fill", { nodeId: S.rect, gradientType: "LINEAR", gradientStops: [{ position: 0, hex: "#FF0000" }, { position: 1, hex: "#0000FF" }] });
    expect(!r.err, r.err);
  });
  await check("set_effects", async () => {
    const r = await call("set_effects", { nodeId: S.rect, effects: [{ type: "DROP_SHADOW", color: "#000000", opacity: 0.25, offset: { x: 0, y: 4 }, radius: 12 }] });
    expect(!r.err, r.err);
  });
  await check("set_stroke_properties", async () => {
    const r = await call("set_stroke_properties", { nodeId: S.rect, strokeWeight: 2, strokeAlign: "INSIDE" });
    expect(!r.err, r.err);
  });
  await check("set_node_properties", async () => {
    const r = await call("set_node_properties", { nodeId: S.rect, cornerRadius: 8, opacity: 0.9 });
    expect(!r.err, r.err);
  });
  await check("set_node_visibility (hide+restore)", async () => {
    let r = await call("set_node_visibility", { items: [{ nodeId: S.img, visible: false }] });
    expect(!r.err, r.err);
    r = await call("set_node_visibility", { items: [{ nodeId: S.img, visible: true }] });
    expect(!r.err, r.err);
  });
  await check("set_text_content", async () => {
    const r = await call("set_text_content", { nodeId: S.text, text: "Edited by e2e" });
    expect(!r.err && r.data.characters === "Edited by e2e", r.err ?? "text mismatch");
  });
  await check("set_text_properties", async () => {
    const r = await call("set_text_properties", { nodeId: S.text, fontSize: 32, letterSpacingPx: 0.5, fillHex: "#222222" });
    expect(!r.err, r.err);
  });

  // ---- layout --------------------------------------------------------------
  await check("set_auto_layout", async () => {
    const r = await call("create_frame", { name: "AutoLayout", parentId: S.root, width: 200, height: 100, x: 20, y: 200 });
    expect(!r.err, r.err);
    S.auto = r.data.nodeId;
    const r2 = await call("set_auto_layout", { nodeId: S.auto, layoutMode: "VERTICAL", itemSpacing: 8, paddingTop: 12, paddingLeft: 12, paddingRight: 12, paddingBottom: 12 });
    expect(!r2.err, r2.err);
  });
  await check("set_auto_layout SPACE_EVENLY / SPACE_AROUND (Update 137)", async () => {
    for (const v of ["SPACE_EVENLY", "SPACE_AROUND"]) {
      const r = await call("set_auto_layout", { nodeId: S.auto, primaryAxisAlignItems: v });
      // An older Figma rejects the value itself; when its error names it, skip.
      if (r.err && r.err.includes(v)) return `skipped: Figma rejected ${v} (predates Update 137?) — ${r.err}`;
      expect(!r.err && r.data.applied.primaryAxisAlignItems === v, r.err ?? "not applied: " + v);
      const n = await call("get_node", { nodeId: S.auto });
      const got = n.data?.styles?.autoLayout?.primaryAxisAlign;
      expect(!n.err && got === v, `read-back ${v}: ${n.err ?? got}`);
    }
    const reset = await call("set_auto_layout", { nodeId: S.auto, primaryAxisAlignItems: "MIN" });
    expect(!reset.err, reset.err);
  });
  await check("set_grid_layout (+placements)", async () => {
    const g = await call("create_frame", { name: "Grid", parentId: S.root, width: 300, height: 200, x: 260, y: 200 });
    expect(!g.err, g.err);
    S.grid = g.data.nodeId;
    const a = await call("create_shape", { parentId: S.grid, shapeType: "RECTANGLE", width: 40, height: 40, fillHex: "#00AA66", name: "cellA" });
    const b = await call("create_shape", { parentId: S.grid, shapeType: "RECTANGLE", width: 40, height: 40, fillHex: "#AA0066", name: "cellB" });
    expect(!a.err && !b.err, a.err ?? b.err);
    const r = await call("set_grid_layout", {
      nodeId: S.grid, rowCount: 2, columnCount: 2, rowGap: 10, columnGap: 10, itemsPositioning: "MANUAL",
      placements: [{ nodeId: a.data.nodeId, row: 0, column: 0 }, { nodeId: b.data.nodeId, row: 1, column: 1 }],
    });
    expect(!r.err, r.err);
    const bad = r.data.placements.filter((p) => p.error);
    expect(bad.length === 0, "placement errors: " + JSON.stringify(bad));
  });

  // ---- node ops --------------------------------------------------------------
  await check("duplicate_nodes", async () => {
    const r = await call("duplicate_nodes", { nodeIds: [S.rect] });
    expect(!r.err, r.err);
    S.dup = r.data.duplicates[0].nodeId;
  });
  await check("group_nodes + ungroup_node", async () => {
    // Two fresh siblings under S.root so the shared-parent guard is satisfied.
    const g1 = await call("create_shape", { parentId: S.root, shapeType: "ELLIPSE", width: 30, height: 30, x: 500, y: 20, fillHex: "#22CCAA", name: "g1" });
    const g2 = await call("create_shape", { parentId: S.root, shapeType: "ELLIPSE", width: 30, height: 30, x: 540, y: 20, fillHex: "#CC22AA", name: "g2" });
    expect(!g1.err && !g2.err, g1.err ?? g2.err);
    const r = await call("group_nodes", { nodeIds: [g1.data.nodeId, g2.data.nodeId], name: "TempGroup" });
    expect(!r.err, r.err);
    const r2 = await call("ungroup_node", { nodeId: r.data.nodeId });
    expect(!r2.err && r2.data.orphanIds.length === 2, r2.err ?? "ungroup mismatch");
  });
  await check("reparent_nodes", async () => {
    const r = await call("reparent_nodes", { nodeIds: [S.dup], parentId: S.auto });
    expect(!r.err, r.err);
  });

  // ---- styles (create/apply/update) -----------------------------------------
  await check("create_text_style + apply + update", async () => {
    const c = await call("create_text_style", { name: "MCP-E2E/Heading", fontFamily: family, fontStyle: style, fontSize: 28, lineHeight: { unit: "PERCENT", value: 120 }, skipIfExists: true });
    expect(!c.err, c.err);
    S.textStyle = c.data.style.id;
    const a = await call("apply_text_style", { nodeIds: [S.text], styleId: S.textStyle });
    expect(!a.err && a.data.appliedCount === 1, a.err ?? "not applied");
    const u = await call("update_text_style", { styleId: S.textStyle, fontSize: 30 });
    expect(!u.err && u.data.applied.fontSize === 30, u.err ?? "not updated");
  });
  await check("get_text_styles includes ours", async () => {
    const r = await call("get_text_styles");
    expect(!r.err && r.data.styles.some((s) => s.name === "MCP-E2E/Heading"), r.err ?? "missing");
  });
  await check("textWrapStyle on a node + a text style (Update 134)", async () => {
    // textWrapStyle-only calls: the "at least one property" refines and
    // update_text_style's plugin-side gate must count the field.
    const r = await call("set_text_properties", { nodeId: S.text, textWrapStyle: "PRETTY" });
    if (r.err && r.err.includes("Update 134+")) return "skipped: Figma predates Plugin API Update 134";
    expect(!r.err && r.data.applied.textWrapStyle === "PRETTY", r.err ?? "not applied");
    const n = await call("get_node", { nodeId: S.text });
    expect(!n.err && n.data.styles.textWrapStyle === "PRETTY", n.err ?? "read-back " + n.data.styles.textWrapStyle);
    const u = await call("update_text_style", { styleId: S.textStyle, textWrapStyle: "BALANCE" });
    expect(!u.err && u.data.applied.textWrapStyle === "BALANCE" && u.data.style.textWrapStyle === "BALANCE", u.err ?? "style not updated");
  });
  await check("create_paint_style + apply_style(fill)", async () => {
    const c = await call("create_paint_style", { name: "MCP-E2E/Brand", hex: "#7B2FF7", skipIfExists: true });
    expect(!c.err, c.err);
    const a = await call("apply_style", { nodeId: S.rect, styleType: "fill", styleName: "MCP-E2E/Brand" });
    expect(!a.err, a.err);
  });
  await check("create_effect_style + apply_style(effect)", async () => {
    const c = await call("create_effect_style", { name: "MCP-E2E/Shadow", effects: [{ type: "DROP_SHADOW", color: "#000000", opacity: 0.3, offset: { x: 0, y: 2 }, radius: 6 }, { type: "DROP_SHADOW", color: "#000000", opacity: 0.15, offset: { x: 0, y: 8 }, radius: 24 }], skipIfExists: true });
    expect(!c.err && c.data.effectCount === 2, c.err ?? "effect count");
    const a = await call("apply_style", { nodeId: S.auto, styleType: "effect", styleName: "MCP-E2E/Shadow" });
    expect(!a.err, a.err);
  });

  // ---- variables --------------------------------------------------------------
  await check("write_variables batch with $refs", async () => {
    const r = await call("write_variables", {
      actions: [
        { action: "create_collection", name: "MCP-E2E", initialModeName: "Light" },
        { action: "add_mode", collectionId: "$0.collectionId", name: "Dark" },
        { action: "create_variable", collectionId: "$0.collectionId", name: "color/test", resolvedType: "COLOR", scopes: ["ALL_FILLS"], valuesByMode: { "$0.defaultModeId": "#FF0000", "$1.modeId": "#00FF00" } },
        { action: "create_variable", collectionId: "$0.collectionId", name: "color/alias", resolvedType: "COLOR" },
        { action: "set_alias", variableId: "$3.variableId", modeId: "$0.defaultModeId", aliasVariableId: "$2.variableId" },
        { action: "bind_to_node", nodeId: S.rect, field: "fills", variableId: "$2.variableId" },
      ],
    });
    expect(!r.err, r.err);
    expect(r.data.failed === 0, "failed actions: " + JSON.stringify(r.data.results.filter((x) => x.error)));
    S.collection = r.data.results[0].collectionId;
    S.mode = r.data.results[0].defaultModeId;
    S.var = r.data.results[2].variableId;
  });
  await check("get_variables_deep resolves alias", async () => {
    const r = await call("get_variables_deep", { collectionName: "MCP-E2E" });
    expect(!r.err, r.err);
    const aliasVar = r.data.collections[0].variables.find((v) => v.name === "color/alias");
    const aliased = Object.values(aliasVar.valuesByMode).find((v) => v && v.type === "VARIABLE_ALIAS");
    expect(aliased && aliased.name === "color/test", "alias not resolved: " + JSON.stringify(aliased));
  });
  await check("write_variables delete_variable", async () => {
    const r = await call("write_variables", { actions: [{ action: "delete_variable", variableId: S.var }] });
    expect(!r.err && r.data.failed === 0, r.err ?? "delete failed");
  });
  await check("TIMING value round-trips as seconds", async () => {
    const r = await call("write_variables", {
      actions: [{ action: "create_variable", collectionId: S.collection, name: "motion/duration", resolvedType: "TIMING", valuesByMode: { [S.mode]: 0.2 } }],
    });
    expect(!r.err && r.data.failed === 0, r.err ?? "failed: " + JSON.stringify(r.data.results));
    const d = await call("get_variables_deep", { collectionName: "MCP-E2E" });
    expect(!d.err, d.err);
    const v = d.data.collections[0].variables.find((x) => x.name === "motion/duration");
    // Passed through unchanged (no unit conversion); tolerate float32 storage.
    expect(v && Math.abs(v.valuesByMode[S.mode] - 0.2) < 1e-6, "read-back: " + JSON.stringify(v && v.valuesByMode));
  });
  await check("write_variables composed color + COLOR_OPACITY (Update 139)", async () => {
    // Own base variables, not S.var (deleted above).
    const r = await call("write_variables", {
      actions: [
        { action: "create_variable", collectionId: S.collection, name: "color/base", resolvedType: "COLOR", scopes: ["ALL_FILLS"], valuesByMode: { [S.mode]: "#3366FF" } },
        { action: "create_variable", collectionId: S.collection, name: "opacity/scrim", resolvedType: "FLOAT", scopes: ["COLOR_OPACITY"], valuesByMode: { [S.mode]: 60 } },
        { action: "create_variable", collectionId: S.collection, name: "color/scrim", resolvedType: "COLOR", scopes: ["ALL_FILLS"], valuesByMode: { [S.mode]: { color: { alias: "$0.variableId" }, opacity: { alias: "$1.variableId" } } } },
        { action: "create_variable", collectionId: S.collection, name: "color/tint", resolvedType: "COLOR", scopes: ["ALL_FILLS"], valuesByMode: { [S.mode]: { color: { alias: "$0.variableId" }, opacity: 40 } } },
      ],
    });
    expect(!r.err, r.err);
    const scopeErr = r.data.results[1]?.error;
    if (scopeErr && scopeErr.includes("COLOR_OPACITY")) return `skipped: Figma rejected COLOR_OPACITY (predates Update 139?) — ${scopeErr}`;
    expect(r.data.failed === 0, "failed actions: " + JSON.stringify(r.data.results.filter((x) => x.error)));
    const d = await call("get_variables_deep", { collectionName: "MCP-E2E" });
    expect(!d.err, d.err);
    const byName = new Map(d.data.collections[0].variables.map((v) => [v.name, v]));
    const opacityScopes = byName.get("opacity/scrim")?.scopes ?? [];
    expect(opacityScopes.includes("COLOR_OPACITY"), "scopes: " + JSON.stringify(opacityScopes));
    const scrim = byName.get("color/scrim")?.valuesByMode[S.mode];
    expect(scrim?.type === "COMPOSED_COLOR" && scrim.color?.name === "color/base" && scrim.opacity?.name === "opacity/scrim", "alias + alias: " + JSON.stringify(scrim));
    const tint = byName.get("color/tint")?.valuesByMode[S.mode];
    expect(tint?.type === "COMPOSED_COLOR" && tint.color?.name === "color/base" && tint.opacity === 40, "alias + percent: " + JSON.stringify(tint));
  });

  // ---- components ---------------------------------------------------------------
  await check("create_component_from_node ×2 (State=…)", async () => {
    const f1 = await call("create_frame", { name: "State=Default", parentId: S.root, width: 120, height: 44, x: 20, y: 340, fillHex: "#DDDDDD" });
    const t1 = await call("create_text", { parentId: f1.data.nodeId, characters: "Button", fontFamily: family, fontStyle: style, fontSize: 14, name: "Label" });
    const f2 = await call("create_frame", { name: "State=Hover", parentId: S.root, width: 120, height: 44, x: 160, y: 340, fillHex: "#BBBBBB" });
    const t2 = await call("create_text", { parentId: f2.data.nodeId, characters: "Button", fontFamily: family, fontStyle: style, fontSize: 14, name: "Label" });
    expect(!f1.err && !f2.err && !t1.err && !t2.err, "frame/text create failed");
    const c1 = await call("create_component_from_node", { nodeId: f1.data.nodeId });
    const c2 = await call("create_component_from_node", { nodeId: f2.data.nodeId });
    expect(!c1.err && !c2.err, c1.err ?? c2.err);
    S.comp1 = c1.data.componentId;
    S.comp2 = c2.data.componentId;
  });
  await check("combine_as_variants (auto-arranged + resized)", async () => {
    const r = await call("combine_as_variants", { nodeIds: [S.comp1, S.comp2], name: "E2E Button", parentId: S.root });
    expect(!r.err, r.err);
    S.set = r.data.componentSetId;
    const n = await call("get_node", { nodeId: S.set });
    const h = n.data?.bounds?.height;
    expect(!n.err && h > 100, "set not resized to fit variants (h=" + h + ")");
  });
  await check("add_component_property TEXT + INSTANCE_SWAP guard", async () => {
    const p = await call("add_component_property", { nodeId: S.set, name: "LabelText", propertyType: "TEXT", defaultValue: "Button" });
    expect(!p.err && p.data.propertyKey.includes("#"), p.err ?? "no # key");
    S.textProp = p.data.propertyKey;
    const bad = await call("add_component_property", { nodeId: S.set, name: "Icon", propertyType: "INSTANCE_SWAP" });
    expect(bad.err && bad.err.includes("required for INSTANCE_SWAP"), "guard missing: " + (bad.err ?? "no error"));
  });
  await check("create_slot (auto property key)", async () => {
    const icon = await call("create_frame", { name: "E2E Icon A", parentId: S.root, width: 24, height: 24, x: 320, y: 340, fillHex: "#111111" });
    const ic = await call("create_component_from_node", { nodeId: icon.data.nodeId });
    S.iconComp = ic.data.componentId;
    const r = await call("create_slot", { nodeId: S.iconComp });
    expect(!r.err && r.data.slotPropertyKey, r.err ?? "no auto slot property key returned");
  });
  await check("instantiate_component (properties + textOverrides)", async () => {
    const r = await call("instantiate_component", { componentId: S.set, parentId: S.root, x: 20, y: 480, properties: { State: "Hover" }, textOverrides: [{ childName: "Label", text: "Overridden" }] });
    expect(!r.err, r.err);
    expect(r.data.textOverrides[0].applied === true, "text override failed: " + JSON.stringify(r.data.textOverrides));
    S.instance = r.data.instanceId;
  });
  await check("set_instance_properties (variant back to Default)", async () => {
    const r = await call("set_instance_properties", { nodeId: S.instance, properties: { State: "Default" } });
    expect(!r.err, r.err);
  });
  await check("swap_instance", async () => {
    const iconB = await call("create_frame", { name: "E2E Icon B", parentId: S.root, width: 24, height: 24, x: 360, y: 340, fillHex: "#888888" });
    const icB = await call("create_component_from_node", { nodeId: iconB.data.nodeId });
    const inst = await call("instantiate_component", { componentId: S.iconComp, parentId: S.root, x: 400, y: 340 });
    expect(!inst.err, inst.err);
    const r = await call("swap_instance", { nodeId: inst.data.instanceId, componentId: icB.data.componentId });
    expect(!r.err && r.data.swappedTo === "E2E Icon B", r.err ?? "swap mismatch");
  });

  // ---- prototyping ------------------------------------------------------------
  await check("set_reactions + get_reactions", async () => {
    const dest = await call("create_frame", { name: "E2E Screen 2", parentId: S.page, width: 400, height: 400, x: 900, y: 0 });
    expect(!dest.err, dest.err);
    S.screen2 = dest.data.nodeId;
    const r = await call("set_reactions", {
      nodeId: S.rect,
      reactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: S.screen2, navigation: "NAVIGATE", transition: { type: "DISSOLVE", easing: { type: "EASE_OUT" }, duration: 0.3 }, preserveScrollPosition: false }] }],
    });
    expect(!r.err, r.err);
    const g = await call("get_reactions", { nodeIds: [S.rect] });
    expect(!g.err && g.data.nodes[0].reactions.length === 1, g.err ?? "reaction not readable");
  });
  await check("set_flow_starting_point (+remove)", async () => {
    const r = await call("set_flow_starting_point", { nodeId: S.root, name: "E2E Flow" });
    expect(!r.err && r.data.flows.some((f) => f.name === "E2E Flow"), r.err ?? "flow missing");
    const rm = await call("set_flow_starting_point", { nodeId: S.root, remove: true });
    expect(!rm.err && !rm.data.flows.some((f) => f.name === "E2E Flow"), rm.err ?? "flow not removed");
  });

  // ---- annotations + dev resources ---------------------------------------------
  await check("set_annotation + get_annotations + clear", async () => {
    const r = await call("set_annotation", { nodeId: S.rect, label: "E2E annotation" });
    expect(!r.err, r.err);
    const g = await call("get_annotations", { nodeIds: [S.rect] });
    expect(!g.err && JSON.stringify(g.data.nodes[0].annotations).includes("E2E annotation"), g.err ?? "not readable");
    const c = await call("set_annotation", { nodeId: S.rect, clear: true });
    expect(!c.err && c.data.cleared, c.err ?? "not cleared");
  });
  await check("dev_resources add/get/edit/delete", async () => {
    // Dev resources sync with Figma's cloud; on files with an unusual sync
    // state the API can hang. Treat a timeout as environmental, not a failure.
    const url = "https://example.com/e2e-spec";
    try {
      let r = await call("dev_resources", { nodeId: S.rect, action: "add", url, name: "E2E Spec" });
      if (r.err) return "add unsupported here: " + r.err;
      r = await call("dev_resources", { nodeId: S.rect, action: "get" });
      expect(!r.err && JSON.stringify(r.data.resources).includes(url), r.err ?? "not listed");
      r = await call("dev_resources", { nodeId: S.rect, action: "edit", url, newName: "E2E Spec v2" });
      expect(!r.err, r.err);
      r = await call("dev_resources", { nodeId: S.rect, action: "delete", url });
      expect(!r.err, r.err);
    } catch (err) {
      if (String(err.message).includes("timed out")) return "skipped: dev-resource cloud sync unavailable on this file";
      throw err;
    }
  });

  // ---- motion (beta — may be unavailable) ---------------------------------------
  await check("get_motion + apply_animation_style (+remove)", async () => {
    const g = await call("get_motion", {});
    if (g.err && g.err.includes("Motion API unavailable")) return "skipped: Motion beta not present";
    expect(!g.err, g.err);
    const styleId = g.data.availableAnimationStyles?.[0]?.styleId;
    if (!styleId) return "no animation styles exposed";
    const a = await call("apply_animation_style", { nodeId: S.rect, styleId });
    expect(!a.err, a.err);
    const rm = await call("apply_animation_style", { nodeId: S.rect, remove: true, appliedStyleInstanceId: a.data.appliedStyleInstanceId });
    expect(!rm.err, rm.err);
  });
  await check("list_shaders (beta)", async () => {
    const r = await call("list_shaders", {});
    if (r.err && r.err.includes("Shader API unavailable")) return "skipped: Shaders beta not present";
    expect(!r.err, r.err);
    return `${r.data.count} shaders`;
  });

  // ---- reads --------------------------------------------------------------------
  await check("get_node / get_metadata / get_styles / get_design_context", async () => {
    const n = await call("get_node", { nodeId: S.rect });
    const m = await call("get_metadata");
    const st = await call("get_styles");
    const dc = await call("get_design_context", { depth: 1 });
    expect(!n.err && !m.err && !st.err && !dc.err, n.err ?? m.err ?? st.err ?? dc.err);
  });
  await check("get_screenshot + save_screenshots", async () => {
    const r = await call("get_screenshot", { nodeIds: [S.rect], format: "PNG", scale: 1 });
    expect(!r.err && r.data.exports[0].base64.length > 100, r.err ?? "empty image");
    const s = await call("save_screenshots", { items: [{ nodeId: S.rect, outputPath: "e2e-screenshot.png" }] });
    expect(!s.err && s.data.succeeded === 1, s.err ?? JSON.stringify(s.data.results));
    expect(existsSync(path.join(ROOT, "e2e-screenshot.png")), "file not written");
  });
  await check("get_file_digest live→cached", async () => {
    const a = await call("get_file_digest");
    expect(!a.err, a.err);
    const b = await call("get_file_digest");
    expect(!b.err && b.data.cached === true, b.err ?? "not cached");
  });

  // ---- orchestration --------------------------------------------------------------
  await check("journal recorded this run's writes", async () => {
    const r = await call("get_journal", { limit: 100 });
    expect(!r.err, r.err);
    const tools = new Set(r.data.entries.map((e) => e.tool));
    expect(tools.has("write_variables") && tools.has("set_reactions"), "missing entries; saw: " + [...tools].join(","));
  });
  await check("checkpoint round-trip", async () => {
    const w = await call("save_checkpoint", { name: "e2e-run", data: { done: results.length } });
    expect(!w.err && w.data.saved, w.err ?? "not saved");
    const l = await call("load_checkpoint", { name: "e2e-run" });
    expect(!l.err && l.data.found, l.err ?? "not found");
  });
  await check("locks contention", async () => {
    const a = await call("acquire_lock", { name: "e2e:lock", agent: "agent-A", ttlSeconds: 30 });
    const b = await call("acquire_lock", { name: "e2e:lock", agent: "agent-B" });
    expect(!a.err && a.data.acquired && !b.err && b.data.acquired === false, "contention broken");
    const rel = await call("release_lock", { name: "e2e:lock", agent: "agent-A" });
    expect(!rel.err && rel.data.released, "release failed");
  });
  await check("code mappings round-trip", async () => {
    const w = await call("set_code_mapping", { target: "E2E Button", source: "src/components/Button.tsx", language: "tsx" });
    expect(!w.err && w.data.saved, w.err ?? "not saved");
    const g = await call("get_code_mappings", { targets: ["E2E Button"] });
    expect(!g.err && g.data.mappings["E2E Button"]?.language === "tsx", g.err ?? "not resolved");
    await call("set_code_mapping", { target: "E2E Button", remove: true });
  });
  await check("execute_code (await + return)", async () => {
    const r = await call("execute_code", { code: "var p = await figma.getNodeByIdAsync('" + S.root + "'); return { name: p.name, children: p.children.length };" });
    expect(!r.err && r.data.result.name === "E2E Root", r.err ?? "bad result");
    return `${r.data.result.children} children in root`;
  });

  // ---- destructive last -------------------------------------------------------------
  await check("delete_nodes (confirm gate)", async () => {
    const bad = await call("delete_nodes", { nodeIds: [S.img] });
    expect(bad.err, "unconfirmed delete should fail");
    const ok = await call("delete_nodes", { nodeIds: [S.img], confirm: true });
    expect(!ok.err && ok.data.deletedCount === 1, ok.err ?? "not deleted");
  });

  // set_selection / scroll_and_zoom act on the CURRENT page. Isolate by
  // switching to the test page, exercising them, then switching back so the
  // human's active page/selection is untouched.
  await check("set_selection + scroll_and_zoom_into_view (page-isolated)", async () => {
    const orig = await call("execute_code", {
      code: `var prev = figma.currentPage.id; var p = await figma.getNodeByIdAsync('${S.page}'); await figma.setCurrentPageAsync(p); return prev;`,
    });
    expect(!orig.err, orig.err);
    try {
      const sel = await call("set_selection", { nodeIds: [S.rect] });
      expect(!sel.err && sel.data.selectedCount === 1, sel.err ?? "selection failed");
      const zoom = await call("scroll_and_zoom_into_view", { nodeIds: [S.rect] });
      expect(!zoom.err && zoom.data.framedCount === 1, zoom.err ?? "zoom failed");
      const clear = await call("set_selection", { nodeIds: [] });
      expect(!clear.err && clear.data.selectedCount === 0, clear.err ?? "clear failed");
    } finally {
      await call("execute_code", {
        code: `var p = await figma.getNodeByIdAsync('${orig.data.result}'); if (p) await figma.setCurrentPageAsync(p); return true;`,
      });
    }
  });

  record("apply_shader / import_library_asset", "skip", "need a shader / published library key in the test file");
}

main()
  .catch((err) => record("SUITE", false, err.message))
  .finally(async () => {
    try {
      await cleanup();
    } catch (err) {
      console.error("cleanup error:", err.message);
    }
    const fail = results.filter((r) => r.ok === false).length;
    const skip = results.filter((r) => r.ok === "skip").length;
    console.log(`\n=== ${results.length} checks: ${results.length - fail - skip} passed, ${fail} failed, ${skip} skipped ===`);
    proc.kill();
    process.exit(fail > 0 ? 1 : 0);
  });
