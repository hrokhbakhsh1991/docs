/**
 * 3-performance — cold-start latency (TTFB) for serverless / scale-to-zero readiness.
 *
 * Probes:
 *   (a) In-process — fresh PlatformWizardEngine.tryInit after large RuleSet (256 cells)
 *   (b) Subprocess — fresh Node HTTP server, first GET /probe TTFB after module load
 *
 * SLO: initial RuleEngine compilation (tryInit / first validateCanonical) must stay
 * under COLD_START_BUDGET_MS (default 1000). Exceeding budget signals need for lazy-load
 * partitioning or pre-compile/warm pool before accepting serverless traffic.
 *
 * Env tunables:
 *   COLD_START_BUDGET_MS       — fail threshold for engine init + HTTP TTFB (default 1000)
 *   COLD_START_CELL_COUNT      — ruleSet.cells cardinality (default 256, max 256)
 *   COLD_START_HTTP_EMIT       — set "1" to log JSON report to stdout
 *   COLD_START_SKIP_SUBPROCESS — set "1" to skip subprocess HTTP probe (engine-only)
 *
 * Run:
 *   cd apps/api && NODE_ENV=test node --import tsx --test test/3-performance/cold-start-latency.spec.ts
 *
 * @see packages/platform-core/test/cold-start.contract.spec.ts — lazy-init contract
 * @see apps/api/src/tours/canonical-validation.ts — per-call engine (CRIT-STATE-01)
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { after, describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";
import { createStarterWorkspacePlugin, workspaceThemePresets } from "@app-tour/workspace-sdk";

import { buildLargeWorkspacePlugin, COLD_START_CANONICAL_INPUT } from "./cold-start-fixtures";

const COLD_START_BUDGET_MS = Number.parseInt(process.env.COLD_START_BUDGET_MS ?? "1000", 10);
const COLD_START_CELL_COUNT = Number.parseInt(process.env.COLD_START_CELL_COUNT ?? "256", 10);
const SKIP_SUBPROCESS = process.env.COLD_START_SKIP_SUBPROCESS === "1";
const WORKER_PATH = join(dirname(fileURLToPath(import.meta.url)), "cold-start-http-worker.ts");
const TENANT_ID = "cold-start-latency-tenant";
const WORKER_READY_TIMEOUT_MS = 30_000;
const HTTP_PROBE_TIMEOUT_MS = 15_000;

export type ColdStartLatencyReport = {
  readonly verdict: "pass" | "budget_exceeded";
  readonly budgetMs: number;
  readonly cellCount: number;
  readonly engineCreateMs: number;
  readonly engineTryInitMs: number;
  readonly engineValidateMs: number;
  readonly engineTotalMs: number;
  readonly starterTryInitMs: number;
  readonly httpTtfbMs: number | null;
  readonly httpInitHeaderMs: number | null;
  readonly recommendation: string;
};

let lastReport: ColdStartLatencyReport | undefined;

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

function budgetFailMessage(
  report: ColdStartLatencyReport,
  phase: string,
  measuredMs: number
): string {
  return [
    `COLD_START_BUDGET_EXCEEDED: ${phase} exceeded ${report.budgetMs}ms serverless readiness budget`,
    `  measured: ${roundMs(measuredMs)}ms`,
    `  cellCount: ${report.cellCount}`,
    `  engine_tryInit: ${report.engineTryInitMs}ms`,
    `  engine_validate: ${report.engineValidateMs}ms`,
    report.httpTtfbMs !== null ? `  http_ttfb: ${report.httpTtfbMs}ms` : undefined,
    `  recommendation: ${report.recommendation}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function optimizerRecommendation(exceeded: boolean): string {
  if (!exceeded) {
    return "Within budget — per-call engine init acceptable for current RuleSet size; monitor if cell count grows.";
  }
  return [
    "RuleEngine cold compile exceeds 1s — not serverless-ready.",
    "Options: (1) pre-compile RuleEngine at provision time and cache per workspaceType;",
    "(2) lazy partition RuleSet (defer non-default cells);",
    "(3) warm pool / min-instances to hide first-request compile;",
    "(4) reduce ruleSet.cells toward index limit only when required.",
  ].join(" ");
}

type SpawnedWorker = {
  readonly port: number;
  readonly child: ChildProcessWithoutNullStreams;
};

function spawnColdStartWorker(cellCount: number): Promise<SpawnedWorker> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", WORKER_PATH], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        COLD_START_CELL_COUNT: String(cellCount),
        COLD_START_TENANT_ID: TENANT_ID,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(error);
    };

    const timer = setTimeout(() => {
      fail(
        new Error(
          `cold-start worker did not emit COLD_START_READY within ${WORKER_READY_TIMEOUT_MS}ms`
        )
      );
    }, WORKER_READY_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      const match = stdoutBuffer.match(/COLD_START_READY (\{.*\})/);
      if (!match || settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const payload = JSON.parse(match[1]!) as { port?: number };
        if (typeof payload.port !== "number") {
          fail(new Error("cold-start worker ready payload missing port"));
          return;
        }
        resolve({ port: payload.port, child });
      } catch (error: unknown) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stdoutBuffer += `[stderr] ${chunk.toString("utf8")}`;
    });

    child.on("error", (error) => fail(error));
    child.on("exit", (code, signal) => {
      if (settled) return;
      fail(
        new Error(
          `cold-start worker exited before ready (code=${String(code)} signal=${String(signal)})\n${stdoutBuffer}`
        )
      );
    });
  });
}

function killWorker(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve) => {
    if (child.killed || child.exitCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 3_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

type HttpProbeResult = {
  readonly ttfbMs: number;
  readonly initHeaderMs: number | null;
  readonly status: number;
};

function measureHttpColdStartTtfb(port: number): Promise<HttpProbeResult> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/probe",
        method: "GET",
      },
      (res) => {
        const ttfbMs = performance.now() - started;
        const initHeader = res.headers["x-rule-engine-init-ms"];
        const initHeaderMs =
          typeof initHeader === "string" && initHeader.length > 0
            ? Number.parseFloat(initHeader)
            : null;
        res.resume();
        res.on("end", () => {
          resolve({
            ttfbMs,
            initHeaderMs: Number.isFinite(initHeaderMs!) ? initHeaderMs : null,
            status: res.statusCode ?? 0,
          });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(HTTP_PROBE_TIMEOUT_MS, () => {
      req.destroy(new Error("http probe timeout"));
    });
    req.end();
  });
}

describe("cold-start latency (3-performance)", { concurrency: false }, () => {
  let spawnedWorker: SpawnedWorker | undefined;

  after(async () => {
    if (spawnedWorker) {
      await killWorker(spawnedWorker.child);
      spawnedWorker = undefined;
    }
  });

  it("COLD-START: RuleEngine compilation on large RuleSet stays under budget", async () => {
    const cellCount = Math.min(COLD_START_CELL_COUNT, 256);
    const largePlugin = buildLargeWorkspacePlugin(cellCount);
    const starterPlugin = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);

    const createStart = performance.now();
    const engine = PlatformWizardEngine.create(largePlugin);
    const engineCreateMs = performance.now() - createStart;
    assert.equal(engine.isInitialized(), false, "create must not eagerly init RuleEngine");

    const tryInitStart = performance.now();
    const initResult = engine.tryInit();
    const engineTryInitMs = performance.now() - tryInitStart;
    assert.equal(initResult.ok, true, "large plugin must init successfully");

    const validateStart = performance.now();
    const document = createCanonicalDocument(COLD_START_CANONICAL_INPUT);
    const validation = engine.validateCanonical(document, {
      tenantId: TENANT_ID,
      dimensions: { variant: "default" },
    });
    const engineValidateMs = performance.now() - validateStart;
    assert.equal(validation.ok, true);

    const starterEngine = PlatformWizardEngine.create(starterPlugin);
    const starterInitStart = performance.now();
    assert.equal(starterEngine.tryInit().ok, true);
    const starterTryInitMs = performance.now() - starterInitStart;

    const engineTotalMs = engineTryInitMs + engineValidateMs;
    const budgetExceeded =
      engineTryInitMs > COLD_START_BUDGET_MS || engineTotalMs > COLD_START_BUDGET_MS;

    lastReport = {
      verdict: budgetExceeded ? "budget_exceeded" : "pass",
      budgetMs: COLD_START_BUDGET_MS,
      cellCount,
      engineCreateMs: roundMs(engineCreateMs),
      engineTryInitMs: roundMs(engineTryInitMs),
      engineValidateMs: roundMs(engineValidateMs),
      engineTotalMs: roundMs(engineTotalMs),
      starterTryInitMs: roundMs(starterTryInitMs),
      httpTtfbMs: null,
      httpInitHeaderMs: null,
      recommendation: optimizerRecommendation(budgetExceeded),
    };

    const summary = [
      `COLD_START_ENGINE verdict=${lastReport.verdict} cells=${cellCount} budget=${COLD_START_BUDGET_MS}ms`,
      `  create=${lastReport.engineCreateMs}ms tryInit=${lastReport.engineTryInitMs}ms validate=${lastReport.engineValidateMs}ms total=${lastReport.engineTotalMs}ms`,
      `  starter_tryInit=${lastReport.starterTryInitMs}ms (baseline)`,
    ].join("\n");
    console.info(summary);

    assert.ok(
      engineCreateMs < COLD_START_BUDGET_MS,
      `PlatformWizardEngine.create must stay lightweight (got ${roundMs(engineCreateMs)}ms)`
    );

    if (engineTryInitMs > COLD_START_BUDGET_MS) {
      assert.fail(budgetFailMessage(lastReport, "RuleEngine.tryInit", engineTryInitMs));
    }
  });

  it("COLD-START: subprocess HTTP first-byte latency stays under budget", async () => {
    if (SKIP_SUBPROCESS) {
      console.info("COLD_START_SKIP_SUBPROCESS=1 — skipping HTTP subprocess probe");
      return;
    }

    assert.ok(lastReport, "engine probe must run first");

    const cellCount = Math.min(COLD_START_CELL_COUNT, 256);
    spawnedWorker = await spawnColdStartWorker(cellCount);

    const probe = await measureHttpColdStartTtfb(spawnedWorker.port);
    assert.equal(probe.status, 200, "cold-start HTTP probe must return 200");

    const httpBudgetExceeded = probe.ttfbMs > COLD_START_BUDGET_MS;
    const combinedExceeded = lastReport.verdict === "budget_exceeded" || httpBudgetExceeded;

    lastReport = {
      ...lastReport,
      httpTtfbMs: roundMs(probe.ttfbMs),
      httpInitHeaderMs:
        probe.initHeaderMs !== null ? roundMs(probe.initHeaderMs) : lastReport.httpInitHeaderMs,
      verdict: combinedExceeded ? "budget_exceeded" : "pass",
      recommendation: optimizerRecommendation(combinedExceeded),
    };

    process.env.COLD_START_LATENCY_REPORT = JSON.stringify(lastReport);

    const summary = [
      `COLD_START_HTTP verdict=${lastReport.verdict} ttfb=${lastReport.httpTtfbMs}ms budget=${COLD_START_BUDGET_MS}ms`,
      lastReport.httpInitHeaderMs !== null
        ? `  x-rule-engine-init-ms=${lastReport.httpInitHeaderMs}ms`
        : undefined,
    ]
      .filter(Boolean)
      .join("\n");
    console.info(summary);

    if (process.env.COLD_START_HTTP_EMIT === "1") {
      console.log(`COLD_START_LATENCY_JSON ${JSON.stringify(lastReport)}`);
    }

    if (httpBudgetExceeded) {
      assert.fail(
        budgetFailMessage(lastReport, "HTTP TTFB (subprocess first request)", probe.ttfbMs)
      );
    }
  });

  it("exposes COLD_START_LATENCY_REPORT for optimizer audit", () => {
    assert.ok(lastReport, "cold-start latency report must be set by prior tests");
    assert.ok(
      lastReport.verdict === "pass" || lastReport.verdict === "budget_exceeded",
      "verdict must be pass or budget_exceeded"
    );

    const optimizerVerdict =
      lastReport.verdict === "pass"
        ? `COLD_START_OPTIMIZER_VERDICT pass tryInit=${lastReport.engineTryInitMs}ms ttfb=${lastReport.httpTtfbMs ?? "skipped"}ms — serverless-ready at ${lastReport.cellCount} cells`
        : `COLD_START_OPTIMIZER_VERDICT budget_exceeded tryInit=${lastReport.engineTryInitMs}ms — ${lastReport.recommendation}`;

    console.info(optimizerVerdict);
  });
});
