#!/usr/bin/env node
/**
 * LOG-V-01 / STD-BYPASS-01 / STD-BYPASS-02 — forbid console.* under apps/api/src.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-043
 * @see apps/api/docs/phase2-paranoid-audit.md § Phase 2 closure step 1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const CONSOLE_RE = /\bconsole\.(log|error|warn|debug|info)\b/;
/** One-off migration CLIs invoked from apps/api/scripts/* — not HTTP production paths. */
const SKIP_REL_PREFIXES = ["src/integrations/migration/"];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") {
        continue;
      }
      walk(p, out);
    } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) {
      out.push(p);
    }
  }
  return out;
}

const violations = [];

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  if (SKIP_REL_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
    continue;
  }
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (CONSOLE_RE.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: console.* forbidden in production src (use pino logger)`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-no-console-in-src: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-no-console-in-src: PASS");
