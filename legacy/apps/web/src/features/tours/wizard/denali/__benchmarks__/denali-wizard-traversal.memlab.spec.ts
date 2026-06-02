/**
 * Memlab guard — wizard step traversal (1 → 7 → 1) must not retain detached DOM / hooks.
 *
 * Run in CI or locally:
 *   DENALI_PERF_CI=1 pnpm --filter @apps/web exec node --import tsx --test \
 *     src/features/tours/wizard/denali/__benchmarks__/denali-wizard-traversal.memlab.spec.ts
 */
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "..");
const MEMLAB_SCRIPT = path.join(WEB_ROOT, "scripts/run-denali-wizard-memlab.mjs");

const shouldRunMemlab =
  process.env.DENALI_PERF_CI === "1" || process.env.DENALI_MEMLAB === "1";

test(
  "memlab: denali wizard traversal 1→7→1 has no leak indicators",
  { skip: !shouldRunMemlab, timeout: 300_000 },
  () => {
    const result = spawnSync("node", [MEMLAB_SCRIPT], {
      cwd: WEB_ROOT,
      encoding: "utf8",
      env: { ...process.env },
      stdio: "pipe",
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    assert.equal(
      result.status,
      0,
      `memlab wizard traversal failed (exit ${result.status ?? "unknown"})`,
    );
  },
);
