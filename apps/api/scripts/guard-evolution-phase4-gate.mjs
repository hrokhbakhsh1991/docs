#!/usr/bin/env node
/**
 * DEC-117 — evolution Phase 4 gate rollup wiring lock.
 * @see docs/phase-5/appendices/phase5-evolution-phase4-gate.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const requiredPhase4Guards = [
  "guard:outbox-auto-retry",
  "guard:relay-backoff",
  "guard:canonical-tx-transient-retry",
  "guard:pool-saturation-retry-after",
  "guard:priority-load-shed",
  "guard:projection-auto-reconcile",
];

if (!fs.existsSync(path.join(ROOT, "scripts/phase-5-evolution-phase4-gate.mjs"))) {
  violations.push("scripts/phase-5-evolution-phase4-gate.mjs must exist");
}

const phase4Gate = read("scripts/phase-5-evolution-phase4-gate.mjs");
if (!phase4Gate.includes("PHASE4_EVOLUTION_STEPS")) {
  violations.push("phase-5-evolution-phase4-gate.mjs must export PHASE4_EVOLUTION_STEPS");
}

for (const guard of requiredPhase4Guards) {
  if (!phase4Gate.includes(guard)) {
    violations.push(`phase-5-evolution-phase4-gate.mjs must include ${guard}`);
  }
}

const parentGate = read("scripts/phase-5-evolution-gate.mjs");
if (!parentGate.includes("phase-5:evolution-phase4-gate")) {
  violations.push("phase-5-evolution-gate.mjs must invoke phase-5:evolution-phase4-gate");
}

const pkg = read("package.json");
if (!pkg.includes("phase-5:evolution-phase4-gate")) {
  violations.push("package.json must define phase-5:evolution-phase4-gate");
}
if (!pkg.includes("guard:evolution-phase4-gate")) {
  violations.push("package.json must define guard:evolution-phase4-gate");
}

if (violations.length > 0) {
  console.error("guard-evolution-phase4-gate: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-evolution-phase4-gate: PASS");
