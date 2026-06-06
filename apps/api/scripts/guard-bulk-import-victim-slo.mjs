#!/usr/bin/env node
/**
 * SCAL-DEBT-13 / DEC-069 — bulk import ∥ victim login/read SLO spec.
 * @see docs/phase-5/appendices/victim-slo-bulk-import.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATE = path.join(ROOT, "scripts/phase-3-regression-gate.mjs");
const SPEC = path.join(ROOT, "test/3-performance/bulk-import-victim-slo.spec.ts");
const violations = [];

if (!fs.existsSync(SPEC)) {
  violations.push("bulk-import-victim-slo.spec.ts must exist");
} else {
  const source = fs.readFileSync(SPEC, "utf8");
  if (!source.includes("/api/v2/tenant-config")) {
    violations.push("bulk-import-victim-slo.spec.ts must probe tenant-config");
  }
  if (!source.includes("/health")) {
    violations.push("bulk-import-victim-slo.spec.ts must probe /health");
  }
  if (!source.includes("BULK_IMPORT_PARALLEL")) {
    violations.push("bulk-import-victim-slo.spec.ts must define bulk import parallelism");
  }
  if (!source.includes("VICTIM_SLO_RATIO")) {
    violations.push("bulk-import-victim-slo.spec.ts must define victim SLO ratio");
  }
}

const gateSource = fs.readFileSync(GATE, "utf8");
if (!gateSource.includes("bulk-import-victim-slo.spec.ts")) {
  violations.push("phase-3-regression-gate must run bulk-import-victim-slo.spec.ts");
}

if (violations.length > 0) {
  console.error("guard-bulk-import-victim-slo: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-bulk-import-victim-slo: PASS");
