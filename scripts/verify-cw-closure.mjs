#!/usr/bin/env node
/**
 * REM-004 — Aggregate CW closure verification gate.
 * Runs parity, baseline compare, architecture guards, isolation specs, purity audit.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {{ id: string, cmd: string }[]} */
const STEPS = [
  { id: "parity", cmd: "pnpm run test:parity" },
  { id: "baseline", cmd: "pnpm run baseline:cw-compare" },
  { id: "tour-core-boundary", cmd: "pnpm run guard:tour-core-boundary" },
  { id: "registry-fresh", cmd: "pnpm run guard:workspace-registry-fresh" },
  { id: "no-ws-branches", cmd: "pnpm run guard:no-workspace-type-branches" },
  { id: "api-ws-isolation", cmd: "pnpm run guard:api-workspace-isolation" },
  {
    id: "foundation-purity",
    cmd: "node scripts/guards/foundation-import-purity-audit.mjs --production-only",
  },
  { id: "cw7-04", cmd: "node --test scripts/test/cw7-04-equipment-isolation.spec.mjs" },
  { id: "cw7-06", cmd: "node --test scripts/test/cw7-06-transport-isolation.spec.mjs" },
  { id: "cw7-08", cmd: "node --test scripts/test/cw7-08-transport-isolation.spec.mjs" },
  { id: "cw7-09", cmd: "node --test scripts/test/cw7-09-difficulty-fitness-isolation.spec.mjs" },
  { id: "cw7-10", cmd: "node --test scripts/test/cw7-10-itinerary-isolation.spec.mjs" },
  { id: "cw7-11", cmd: "node --test scripts/test/cw7-11-pricing-isolation.spec.mjs" },
  { id: "cw7-12", cmd: "node --test scripts/test/cw7-12-membership-discount-isolation.spec.mjs" },
  { id: "cw7-13", cmd: "node --test scripts/test/cw7-13-capability-composition-matrix.spec.mjs" },
  { id: "git-diff-check", cmd: "git diff --check" },
];

function runStep(step) {
  const started = Date.now();
  const result = spawnSync(step.cmd, {
    cwd: ROOT,
    shell: true,
    stdio: "inherit",
    env: process.env,
  });
  const elapsedMs = Date.now() - started;
  if (result.status !== 0) {
    console.error(`\nverify:cw-closure FAILED at step ${step.id} (${elapsedMs}ms)`);
    process.exit(result.status ?? 1);
  }
  console.log(`verify:cw-closure step ${step.id} PASS (${elapsedMs}ms)`);
}

console.log(`verify:cw-closure — ${STEPS.length} steps`);
for (const step of STEPS) {
  runStep(step);
}
console.log("verify:cw-closure — ALL PASS");
