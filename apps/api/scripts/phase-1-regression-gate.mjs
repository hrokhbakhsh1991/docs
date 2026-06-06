#!/usr/bin/env node
/**
 * Phase 1 formal regression gate — DEC-040.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-040
 * @see apps/api/docs/phase1-aggressive-audit.md § Regression gate run log
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HAS_DATABASE = Boolean(process.env.DATABASE_URL?.trim());

const ISOLATION_SPECS = [
  "test/0-security/tenant-request-context-isolation.spec.ts",
  "test/0-security/async-context-leak.spec.ts",
  "test/0-security/tenant-injection.spec.ts",
  "test/0-security/tenant-rls-als-alignment.spec.ts",
  "test/security-isolation-stress.spec.ts",
  "test/1-functional/validation-gate-concurrency.spec.ts",
  "test/4-integration/bulk-import-consistency.spec.ts",
  "src/storage/in-memory-tour.repository.spec.ts",
];

const OBSERVABILITY_SPECS = [
  "src/observability/log-safety.spec.ts",
  "src/canonical/validation-failure.spec.ts",
  "src/canonical/schema-version-mismatch.spec.ts",
  "src/events/projection-reconciliation.spec.ts",
  "test/2-observability/error-enrichment.spec.ts",
  "test/2-observability/log-privacy.spec.ts",
];

const STEP3_SPECS = [
  "src/tenant/tenant-registry.spec.ts",
  "src/http/http-idempotency.memory.spec.ts",
  "src/server/production-runtime-env.spec.ts",
];

const P2_SPECS = [
  "test/1-integration/memory-mixed-tenant-http.spec.ts",
  "test/1-functional/tours-list.spec.ts",
];

const POSTGRES_SPECS = [
  "test/0-security/raw-sql-exposure.spec.ts",
  "test/5.4-S4-idempotency.spec.ts",
];

const STEPS = [
  { id: "guard:tenant-isolation", cmd: ["pnpm", "run", "guard:tenant-isolation"] },
  { id: "guard:client-error-log", cmd: ["pnpm", "run", "guard:client-error-log"] },
  { id: "guard:static-registry", cmd: ["pnpm", "run", "guard:static-registry"] },
  {
    id: "stress-tenant-context-switch",
    cmd: ["npx", "tsx", "scripts/stress-tenant-context-switch.ts"],
    env: { NODE_ENV: "test" },
  },
  {
    id: "verify-als-request-cleanup",
    cmd: ["npx", "tsx", "scripts/verify-als-request-cleanup.ts"],
    env: { NODE_ENV: "test", STORAGE_DRIVER: "memory" },
  },
  {
    id: "isolation-specs",
    cmd: [
      "node",
      "--import",
      "tsx",
      "--test",
      "--test-concurrency=1",
      ...ISOLATION_SPECS,
      "src/canonical/canonical-tour.service.spec.ts",
    ],
    env: { NODE_ENV: "test", STORAGE_DRIVER: "memory", OUTBOX_RELAY_ENABLED: "false" },
  },
  {
    id: "observability-specs",
    cmd: ["node", "--import", "tsx", "--test", "--test-concurrency=1", ...OBSERVABILITY_SPECS],
    env: { NODE_ENV: "test", STORAGE_DRIVER: "memory", OUTBOX_RELAY_ENABLED: "false" },
  },
  {
    id: "step3-medium-specs",
    cmd: ["node", "--import", "tsx", "--test", "--test-concurrency=1", ...STEP3_SPECS],
    env: { NODE_ENV: "test" },
  },
  {
    id: "p2-zero-debt-specs",
    cmd: ["node", "--import", "tsx", "--test", "--test-concurrency=1", ...P2_SPECS],
    env: { NODE_ENV: "test", STORAGE_DRIVER: "memory", OUTBOX_RELAY_ENABLED: "false" },
  },
];

if (HAS_DATABASE) {
  STEPS.push({
    id: "postgres-specs",
    cmd: ["node", "--import", "tsx", "--test", "--test-concurrency=1", ...POSTGRES_SPECS],
    env: { NODE_ENV: "test" },
  });
}

function runStep(step) {
  const started = Date.now();
  const env = { ...process.env, ...(step.env ?? {}) };
  const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: false,
  });
  return {
    id: step.id,
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status ?? 1,
    durationMs: Date.now() - started,
    skipped: false,
  };
}

const startedAt = new Date().toISOString();
const results = [];
let failed = false;

console.log("phase-1-regression-gate: starting (DEC-040)");
console.log(
  `  DATABASE_URL: ${HAS_DATABASE ? "set (postgres tier enabled)" : "unset (postgres tier skipped)"}`
);

for (const step of STEPS) {
  console.log(`\n--- ${step.id} ---`);
  const record = runStep(step);
  results.push(record);
  if (record.status !== "PASS") {
    failed = true;
    console.error(`phase-1-regression-gate: FAIL at ${step.id}`);
    break;
  }
}

const summary = {
  gate: "phase-1-regression-gate",
  decision: "DEC-040",
  startedAt,
  finishedAt: new Date().toISOString(),
  databaseUrlSet: HAS_DATABASE,
  verdict: failed ? "FAIL" : "PASS",
  steps: results,
};

const outPath = path.join(ROOT, "test", "reliability", "phase-1-regression-gate.last-run.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

if (failed) {
  console.error(`\nphase-1-regression-gate: FAIL — see ${path.relative(ROOT, outPath)}`);
  process.exit(1);
}

console.log(`\nphase-1-regression-gate: PASS — ${results.length} steps`);
console.log(`  wrote ${path.relative(ROOT, outPath)}`);
