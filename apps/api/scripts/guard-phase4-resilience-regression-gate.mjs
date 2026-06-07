#!/usr/bin/env node
/**
 * DEC-079 / DEC-080 — Phase 4 resilience regression gate wiring lock.
 * @see docs/phase-5/appendices/phase4-resilience-regression-gate.md
 * @see docs/phase-5/appendices/postgres-required-gates.md
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

const docPath = "docs/phase-5/appendices/phase4-resilience-regression-gate.md";
if (!exists(docPath, REPO)) {
  violations.push(`${docPath} must exist`);
} else {
  const doc = read(docPath, REPO);
  for (const token of [
    "DEC-079",
    "phase-4:resilience-regression-gate",
    "CLOSURE_PASS_WITH_RESIDUAL",
  ]) {
    if (!doc.includes(token)) {
      violations.push(`${docPath} must mention ${token}`);
    }
  }
}

const postgresDoc = "docs/phase-5/appendices/postgres-required-gates.md";
if (!exists(postgresDoc, REPO)) {
  violations.push(`${postgresDoc} must exist (DEC-080)`);
}

if (!exists("scripts/lib/require-gate-database.mjs")) {
  violations.push("scripts/lib/require-gate-database.mjs must exist (DEC-080)");
}

const gate = read("scripts/phase-4-resilience-regression-gate.mjs");
for (const guard of [
  "guard:outbox-processing-reclaim",
  "guard:outbox-publish-done-pairing",
  "guard:tenant-registry-cache-invalidation",
  "guard:proxy-upstream-timeout",
  "guard:graceful-shutdown-outbox",
  "guard:canonical-transaction-now",
  "guard:patch-schema-drift",
  "guard:phase4-cross-phase-p0",
  "phase-4:cross-phase-p0-verify",
]) {
  if (!gate.includes(guard)) {
    violations.push(`phase-4-resilience-regression-gate.mjs must run ${guard}`);
  }
}

for (const spec of [
  "schema-version-compat.spec.ts",
  "proxy-upstream-timeout.spec.ts",
  "graceful-shutdown-outbox.spec.ts",
  "canonical-transaction-now.spec.ts",
  "clock-skew-resilience.spec.ts",
  "dynamic-config-sync.spec.ts",
  "outbox-relay.integration.spec.ts",
  "outbox-transactional.integration.spec.ts",
  "outbox-failed-replay.spec.ts",
  "outbox-relay-ordered-per-tenant.spec.ts",
  "atomic-rollback-stress.spec.ts",
  "bulk-import-victim-slo.spec.ts",
  "tenant-registry-cache-coherence.spec.ts",
  "malformed-json-body.spec.ts",
  "proxy-production-wire.spec.ts",
]) {
  if (!gate.includes(spec)) {
    violations.push(`phase-4-resilience-regression-gate.mjs must run ${spec}`);
  }
}

if (!gate.includes("requireGateDatabase")) {
  violations.push("gate must call requireGateDatabase (DEC-080)");
}

if (gate.includes("if (HAS_DATABASE)")) {
  violations.push("gate must not use optional HAS_DATABASE postgres tier (DEC-080)");
}

if (!gate.includes("phase4-resilience-postgres-specs")) {
  violations.push("gate must define phase4-resilience-postgres-specs step (DEC-082)");
}

if (!gate.includes("--test-force-exit")) {
  violations.push("gate postgres tier must use --test-force-exit (open handle drain)");
}

if (!gate.includes("postgresRequired")) {
  violations.push("gate must emit postgresRequired in artifact (DEC-080)");
}

if (!gate.includes("chaosVerdictAfter")) {
  violations.push("gate must emit sign-off chaosVerdictAfter in artifact");
}

const pkg = read("package.json");
if (!pkg.includes("phase-4:resilience-regression-gate")) {
  violations.push("package.json must define phase-4:resilience-regression-gate");
}

const specPath = "test/reliability/phase-4-resilience-regression-gate.spec.ts";
if (!exists(specPath)) {
  violations.push(`${specPath} must exist`);
}

for (const guard of [
  "guard:outbox-failed-replay",
  "guard:outbox-relay-ordered-per-tenant",
  "guard:outbox-projection-lag",
  "guard:tenant-registry-cache-coherence",
  "guard:migrate-canonical-placeholder",
  "guard:http-malformed-json",
  "guard:proxy-production-wire",
]) {
  if (!gate.includes(guard)) {
    violations.push(`phase-4-resilience-regression-gate.mjs must run ${guard}`);
  }
}

if (!gate.includes("P5_CHAOS_ITERATIONS")) {
  violations.push("gate postgres tier must set P5_CHAOS_ITERATIONS for chaos fast path (DEC-089)");
}

if (!gate.includes("OUTBOX_RELAY_ORDERED_PER_TENANT")) {
  violations.push("gate postgres tier must set OUTBOX_RELAY_ORDERED_PER_TENANT (DEC-087)");
}

if (!gate.includes("APPS_API_TEST_TIER")) {
  violations.push(
    "gate postgres tier must set APPS_API_TEST_TIER=nightly for chaos atomic-rollback (DEC-089)"
  );
}

if (gate.includes("noisy-neighbor-latency.spec.ts")) {
  violations.push(
    "noisy-neighbor-latency.spec.ts must not run in blocking phase-4 gate — nightly workflow only (cross-phase P0 NN-01)"
  );
}

if (violations.length > 0) {
  console.error("guard-phase4-resilience-regression-gate: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-phase4-resilience-regression-gate: PASS");
