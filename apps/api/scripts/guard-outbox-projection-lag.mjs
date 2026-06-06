#!/usr/bin/env node
/**
 * DEC-088 — projection lag metric + reconcile job wiring lock.
 * @see docs/phase-5/appendices/outbox-projection-reconcile.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

const metrics = read("src/observability/metrics.ts");
if (!metrics.includes("outbox_projection_lag_seconds")) {
  violations.push("metrics.ts must register outbox_projection_lag_seconds");
}
if (!metrics.includes("observe(")) {
  violations.push("metrics.ts must expose observe for gauge metrics");
}

const reconciliation = read("src/events/projection-reconciliation.ts");
if (!reconciliation.includes("outbox_projection_lag_seconds")) {
  violations.push("projection-reconciliation.ts must observe outbox_projection_lag_seconds");
}

if (!exists("src/outbox/reconcile-tour-projection.ts")) {
  violations.push("reconcile-tour-projection.ts must exist");
}

if (!exists("scripts/reconcile-tour-projection.mjs")) {
  violations.push("scripts/reconcile-tour-projection.mjs must exist");
}

const pkg = read("package.json");
if (!pkg.includes("reconcile:tour-projection")) {
  violations.push("package.json must define reconcile:tour-projection");
}

if (violations.length > 0) {
  console.error("guard-outbox-projection-lag: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-outbox-projection-lag: PASS");
