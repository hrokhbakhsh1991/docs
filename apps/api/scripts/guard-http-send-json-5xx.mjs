#!/usr/bin/env node
/**
 * ERR-GAP-01 / DEC-127 — forbid leaking raw Error.message in 5xx sendJson bodies outside interceptor.
 * @see apps/api/docs/phase2-paranoid-audit.md § ERR-GAP-01
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const ALLOWLIST = new Set([
  "src/middleware/error-interceptor.ts",
  "src/http/shutdown-ingress.ts",
  "src/health/health.routes.ts",
]);

const FORBIDDEN = [
  {
    re: /sendJson\s*\(\s*res\s*,\s*5\d\d[\s\S]{0,160}error:\s*error\.message/,
    msg: "sendJson 5xx must not use error.message (use handleHttpError or stable code)",
  },
  {
    re: /sendJson\s*\(\s*res\s*,\s*5\d\d[\s\S]{0,160}error:\s*message\b/,
    msg: "sendJson 5xx must not echo raw message variable",
  },
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
  if (ALLOWLIST.has(rel)) {
    continue;
  }
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/sendJson\s*\(\s*res\s*,\s*5/.test(line)) {
      continue;
    }
    const window = lines.slice(i, i + 4).join("\n");
    for (const rule of FORBIDDEN) {
      if (rule.re.test(window)) {
        violations.push(`${rel}:${i + 1}: ${rule.msg}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("guard-http-send-json-5xx: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-http-send-json-5xx: PASS");
