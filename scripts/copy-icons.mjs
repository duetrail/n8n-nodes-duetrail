// tsc only emits JavaScript, so the node's non-TS assets have to be copied into
// dist alongside it:
//
//   - the icon, because n8n resolves `file:duetrail.svg` relative to the
//     compiled node and a missing icon shows as a broken image in the editor;
//   - the *.node.json codex files, which give each node its category and
//     documentation link. Without them n8n logs "No codex available for:
//     dueTrail" at startup and the node shows up uncategorised in the editor.

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
