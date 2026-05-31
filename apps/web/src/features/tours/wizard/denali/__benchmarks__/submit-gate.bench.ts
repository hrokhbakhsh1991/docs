/**
 * Submit-gate performance guard — run:
 *   pnpm --filter @apps/web run bench:denali:submit-gate
 *   DENALI_PERF_VERIFY_BASELINE=1 pnpm --filter @apps/web run bench:denali:submit-gate
 */
/* eslint-disable no-console -- CLI benchmark reports timing to stdout */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Bench } from "tinybench";

import { evaluateDenaliWizardSubmitGate } from "../validation/denaliSubmitValidation";
import { buildWorstCaseDenaliWizardForm } from "./fixtures/buildWorstCaseDenaliWizardForm";

const BENCHMARK_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(BENCHMARK_DIR, "denali-perf-baseline.json");

const MAX_MEAN_MS = Number(process.env.DENALI_SUBMIT_GATE_MAX_MEAN_MS ?? "10");
const VERIFY_BASELINE = process.env.DENALI_PERF_VERIFY_BASELINE === "1";
const WARMUP_ITERATIONS = Number(process.env.DENALI_SUBMIT_GATE_WARMUP ?? "5");

const worstCaseForm = buildWorstCaseDenaliWizardForm();

const bench = new Bench({
  name: "denali-submit-gate",
  iterations: 50,
  warmup: true,
  warmupIterations: WARMUP_ITERATIONS,
});

async function main(): Promise<void> {
  bench.add("evaluateDenaliWizardSubmitGate (active, worst-case)", () => {
    evaluateDenaliWizardSubmitGate(worstCaseForm);
  });

  await bench.run();

  const task = bench.tasks[0];
  const result = task?.result;
  const latency =
    result?.state === "completed" && "latency" in result ? result.latency : undefined;
  const meanMs = latency?.mean ?? Number.POSITIVE_INFINITY;
  const p99Ms = latency?.p99 ?? Number.POSITIVE_INFINITY;
  const throughput =
    result?.state === "completed" && "throughput" in result ? result.throughput : undefined;
  const samples = latency?.samplesCount ?? throughput?.samplesCount;

  console.log(
    JSON.stringify(
      {
        task: task?.name,
        samples,
        meanMs,
        p99Ms,
        maxMeanMs: MAX_MEAN_MS,
      },
      null,
      2,
    ),
  );

  if (!Number.isFinite(meanMs)) {
    console.error("submit-gate bench: no timing result");
    process.exit(1);
  }

  if (meanMs > MAX_MEAN_MS) {
    console.error(
      `submit-gate bench FAILED: mean ${meanMs.toFixed(3)}ms exceeds ${MAX_MEAN_MS}ms ceiling`,
    );
    process.exit(1);
  }

  if (VERIFY_BASELINE) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) as {
      submitGate: {
        meanMs: number;
        maxMeanMsCeiling: number;
        maxMeanMsRegressionFactor: number;
      };
    };
    const regressionLimit =
      baseline.submitGate.meanMs * baseline.submitGate.maxMeanMsRegressionFactor;
    const baselineMaxMean = Math.min(
      baseline.submitGate.maxMeanMsCeiling,
      regressionLimit,
    );

    if (meanMs > baselineMaxMean) {
      console.error(
        `submit-gate bench FAILED: mean ${meanMs.toFixed(3)}ms exceeds baseline regression limit ${baselineMaxMean.toFixed(3)}ms (baseline ${baseline.submitGate.meanMs}ms × ${baseline.submitGate.maxMeanMsRegressionFactor})`,
      );
      process.exit(1);
    }

    console.log(
      `submit-gate baseline OK: mean ${meanMs.toFixed(3)}ms within regression limit ${baselineMaxMean.toFixed(3)}ms`,
    );
  }

  console.log(`submit-gate bench OK: mean ${meanMs.toFixed(3)}ms (ceiling ${MAX_MEAN_MS}ms)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
