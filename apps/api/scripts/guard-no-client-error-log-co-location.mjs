#!/usr/bin/env node
/**
 * LOG-COL-06 / LOG-COL-07 — forbid logging enriched client errors with tenant_id + message.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-038
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

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
  const lines = fs.readFileSync(file, "utf8").split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/\blogger\.(error|warn|info|fatal)\b/.test(line)) {
      continue;
    }

    if (/\blogger\.(error|warn|info|fatal)\(\s*(error|failure|err)\b/.test(line)) {
      violations.push(
        `${rel}:${i + 1}: do not pass raw error/failure to logger — use safe serializers (DEC-038)`
      );
    }

    if (/ValidationFailure|SchemaVersionMismatchError/.test(line)) {
      violations.push(
        `${rel}:${i + 1}: do not log ValidationFailure / SchemaVersionMismatchError directly`
      );
    }

    const hasTenantKey = /\b(tenant_id|tenantId)\s*:/.test(line);
    const hasMessageKey = /\bmessage\s*:/.test(line);
    if (hasTenantKey && hasMessageKey) {
      violations.push(
        `${rel}:${i + 1}: logger call co-locates tenant_id and message on shared stream`
      );
    }
  }
}

if (violations.length > 0) {
  console.error("guard-no-client-error-log-co-location: FAIL");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("guard-no-client-error-log-co-location: PASS");
