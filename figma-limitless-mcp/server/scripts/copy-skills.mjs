// tsc only emits .js — the bundled skill Markdown/JSON in server/skills/ must
// be copied into dist/skills/ so the compiled server (dist/skills.js) reads
// them at runtime via import.meta.url. Runs after tsc in `pnpm build`.
import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
cpSync(join(root, "skills"), join(root, "dist", "skills"), { recursive: true });
console.log("copied skills/ -> dist/skills/");
