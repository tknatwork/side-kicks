// Copies the built plugin bundle into dev-mode/ so the Dev-Mode companion
// manifest can reference its code/ui in the SAME directory — Figma forbids a
// manifest's "main"/"ui" from pointing at a parent dir (../dist). The two
// manifests (plugin/manifest.json + plugin/dev-mode/manifest.json) share one
// codebase; this keeps dev-mode/ in lockstep with dist/ on every build.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const devDir = join(pluginDir, "dev-mode");
mkdirSync(devDir, { recursive: true });

for (const [from, to] of [
  ["dist/code.js", "code.js"],
  ["dist/index.html", "index.html"],
]) {
  copyFileSync(join(pluginDir, from), join(devDir, to));
}

console.log("synced dist/ -> dev-mode/ (code.js, index.html)");
