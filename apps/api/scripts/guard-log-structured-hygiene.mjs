#!/usr/bin/env node
/**
 * H-02 / DEC-128 — forbid raw error.message in pino structured objects under src/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const FORBIDDEN = [
  /\bmessage:\s*error\.message\b/,
  /\bmessage:\s*err\.message\b/,
  /\bstack:\s*error\.stack\b/,
  /\bstack:\s*err\.stack\b/,
];

function walk(dir, out = []) {
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
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/\blogger\.(error|warn|info)\(/.test(line)) {
      continue;
    }
    for (const rule of FORBIDDEN) {
      if (rule.test(line)) {
        violations.push(
          `${rel}:${i + 1}: structured log must use error_code, not raw message/stack`
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error("guard-log-structured-hygiene: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-log-structured-hygiene: PASS");
