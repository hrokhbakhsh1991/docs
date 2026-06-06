#!/usr/bin/env node
/**
 * DEC-115 — projection auto-reconcile scheduler wiring lock.
 * @see docs/phase-5/appendices/projection-auto-reconcile.md
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
  "src/outbox/projection-reconcile-queue.ts",
  "src/outbox/start-projection-auto-reconcile.ts",
  "src/outbox/reconcile-tour-projection.ts",
]) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

const queue = read("src/outbox/projection-reconcile-queue.ts");
if (!queue.includes("enqueueProjectionAutoReconcile")) {
  violations.push("projection-reconcile-queue.ts must export enqueueProjectionAutoReconcile");
}

const reconcile = read("src/outbox/reconcile-tour-projection.ts");
if (!reconcile.includes("repairTourProjectionIfDrifted")) {
  violations.push("reconcile-tour-projection.ts must export repairTourProjectionIfDrifted");
}
if (!reconcile.includes("projection_auto_repair_total")) {
  violations.push("reconcile-tour-projection.ts must increment projection_auto_repair_total");
}

const scheduler = read("src/outbox/start-projection-auto-reconcile.ts");
if (!scheduler.includes("startProjectionAutoReconcileIfEnabled")) {
  violations.push(
    "start-projection-auto-reconcile.ts must export startProjectionAutoReconcileIfEnabled"
  );
}

const projection = read("src/events/projection-reconciliation.ts");
if (!projection.includes("enqueueProjectionAutoReconcile")) {
  violations.push("projection-reconciliation.ts must enqueue auto-reconcile on inconsistency");
}

const main = read("src/main.ts");
if (!main.includes("startProjectionAutoReconcileIfEnabled")) {
  violations.push("main.ts must start projection auto-reconcile scheduler");
}

const metrics = read("src/observability/metrics.ts");
if (!metrics.includes("projection_auto_repair_total")) {
  violations.push("metrics.ts must register projection_auto_repair_total");
}

const pkg = read("package.json");
if (!pkg.includes("guard:projection-auto-reconcile")) {
  violations.push("package.json must define guard:projection-auto-reconcile");
}

if (violations.length > 0) {
  console.error("guard-projection-auto-reconcile: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-projection-auto-reconcile: PASS");
