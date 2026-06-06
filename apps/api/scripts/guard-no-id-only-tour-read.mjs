#!/usr/bin/env node
/**
 * DM-CT-03 / DI-RAW-01 — forbid id-only admin tour reads and resolveById in app source.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-031
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const FORBIDDEN = [
  { pattern: /\bresolveById\b/, label: "resolveById" },
  {
    pattern: /getPrismaAdmin\s*\(\)[\s\S]{0,400}?\.tour\.findUnique\s*\(\s*\{\s*where:\s*\{\s*id\b/,
    label: "getPrismaAdmin().tour.findUnique({ where: { id",
  },
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
for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file);
  const src = fs.readFileSync(file, "utf8");
  for (const { pattern, label } of FORBIDDEN) {
    if (pattern.test(src)) {
      violations.push(`${rel}: forbidden ${label}`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-no-id-only-tour-read: FAIL");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("guard-no-id-only-tour-read: PASS");
