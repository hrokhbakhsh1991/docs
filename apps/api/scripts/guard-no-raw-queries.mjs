#!/usr/bin/env node
/**
 * P3-E-DB-01 — route/handler layers must not call unscoped findMany / findFirst / findById.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HANDLERS_DIR = path.join(ROOT, "src");

const FORBIDDEN = [
  /\.findMany\s*\(\s*\)/,
  /\.findMany\s*\(\s*\{\s*\}\s*\)/,
  /\.findFirst\s*\(\s*\)/,
  /\.findFirst\s*\(\s*\{\s*\}\s*\)/,
  /\.findById\s*\(/,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(p, out);
    } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) {
      out.push(p);
    }
  }
  return out;
}

const violations = [];
for (const file of walk(HANDLERS_DIR)) {
  const rel = path.relative(ROOT, file);
  if (
    rel.startsWith("src/db/") ||
    rel.startsWith("src/casl/") ||
    rel.startsWith("src/canonical/") ||
    rel.startsWith("src/storage/")
  ) {
    continue;
  }
  const src = fs.readFileSync(file, "utf8");
  for (const pattern of FORBIDDEN) {
    if (pattern.test(src)) {
      violations.push(`${rel}: unscoped Prisma-style query (${pattern})`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-no-raw-queries: FAIL");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("guard-no-raw-queries: PASS");
