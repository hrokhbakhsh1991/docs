#!/usr/bin/env node
/**
 * ERR-BYPASS-01 / DEC-126 — internal routes must use handleHttpError for correlation parity.
 * @see apps/api/docs/phase2-paranoid-audit.md § ERR-BYPASS-01
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED = [
  {
    file: "src/routes/internal/tenants.ts",
    mustImport: "handleHttpError",
    mustCall: "handleHttpError(res, error)",
  },
  {
    file: "src/routes/internal/db-pool-hold.ts",
    mustImport: "handleHttpError",
    mustCall: "handleHttpError(res, error)",
  },
  {
    file: "src/routes/internal/outbox-replay.ts",
    mustImport: "handleHttpError",
    mustCall: "handleHttpError(res, error)",
  },
];

const violations = [];

for (const rule of REQUIRED) {
  const abs = path.join(ROOT, rule.file);
  if (!fs.existsSync(abs)) {
    violations.push(`${rule.file}: missing file`);
    continue;
  }
  const source = fs.readFileSync(abs, "utf8");
  if (!source.includes(rule.mustImport)) {
    violations.push(`${rule.file}: must import ${rule.mustImport}`);
  }
  if (!source.includes(rule.mustCall)) {
    violations.push(`${rule.file}: must call ${rule.mustCall} in catch`);
  }
  if (/\bmap\w+ErrorToStatus\b/.test(source)) {
    violations.push(`${rule.file}: local error mapper forbidden — use handleHttpError`);
  }
}

if (violations.length > 0) {
  console.error("guard-internal-route-http-error: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-internal-route-http-error: PASS");
