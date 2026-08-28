// tsc only emits JavaScript, so the node icon has to be copied into dist
// alongside it — n8n resolves `file:duetrail.svg` relative to the compiled
// node, and a missing icon shows as a broken image in the editor.

import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "nodes", "DueTrail", "duetrail.svg");
const to = join(root, "dist", "nodes", "DueTrail", "duetrail.svg");

mkdirSync(dirname(to), { recursive: true });
cpSync(from, to);
console.log("copied duetrail.svg → dist/nodes/DueTrail/");
