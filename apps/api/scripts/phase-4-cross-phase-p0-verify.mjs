#!/usr/bin/env node
/**
 * Phase 4 step 3 — cross-phase P0 verify (NN / RL-DOS / Redis from Phase 3).
 * @see docs/phase-5/appendices/phase4-cross-phase-p0-verify.md DEC-073, DEC-080
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { requireGateDatabase } from "./lib/require-gate-database.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

requireGateDatabase({ gateName: "phase-4-cross-phase-p0-verify" });

const MEMORY_SPECS = [
  "test/3-performance/validation-queue-depth.spec.ts",
  "test/3-performance/validation-worker-pool.spec.ts",
  "test/3-performance/tenant-connection-budget.spec.ts",
  "test/3-performance/tour-write-concurrency.spec.ts",
  "test/3-performance/tenant-rate-limiter-100.spec.ts",
  "test/3-performance/bulk-import-victim-slo.spec.ts",
  "src/server/production-runtime-env.spec.ts",
];

const POSTGRES_SPECS = ["test/3-performance/db-pool-saturation.spec.ts"];

const STEPS = [
  { id: "guard:validation-queue-depth", cmd: ["pnpm", "run", "guard:validation-queue-depth"] },
  { id: "guard:validation-workers", cmd: ["pnpm", "run", "guard:validation-workers"] },
  { id: "guard:tenant-db-budget", cmd: ["pnpm", "run", "guard:tenant-db-budget"] },
  { id: "guard:tour-write-concurrency", cmd: ["pnpm", "run", "guard:tour-write-concurrency"] },
  { id: "guard:rate-limit-theme-cache", cmd: ["pnpm", "run", "guard:rate-limit-theme-cache"] },
  {
    id: "guard:tenant-registry-cache-bounds",
    cmd: ["pnpm", "run", "guard:tenant-registry-cache-bounds"],
  },
  { id: "guard:rate-limiter-100-probe", cmd: ["pnpm", "run", "guard:rate-limiter-100-probe"] },
  { id: "guard:production-redis-url", cmd: ["pnpm", "run", "guard:production-redis-url"] },
  { id: "guard:bulk-import-victim-slo", cmd: ["pnpm", "run", "guard:bulk-import-victim-slo"] },
  { id: "build-dist", cmd: ["pnpm", "run", "build"] },
  {
    id: "phase4-cross-phase-p0-specs",
    cmd: [
      "node",
      "--import",
      "tsx",
      "--test",
      "--test-force-exit",
      "--test-concurrency=1",
      ...MEMORY_SPECS,
    ],
    env: {
      NODE_ENV: "test",
      STORAGE_DRIVER: "memory",
      OUTBOX_RELAY_ENABLED: "false",
      P5_VALIDATION_WORKERS_ENABLED: "false",
    },
  },
  {
    id: "phase4-cross-phase-postgres-specs",
    cmd: [
      "node",
      "--import",
      "tsx",
      "--test",
      "--test-force-exit",
      "--test-concurrency=1",
      ...POSTGRES_SPECS,
    ],
    env: {
      NODE_ENV: "test",
      STORAGE_DRIVER: "prisma",
      P5_DB_HOLD_MS: "250",
      TENANT_MAX_CONCURRENT_DB_OPS: "100",
    },
  },
];

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

console.log("phase-4-cross-phase-p0-verify: starting (DEC-073, DEC-080)");
console.log("  DATABASE_URL: set (postgres tier required)");
console.log("  postgresRequired: true");

for (const step of STEPS) {
  console.log(`\n--- ${step.id} ---`);
  const record = runStep(step);
  results.push(record);
  if (record.status !== "PASS") {
    failed = true;
    console.error(`phase-4-cross-phase-p0-verify: FAIL at ${step.id}`);
    break;
  }
}

const summary = {
  gate: "phase-4-cross-phase-p0-verify",
  decision: "DEC-073",
  waveA: "DEC-080",
  postgresRequired: true,
  closes: ["CASCADE-01-partial", "CASCADE-03-partial"],
  verifies: ["NN-01", "NN-02", "RL-DOS-01", "SCAL-HF-11-partial"],
  residual: ["RL-DOS-04", "SH-GAP-13"],
  startedAt,
  finishedAt: new Date().toISOString(),
  databaseUrlSet: true,
  verdict: failed ? "FAIL" : "PASS",
  steps: results,
};

const outPath = path.join(
  ROOT,
  "test",
  "reliability",
  "phase-4-cross-phase-p0-verify.last-run.json"
);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

if (failed) {
  console.error(`\nphase-4-cross-phase-p0-verify: FAIL — see ${path.relative(ROOT, outPath)}`);
  process.exit(1);
}

console.log(`\nphase-4-cross-phase-p0-verify: PASS — ${results.length} steps`);
console.log(`  wrote ${path.relative(ROOT, outPath)}`);
