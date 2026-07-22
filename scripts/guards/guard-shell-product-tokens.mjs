#!/usr/bin/env node
/**
 * Shell product-token ratchet — apps/web non-generated sources must not grow
 * branded product tokens (denali/urban/…). Decrease budget when relocating UI.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOTS = [
  path.join(REPO_ROOT, "apps/web/src"),
  path.join(REPO_ROOT, "apps/web/app"),
];
const EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SKIP_DIR = new Set(["node_modules", "dist", ".next", "coverage"]);

/** Gap Closure Phase A baseline — decrease only. */
const MAX_PRODUCT_TOKEN_HIT_LINES = 0;

const PRODUCT_TOKEN_RE =
  /denali|urban|Denali|Urban|DENALI_|buildDenali|getDenali/;

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
    const relPosix = rel.split(path.sep).join("/");
    if (ent.isDirectory()) {
      walk(abs, rel);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!EXT.has(path.extname(ent.name))) continue;
    if (relPosix.includes(".generated.")) continue;

    const lines = fs.readFileSync(abs, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!PRODUCT_TOKEN_RE.test(line)) continue;
      hits.push(`${relPosix}:${i + 1}:${line.trim().slice(0, 120)}`);
    }
  }
}

for (const absRoot of ROOTS) {
  const relRoot = path.relative(REPO_ROOT, absRoot);
  walk(absRoot, relRoot);
}

const count = hits.length;
if (count > MAX_PRODUCT_TOKEN_HIT_LINES) {
  console.error("guard-shell-product-tokens: FAIL — product-token hit lines grew past budget");
  console.error(
    `  hitLines=${count} budget=${MAX_PRODUCT_TOKEN_HIT_LINES} (decrease budget when extracting product UI)`
  );
  console.error("  See docs/dev/saas-platform-remediation.mdoc (Gap Closure Phase A)");
  for (const h of hits.slice(0, 25)) {
    console.error(` - ${h}`);
  }
  if (hits.length > 25) console.error(` … +${hits.length - 25} more`);
  process.exit(1);
}

console.log(
  `guard-shell-product-tokens: PASS (hitLines=${count} budget=${MAX_PRODUCT_TOKEN_HIT_LINES})`
);
if (count > 0) {
  console.log("guard-shell-product-tokens: sample hits (first 3):");
  for (const h of hits.slice(0, 3)) {
    console.log(` - ${h}`);
  }
}
