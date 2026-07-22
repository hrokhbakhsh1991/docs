#!/usr/bin/env node
/**
 * Wave A — forbid @app-cloud/ module scope in apps + packages source.
 * @see docs/dev/wave-a-no-app-cloud-imports.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOTS = ["apps", "packages"];
const EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SKIP_DIR = new Set(["node_modules", "dist", ".next", "coverage", "test-results"]);

/** @type {string[]} */
const hits = [];

/**
 * @param {string} absDir
 * @param {string} relDir
 */
function walk(absDir, relDir) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (SKIP_DIR.has(ent.name)) continue;
    const abs = path.join(absDir, ent.name);
    const rel = path.join(relDir, ent.name);
    if (ent.isDirectory()) {
      walk(abs, rel);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!EXT.has(path.extname(ent.name))) continue;
    const text = fs.readFileSync(abs, "utf8");
    if (!text.includes("@app-cloud/")) continue;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("@app-cloud/")) {
        hits.push(`${rel}:${i + 1}:${lines[i].trim().slice(0, 160)}`);
      }
    }
  }
}

for (const root of ROOTS) {
  walk(path.join(REPO_ROOT, root), root);
}

if (hits.length > 0) {
  console.error("guard-no-app-cloud-imports: FAIL — canonical scope is @app-tour/*");
  for (const h of hits.slice(0, 50)) {
    console.error(` - ${h}`);
  }
  if (hits.length > 50) console.error(` … +${hits.length - 50} more`);
  process.exit(1);
}

console.log("guard-no-app-cloud-imports: PASS");
