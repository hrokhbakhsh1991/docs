#!/usr/bin/env node
/**
 * Phase 2 formal regression gate — DEC-050.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-050
 * @see apps/api/docs/phase2-paranoid-audit.md § Phase 2 closure step 8
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HAS_DATABASE = Boolean(process.env.DATABASE_URL?.trim());

const MEMORY_SPECS = [
  "src/http/bind-request-context.spec.ts",
  "test/2-observability/access-log-correlation.spec.ts",
  "test/2-observability/log-privacy.spec.ts",
  "test/2-observability/trace-isolation.spec.ts",
  "test/2-observability/tenant-metrics.spec.ts",
  "src/observability/metrics.spec.ts",
  "src/storage/forensic-storage-driver.spec.ts",
  "src/storage/create-tour-storage.spec.ts",
  "src/server/production-runtime-env.spec.ts",
];

const POSTGRES_SPECS = [
  "test/2-observability/outbox-http-correlation.spec.ts",
  "test/5.5-audit-events.spec.ts",
];

const STEPS = [
  { id: "guard:no-console-src", cmd: ["pnpm", "run", "guard:no-console-src"] },
  { id: "guard:forensic-storage", cmd: ["pnpm", "run", "guard:forensic-storage"] },
  { id: "guard:outbox-correlation", cmd: ["pnpm", "run", "guard:outbox-correlation"] },
  { id: "guard:tour-update-audit", cmd: ["pnpm", "run", "guard:tour-update-audit"] },
  { id: "guard:http-access-trace", cmd: ["pnpm", "run", "guard:http-access-trace"] },
  { id: "guard:tenant-metrics-labels", cmd: ["pnpm", "run", "guard:tenant-metrics-labels"] },
  {
    id: "verify-als-request-cleanup",
    cmd: ["npx", "tsx", "scripts/verify-als-request-cleanup.ts"],
    env: { NODE_ENV: "test", STORAGE_DRIVER: "memory" },
  },
  {
    id: "phase2-observability-specs",
    cmd: ["node", "--import", "tsx", "--test", "--test-concurrency=1", ...MEMORY_SPECS],
    env: { NODE_ENV: "test", STORAGE_DRIVER: "memory", OUTBOX_RELAY_ENABLED: "false" },
  },
];

if (HAS_DATABASE) {
  STEPS.push({
    id: "phase2-postgres-specs",
    cmd: ["node", "--import", "tsx", "--test", "--test-concurrency=1", ...POSTGRES_SPECS],
    env: { NODE_ENV: "test", STORAGE_DRIVER: "prisma" },
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

console.log("phase-2-regression-gate: starting (DEC-050)");
console.log(`  DATABASE_URL: ${HAS_DATABASE ? "set (postgres tier enabled)" : "unset (postgres tier skipped)"}`);

for (const step of STEPS) {
  console.log(`\n--- ${step.id} ---`);
  const record = runStep(step);
  results.push(record);
  if (record.status !== "PASS") {
    failed = true;
    console.error(`phase-2-regression-gate: FAIL at ${step.id}`);
    break;
  }
}

const summary = {
  gate: "phase-2-regression-gate",
  decision: "DEC-050",
  startedAt,
  finishedAt: new Date().toISOString(),
  databaseUrlSet: HAS_DATABASE,
  verdict: failed ? "FAIL" : "PASS",
  steps: results,
};

const outPath = path.join(ROOT, "test", "reliability", "phase-2-regression-gate.last-run.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

if (failed) {
  console.error(`\nphase-2-regression-gate: FAIL — see ${path.relative(ROOT, outPath)}`);
  process.exit(1);
}

console.log(`\nphase-2-regression-gate: PASS — ${results.length} steps`);
console.log(`  wrote ${path.relative(ROOT, outPath)}`);
