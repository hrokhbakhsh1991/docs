#!/usr/bin/env node
/**
 * Blocks symlinks under platform packages (import-boundary evasion).
 * Usage: node scripts/guards/symlink-guard.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const roots = [
  path.join(REPO_ROOT, "packages/platform-core"),
  path.join(REPO_ROOT, "packages/workspace-sdk"),
];

let failed = false;

for (const root of roots) {
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) {
        console.error(`symlink-guard: FAIL ${path.relative(REPO_ROOT, p)}`);
        failed = true;
        continue;
      }
      if (ent.isDirectory() && ent.name !== "node_modules" && ent.name !== "dist") {
        walk(p);
      }
    }
  };
  if (fs.existsSync(root)) {
    walk(root);
  }
}

if (failed) {
  process.exit(1);
}

console.log("symlink-guard: PASS");
