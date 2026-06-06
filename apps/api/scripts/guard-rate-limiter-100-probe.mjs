#!/usr/bin/env node
/**
 * SCAL-DEBT-14 / DEC-059 — 100-tenant rate-limiter flood probe must exist in CI.
 * @see docs/phase-5/appendices/rate-limiting.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = path.join(ROOT, "test/3-performance/tenant-rate-limiter-100.spec.ts");
const GATE = path.join(ROOT, "scripts/phase-3-regression-gate.mjs");

const violations = [];

if (!fs.existsSync(SPEC)) {
  violations.push("missing test/3-performance/tenant-rate-limiter-100.spec.ts");
} else {
  const source = fs.readFileSync(SPEC, "utf8");
  if (!source.includes("getAdminThemeLookupCountForTests")) {
    violations.push("tenant-rate-limiter-100.spec.ts must assert admin theme lookup budget");
  }
  if (!source.includes("TENANT_FLOOD_COUNT")) {
    violations.push("tenant-rate-limiter-100.spec.ts must define TENANT_FLOOD_COUNT probe");
  }
}

const gateSource = fs.readFileSync(GATE, "utf8");
if (!gateSource.includes("tenant-rate-limiter-100.spec.ts")) {
  violations.push("phase-3-regression-gate.mjs must include tenant-rate-limiter-100.spec.ts");
}

if (violations.length > 0) {
  console.error("guard-rate-limiter-100-probe: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-rate-limiter-100-probe: PASS");
