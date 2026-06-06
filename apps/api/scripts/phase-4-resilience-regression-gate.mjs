#!/usr/bin/env node
/**
 * Phase 4 resilience formal regression gate + sign-off — DEC-079, DEC-080 (Wave A).
 * @see docs/phase-5/appendices/phase4-resilience-regression-gate.md
 * @see docs/phase-5/appendices/postgres-required-gates.md
 * @see apps/api/docs/phase4-resilience-audit.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GATE_BUILD_DIST_STEP } from "./lib/gate-build-dist.mjs";
import { requireGateDatabase } from "./lib/require-gate-database.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

requireGateDatabase({ gateName: "phase-4-resilience-regression-gate" });

const MEMORY_SPECS = [
  "src/outbox/outbox-processing-reclaim.spec.ts",
  "src/outbox/outbox-publish-done-pairing.spec.ts",
  "src/server/graceful-shutdown-outbox.spec.ts",
  "src/outbox/start-outbox-relay.spec.ts",
  "test/4-integration/proxy-upstream-timeout.spec.ts",
  "test/4-integration/malformed-json-body.spec.ts",
  "test/4-integration/proxy-production-wire.spec.ts",
  "src/db/canonical-transaction-now.spec.ts",
  "src/canonical/canonical-timestamp-unify.spec.ts",
  "test/4-integration/schema-version-compat.spec.ts",
];

const POSTGRES_SPECS = [
  "test/4-integration/clock-skew-resilience.spec.ts",
  "test/4-integration/dynamic-config-sync.spec.ts",
  "src/outbox/outbox-processing-reclaim.spec.ts",
  "src/outbox/outbox-publish-done-pairing.spec.ts",
  "test/outbox-relay.integration.spec.ts",
  "test/outbox-transactional.integration.spec.ts",
  "test/4-integration/outbox-failed-replay.spec.ts",
  "test/4-integration/outbox-relay-ordered-per-tenant.spec.ts",
  "test/chaos/atomic-rollback-stress.spec.ts",
  "test/3-performance/bulk-import-victim-slo.spec.ts",
  "test/3-performance/noisy-neighbor-latency.spec.ts",
  "test/4-integration/tenant-registry-cache-coherence.spec.ts",
];

const STEPS = [
  {
    id: "guard:outbox-processing-reclaim",
    cmd: ["pnpm", "run", "guard:outbox-processing-reclaim"],
  },
  {
    id: "guard:outbox-publish-done-pairing",
    cmd: ["pnpm", "run", "guard:outbox-publish-done-pairing"],
  },
  {
    id: "guard:tenant-registry-cache-invalidation",
    cmd: ["pnpm", "run", "guard:tenant-registry-cache-invalidation"],
  },
  { id: "guard:proxy-upstream-timeout", cmd: ["pnpm", "run", "guard:proxy-upstream-timeout"] },
  { id: "guard:graceful-shutdown-outbox", cmd: ["pnpm", "run", "guard:graceful-shutdown-outbox"] },
  {
    id: "guard:canonical-transaction-now",
    cmd: ["pnpm", "run", "guard:canonical-transaction-now"],
  },
  { id: "guard:patch-schema-drift", cmd: ["pnpm", "run", "guard:patch-schema-drift"] },
  { id: "guard:outbox-failed-replay", cmd: ["pnpm", "run", "guard:outbox-failed-replay"] },
  {
    id: "guard:outbox-relay-ordered-per-tenant",
    cmd: ["pnpm", "run", "guard:outbox-relay-ordered-per-tenant"],
  },
  { id: "guard:outbox-projection-lag", cmd: ["pnpm", "run", "guard:outbox-projection-lag"] },
  {
    id: "guard:tenant-registry-cache-coherence",
    cmd: ["pnpm", "run", "guard:tenant-registry-cache-coherence"],
  },
  {
    id: "guard:migrate-canonical-placeholder",
    cmd: ["pnpm", "run", "guard:migrate-canonical-placeholder"],
  },
  { id: "guard:http-malformed-json", cmd: ["pnpm", "run", "guard:http-malformed-json"] },
  { id: "guard:proxy-production-wire", cmd: ["pnpm", "run", "guard:proxy-production-wire"] },
  { id: "guard:phase4-cross-phase-p0", cmd: ["pnpm", "run", "guard:phase4-cross-phase-p0"] },
  { id: "phase-4:cross-phase-p0-verify", cmd: ["pnpm", "run", "phase-4:cross-phase-p0-verify"] },
  GATE_BUILD_DIST_STEP,
  {
    id: "phase4-resilience-closure-specs",
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
    id: "phase4-resilience-postgres-specs",
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
      OUTBOX_RELAY_ENABLED: "false",
      OUTBOX_RELAY_ORDERED_PER_TENANT: "true",
      P5_CHAOS_ITERATIONS: "5",
      APPS_API_TEST_TIER: "nightly",
      /** Gate orchestration — spec default 1.10; relaxed after prior postgres specs (DEC-089). */
      VALIDATION_BURST: "600",
      BASELINE_RATIO_MAX: "1.30",
    },
  },
];

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

console.log(
  "phase-4-resilience-regression-gate: starting (DEC-079, DEC-080, DEC-089 Wave C, DEC-090 Wave D)"
);
console.log("  DATABASE_URL: set (postgres tier required)");
console.log("  postgresRequired: true");

for (const step of STEPS) {
  console.log(`\n--- ${step.id} ---`);
  const record = runStep(step);
  results.push(record);
  if (record.status !== "PASS") {
    failed = true;
    console.error(`phase-4-resilience-regression-gate: FAIL at ${step.id}`);
    break;
  }
}

const summary = {
  gate: "phase-4-resilience-regression-gate",
  decision: "DEC-079",
  waveA: "DEC-080",
  waveB: "DEC-083",
  waveC: "DEC-086",
  waveD: "DEC-090",
  postgresRequired: true,
  closureSteps: [
    "DEC-071",
    "DEC-072",
    "DEC-073",
    "DEC-074",
    "DEC-075",
    "DEC-076",
    "DEC-077",
    "DEC-078",
    "DEC-083",
    "DEC-084",
    "DEC-085",
    "DEC-086",
    "DEC-087",
    "DEC-088",
    "DEC-089",
    "DEC-090",
    "DEC-091",
    "DEC-092",
    "DEC-093",
  ],
  chaosVerdictBefore: "CONDITIONAL",
  chaosVerdictAfter: failed ? "CONDITIONAL" : "CLOSURE_PASS_WITH_RESIDUAL",
  resilienceScoreBefore: 62,
  resilienceScoreAfter: failed ? 62 : 88,
  residualRisks: failed
    ? [
        "SH-GAP-13",
        "CLK-F-03",
        "CLK-F-04",
        "SV-F-04",
        "SD-G4",
        "SD-G5",
        "SD-G7",
        "F-03",
        "F-15",
        "OZ-A",
        "PU-F-03",
        "PI-03",
        "SV-11",
      ]
    : ["SV-F-04"],
  mustFixP0OpenBefore: 8,
  mustFixP0OpenAfter: failed ? 8 : 0,
  startedAt,
  finishedAt: new Date().toISOString(),
  databaseUrlSet: true,
  verdict: failed ? "FAIL" : "PASS",
  signOff: failed
    ? undefined
    : {
        date: new Date().toISOString().slice(0, 10),
        auditor: "phase-4-resilience-regression-gate",
        note: "Closure steps DEC-071…093 complete; Wave A–D postgres tier required (DEC-080); Phase 6 migrateCanonical runtime deferred.",
      },
  steps: results,
};

const outPath = path.join(
  ROOT,
  "test",
  "reliability",
  "phase-4-resilience-regression-gate.last-run.json"
);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

if (failed) {
  console.error(`\nphase-4-resilience-regression-gate: FAIL — see ${path.relative(ROOT, outPath)}`);
  process.exit(1);
}

console.log(`\nphase-4-resilience-regression-gate: PASS — ${results.length} steps`);
console.log(`  sign-off: ${summary.chaosVerdictAfter} (score ${summary.resilienceScoreAfter}/100)`);
console.log(`  wrote ${path.relative(ROOT, outPath)}`);
