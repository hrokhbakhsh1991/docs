#!/usr/bin/env node
/**
 * ALS-FOOTGUN-01 / DEC-126 — forbid fire-and-forget async scheduling in HTTP route handlers.
 * @see apps/api/docs/phase2-paranoid-audit.md § ALS-FOOTGUN-01
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ROUTE_FILES = [
  "src/routes",
  "src/tours/tours.routes.ts",
  "src/tenant/tenant-config.routes.ts",
  "src/health/health.routes.ts",
  "src/routes/api-v2/map-enrich.routes.ts",
];

const FORBIDDEN = [
  {
    re: /\bsetImmediate\s*\(/,
    msg: "setImmediate forbidden in route handlers (ALS-FOOTGUN-01)",
  },
  {
    re: /\bprocess\.nextTick\s*\(/,
    msg: "process.nextTick forbidden in route handlers (ALS-FOOTGUN-01)",
  },
  {
    re: /\bvoid\s+[A-Za-z_$][\w$]*\s*\(/,
    msg: "void fire-and-forget call forbidden in route handlers (ALS-FOOTGUN-01)",
  },
];

function collectRouteFiles(entryPath, out = []) {
  const abs = path.join(ROOT, entryPath);
  if (!fs.existsSync(abs)) {
    return out;
  }
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    if (abs.endsWith(".ts") && !abs.endsWith(".spec.ts")) {
      out.push(abs);
    }
    return out;
  }
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      collectRouteFiles(path.join(entryPath, ent.name), out);
    } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) {
      out.push(path.join(abs, ent.name));
    }
  }
  return out;
}

const violations = [];

for (const entry of ROUTE_FILES) {
  for (const file of collectRouteFiles(entry)) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      for (const rule of FORBIDDEN) {
        if (rule.re.test(lines[i])) {
          violations.push(`${rel}:${i + 1}: ${rule.msg}`);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error("guard-route-handler-async-hygiene: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-route-handler-async-hygiene: PASS");
