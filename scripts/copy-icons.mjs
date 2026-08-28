// tsc emits only JavaScript, so the icon and the *.node.json codex files have to
// be copied into dist beside it. Without them n8n shows a broken image and logs
// "No codex available".

import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "nodes", "DueTrail");
const outDir = join(root, "dist", "nodes", "DueTrail");

mkdirSync(outDir, { recursive: true });

const assets = readdirSync(srcDir).filter((f) => f.endsWith(".svg") || f.endsWith(".node.json"));
if (!assets.some((f) => f.endsWith(".svg"))) throw new Error(`no icon found in ${srcDir}`);
if (!assets.some((f) => f.endsWith(".node.json"))) throw new Error(`no codex found in ${srcDir}`);

for (const file of assets) {
  cpSync(join(srcDir, file), join(outDir, file));
}
console.log(`copied ${assets.join(", ")} → dist/nodes/DueTrail/`);
