#!/usr/bin/env node
/**
 * Phase 3 formal regression gate — DEC-057.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-057
 * @see apps/api/docs/phase3-scalability-stress-audit.md § Phase 3 closure step 6
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GATE_BUILD_DIST_STEP } from "./lib/gate-build-dist.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HAS_DATABASE = Boolean(process.env.DATABASE_URL?.trim());

const MEMORY_SPECS = [
  "test/3-performance/request-body-limit.spec.ts",
  "src/http/json.spec.ts",
  "src/tenant/tenant-config-response-cache.spec.ts",
  "src/tenant/resolve-tenant-theme-cache.spec.ts",
  "test/3-performance/validation-queue-depth.spec.ts",
  "test/3-performance/tenant-connection-budget.spec.ts",
  "test/3-performance/validation-worker-pool.spec.ts",
  "test/3-performance/tenant-rate-limiter-100.spec.ts",
  "src/storage/create-tour-storage.spec.ts",
  "src/storage/forensic-storage-driver.spec.ts",
  "test/1-functional/validation-gate-concurrency.spec.ts",
];

const POSTGRES_SPECS = ["test/3-performance/db-pool-saturation.spec.ts"];

const STEPS = [
  { id: "guard:http-body-limit", cmd: ["pnpm", "run", "guard:http-body-limit"] },
  {
    id: "guard:http-response-size-budget",
    cmd: ["pnpm", "run", "guard:http-response-size-budget"],
  },
  { id: "guard:rate-limit-theme-cache", cmd: ["pnpm", "run", "guard:rate-limit-theme-cache"] },
  { id: "guard:validation-queue-depth", cmd: ["pnpm", "run", "guard:validation-queue-depth"] },
  { id: "guard:tenant-db-budget", cmd: ["pnpm", "run", "guard:tenant-db-budget"] },
  { id: "guard:validation-workers", cmd: ["pnpm", "run", "guard:validation-workers"] },
  { id: "guard:rate-limiter-100-probe", cmd: ["pnpm", "run", "guard:rate-limiter-100-probe"] },
  {
    id: "guard:production-storage-driver",
    cmd: ["pnpm", "run", "guard:production-storage-driver"],
  },
  {
    id: "guard:cold-start-readiness-gate",
    cmd: ["pnpm", "run", "guard:cold-start-readiness-gate"],
  },
  {
    id: "guard:cold-start-tsx-waiver",
    cmd: ["pnpm", "run", "guard:cold-start-tsx-waiver"],
  },
  {
    id: "guard:log-backpressure-contract",
    cmd: ["pnpm", "run", "guard:log-backpressure-contract"],
  },
  {
    id: "guard:fof-log-03-shutdown-tail",
    cmd: ["pnpm", "run", "guard:fof-log-03-shutdown-tail"],
  },
  { id: "guard:tour-write-concurrency", cmd: ["pnpm", "run", "guard:tour-write-concurrency"] },
  { id: "guard:production-redis-url", cmd: ["pnpm", "run", "guard:production-redis-url"] },
  {
    id: "guard:outbox-relay-tenant-budget",
    cmd: ["pnpm", "run", "guard:outbox-relay-tenant-budget"],
  },
  {
    id: "guard:http-idempotency-memory-bounds",
    cmd: ["pnpm", "run", "guard:http-idempotency-memory-bounds"],
  },
  {
    id: "guard:tenant-registry-cache-bounds",
    cmd: ["pnpm", "run", "guard:tenant-registry-cache-bounds"],
  },
  {
    id: "guard:bulk-import-victim-slo",
    cmd: ["pnpm", "run", "guard:bulk-import-victim-slo"],
  },
  {
    id: "guard:health-priority-lane",
    cmd: ["pnpm", "run", "guard:health-priority-lane"],
  },
  {
    id: "guard:health-probe-latency-monitor",
    cmd: ["pnpm", "run", "guard:health-probe-latency-monitor"],
  },
  {
    id: "guard:pool-leak-post-storm",
    cmd: ["pnpm", "run", "guard:pool-leak-post-storm"],
  },
  {
    id: "guard:admin-pool-read-monitor",
    cmd: ["pnpm", "run", "guard:admin-pool-read-monitor"],
  },
  {
    id: "guard:validation-queue-monitor",
    cmd: ["pnpm", "run", "guard:validation-queue-monitor"],
  },
  {
    id: "guard:tour-write-concurrency-monitor",
    cmd: ["pnpm", "run", "guard:tour-write-concurrency-monitor"],
  },
  {
    id: "guard:outbox-relay-monitor",
    cmd: ["pnpm", "run", "guard:outbox-relay-monitor"],
  },
  {
    id: "guard:outbox-relay-pool-contention",
    cmd: ["pnpm", "run", "guard:outbox-relay-pool-contention"],
  },
  {
    id: "guard:outbox-relay-tick-monitor",
    cmd: ["pnpm", "run", "guard:outbox-relay-tick-monitor"],
  },
  {
    id: "guard:phase3-doc-alignment",
    cmd: ["pnpm", "run", "guard:phase3-doc-alignment"],
  },
  {
    id: "guard:outbox-relay-lag-monitor",
    cmd: ["pnpm", "run", "guard:outbox-relay-lag-monitor"],
  },
  {
    id: "guard:deploy-hpa",
    cmd: ["pnpm", "run", "guard:deploy-hpa"],
  },
  {
    id: "guard:http-json-pressure-monitor",
    cmd: ["pnpm", "run", "guard:http-json-pressure-monitor"],
  },
  {
    id: "guard:redis-rate-limiter-fallback",
    cmd: ["pnpm", "run", "guard:redis-rate-limiter-fallback"],
  },
  {
    id: "guard:domain-event-async-dispatch",
    cmd: ["pnpm", "run", "guard:domain-event-async-dispatch"],
  },
  {
    id: "guard:domain-event-handler-monitor",
    cmd: ["pnpm", "run", "guard:domain-event-handler-monitor"],
  },
  {
    id: "phase3-p0-closure-specs",
    cmd: [
      "node",
      "--import",
      "tsx",
      "--test",
      "--test-force-exit",
      "--test-concurrency=1",
      ...MEMORY_SPECS,
      "src/observability/logger-backpressure.spec.ts",
      "src/http/request-logging.spec.ts",
      "test/3-performance/tour-write-concurrency.spec.ts",
      "src/server/production-runtime-env.spec.ts",
      "test/3-performance/outbox-relay-tenant-budget.spec.ts",
      "src/http/http-idempotency.memory.spec.ts",
      "src/tenant/tenant-registry-cache.spec.ts",
      "test/3-performance/bulk-import-victim-slo.spec.ts",
      "src/boot/health-priority-ingress.spec.ts",
    ],
    env: {
      NODE_ENV: "test",
      STORAGE_DRIVER: "memory",
      OUTBOX_RELAY_ENABLED: "false",
      P5_VALIDATION_WORKERS_ENABLED: "false",
    },
  },
  GATE_BUILD_DIST_STEP,
  {
    id: "cold-start-readiness-gate",
    cmd: ["pnpm", "run", "cold-start-readiness-gate"],
    env: {
      NODE_ENV: "test",
      STORAGE_DRIVER: "memory",
      OUTBOX_RELAY_ENABLED: "false",
      COLD_START_READINESS_ENFORCE: "false",
    },
  },
];

if (HAS_DATABASE) {
  STEPS.push({
    id: "phase3-postgres-pool-specs",
    cmd: ["node", "--import", "tsx", "--test", "--test-concurrency=1", ...POSTGRES_SPECS],
    env: {
      NODE_ENV: "test",
      STORAGE_DRIVER: "prisma",
      P5_DB_HOLD_MS: "250",
      TENANT_MAX_CONCURRENT_DB_OPS: "100",
    },
  });
}

function runStep(step) {
  const started = Date.now();
  const env = { ...process.env, ...(step.env ?? {}) };
  const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
    cwd: step.cwd ?? ROOT,
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

console.log("phase-3-regression-gate: starting (DEC-057)");
console.log(
  `  DATABASE_URL: ${HAS_DATABASE ? "set (postgres tier enabled)" : "unset (postgres tier skipped)"}`
);

for (const step of STEPS) {
  console.log(`\n--- ${step.id} ---`);
  const record = runStep(step);
  results.push(record);
  if (record.status !== "PASS") {
    failed = true;
    console.error(`phase-3-regression-gate: FAIL at ${step.id}`);
    break;
  }
}

const summary = {
  gate: "phase-3-regression-gate",
  decision: "DEC-057",
  startedAt,
  finishedAt: new Date().toISOString(),
  databaseUrlSet: HAS_DATABASE,
  verdict: failed ? "FAIL" : "PASS",
  steps: results,
};

const outPath = path.join(ROOT, "test", "reliability", "phase-3-regression-gate.last-run.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

if (failed) {
  console.error(`\nphase-3-regression-gate: FAIL — see ${path.relative(ROOT, outPath)}`);
  process.exit(1);
}

console.log(`\nphase-3-regression-gate: PASS — ${results.length} steps`);
console.log(`  wrote ${path.relative(ROOT, outPath)}`);
