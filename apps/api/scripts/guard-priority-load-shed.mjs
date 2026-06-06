#!/usr/bin/env node
/**
 * DEC-114 — tenant priority load shed wiring lock.
 * @see docs/phase-5/appendices/priority-load-shed.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

for (const rel of [
  "src/tenant/tenant-priority-tier.ts",
  "src/http/weighted-fair-admission.ts",
  "src/http/weighted-fair-admission.spec.ts",
]) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

const tier = read("src/tenant/tenant-priority-tier.ts");
if (!tier.includes("parsePriorityTierFromTheme")) {
  violations.push("tenant-priority-tier.ts must export parsePriorityTierFromTheme");
}
if (!tier.includes("priorityTier")) {
  violations.push("tenant-priority-tier.ts must read theme.priorityTier");
}

const admission = read("src/http/weighted-fair-admission.ts");
if (!admission.includes("acquireWeightedFairAdmission")) {
  violations.push("weighted-fair-admission.ts must export acquireWeightedFairAdmission");
}
if (!admission.includes("PriorityLoadShedError")) {
  violations.push("weighted-fair-admission.ts must export PriorityLoadShedError");
}

const bind = read("src/http/bind-request-context.ts");
if (!bind.includes("acquireWeightedFairAdmission")) {
  violations.push("bind-request-context.ts must acquire weighted fair admission");
}
if (!bind.includes("releaseWeightedFairAdmission")) {
  violations.push("bind-request-context.ts must release weighted fair admission in finally");
}

const interceptor = read("src/middleware/error-interceptor.ts");
if (!interceptor.includes("isPriorityLoadShedError")) {
  violations.push("error-interceptor.ts must handle PriorityLoadShedError");
}

const pkg = read("package.json");
if (!pkg.includes("guard:priority-load-shed")) {
  violations.push("package.json must define guard:priority-load-shed");
}

if (violations.length > 0) {
  console.error("guard-priority-load-shed: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-priority-load-shed: PASS");
