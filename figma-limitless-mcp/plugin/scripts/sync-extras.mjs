// Copies the built plugin bundle into extras/ so the companion manifest
// (FigJam / Slides / Buzz) can reference its code/ui in the SAME directory —
// Figma forbids a manifest's "main"/"ui" from pointing at a parent dir
// (../dist). The two manifests (plugin/manifest.json = figma+dev, and
// plugin/extras/manifest.json = figjam/slides/buzz) share one codebase; this
// keeps extras/ in lockstep with dist/ on every build.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const extrasDir = join(pluginDir, "extras");
mkdirSync(extrasDir, { recursive: true });

for (const [from, to] of [
  ["dist/code.js", "code.js"],
  ["dist/index.html", "index.html"],
]) {
  copyFileSync(join(pluginDir, from), join(extrasDir, to));
}

console.log("synced dist/ -> extras/ (code.js, index.html)");
