#!/usr/bin/env node
/**
 * DEC-073 / DEC-080 — Phase 4 step 3 cross-phase P0 verify wiring lock.
 * @see docs/phase-5/appendices/phase4-cross-phase-p0-verify.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "../..");
const violations = [];

function read(rel, base = ROOT) {
  return fs.readFileSync(path.join(base, rel), "utf8");
}

function exists(rel, base = ROOT) {
  return fs.existsSync(path.join(base, rel));
}

const docPath = "docs/phase-5/appendices/phase4-cross-phase-p0-verify.md";
if (!exists(docPath, REPO)) {
  violations.push(`${docPath} must exist`);
} else {
  const doc = read(docPath, REPO);
  for (const token of [
    "DEC-073",
    "NN-01",
    "RL-DOS-01",
    "SCAL-HF-11",
    "SH-GAP-13",
    "phase-4-cross-phase-p0-verify",
  ]) {
    if (!doc.includes(token)) {
      violations.push(`${docPath} must mention ${token}`);
    }
  }
}

const gate = read("scripts/phase-4-cross-phase-p0-verify.mjs");
for (const guard of [
  "guard:validation-queue-depth",
  "guard:validation-workers",
  "guard:tenant-db-budget",
  "guard:tour-write-concurrency",
  "guard:rate-limit-theme-cache",
  "guard:rate-limiter-100-probe",
  "guard:production-redis-url",
  "guard:bulk-import-victim-slo",
]) {
  if (!gate.includes(guard)) {
    violations.push(`phase-4-cross-phase-p0-verify.mjs must run ${guard}`);
  }
}
if (!gate.includes("validation-worker-pool.spec.ts")) {
  violations.push("phase-4-cross-phase-p0-verify.mjs must run validation-worker-pool.spec.ts");
}
if (!gate.includes("build-dist")) {
  violations.push("phase-4-cross-phase-p0-verify.mjs must build dist before worker specs");
}
if (!gate.includes("bulk-import-victim-slo.spec.ts")) {
  violations.push("phase-4-cross-phase-p0-verify.mjs must run bulk-import-victim-slo.spec.ts");
}

if (!gate.includes("requireGateDatabase")) {
  violations.push("phase-4-cross-phase-p0-verify.mjs must call requireGateDatabase (DEC-080)");
}

if (gate.includes("if (HAS_DATABASE)")) {
  violations.push(
    "phase-4-cross-phase-p0-verify.mjs must not use optional HAS_DATABASE tier (DEC-080)"
  );
}

if (!gate.includes("phase4-cross-phase-postgres-specs")) {
  violations.push(
    "phase-4-cross-phase-p0-verify.mjs must define phase4-cross-phase-postgres-specs step"
  );
}

if (!gate.includes("postgresRequired")) {
  violations.push("phase-4-cross-phase-p0-verify.mjs must emit postgresRequired in artifact");
}

if (!gate.includes("db-pool-saturation.spec.ts")) {
  violations.push("phase-4-cross-phase-p0-verify.mjs must run db-pool-saturation.spec.ts");
}

if (!gate.includes("--test-force-exit")) {
  violations.push("phase-4-cross-phase-p0-verify.mjs postgres tier must use --test-force-exit");
}

const pkg = read("package.json");
if (!pkg.includes("phase-4:cross-phase-p0-verify")) {
  violations.push("package.json must define phase-4:cross-phase-p0-verify script");
}

const specPath = "test/reliability/phase-4-cross-phase-p0-verify.spec.ts";
if (!exists(specPath)) {
  violations.push(`${specPath} must exist`);
}

if (violations.length > 0) {
  console.error("guard-phase4-cross-phase-p0: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-phase4-cross-phase-p0: PASS");
