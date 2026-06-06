#!/usr/bin/env node
/**
 * CS-UNSC-01 / A2 — record-only tsx dev cold-start probe (never blocks CI).
 * @see docs/phase-5/appendices/cold-start-tsx-dev-waiver.md
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_TS = path.join(ROOT, "src", "main.ts");
const ARTIFACT = path.join(ROOT, "test", "reliability", "cold-start-tsx-dev.last-run.json");

const BUDGET_MS = Number.parseInt(process.env.COLD_START_READINESS_BUDGET_MS ?? "500", 10);
const SAMPLES = Number.parseInt(process.env.COLD_START_TSX_DEV_SAMPLES ?? "2", 10);
const BOOT_TIMEOUT_MS = Number.parseInt(process.env.COLD_START_TSX_DEV_TIMEOUT_MS ?? "45000", 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.killed) {
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

function measureTsxSpawnToHealth(port) {
  return new Promise((resolve, reject) => {
    const spawnStarted = performance.now();
    const child = spawn(process.execPath, ["--import", "tsx", MAIN_TS], {
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_ENV: "test",
        STORAGE_DRIVER: "memory",
        OUTBOX_RELAY_ENABLED: "false",
        PORT: String(port),
        TENANT_RATE_LIMIT_ENABLED: "false",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });

    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      void killChild(child).then(() => reject(error));
    };

    const timer = setTimeout(() => {
      fail(new Error(`tsx boot timeout after ${BOOT_TIMEOUT_MS}ms`));
    }, BOOT_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      if (text.includes("boot failed")) {
        fail(new Error(`tsx main.ts boot failed: ${text.trim()}`));
      }
    });

    child.on("error", (error) => fail(error));
    child.on("exit", (code, signal) => {
      if (settled) return;
      fail(new Error(`tsx main.ts exited before /health (code=${code} signal=${signal})`));
    });

    const poll = () => {
      if (settled) return;
      const req = http.request(
        { hostname: "127.0.0.1", port, path: "/health", method: "GET", timeout: 500 },
        (res) => {
          res.resume();
          res.on("end", () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            const spawnToHealthMs = performance.now() - spawnStarted;
            void killChild(child).then(() =>
              resolve({ spawnToHealthMs, status: res.statusCode ?? 0 })
            );
          });
        }
      );
      req.on("timeout", () => {
        req.destroy();
        setTimeout(poll, 40);
      });
      req.on("error", () => {
        setTimeout(poll, 40);
      });
      req.end();
    };

    setTimeout(poll, 50);
  });
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

async function main() {
  if (!fs.existsSync(MAIN_TS)) {
    console.error("cold-start-tsx-dev-probe: FAIL — src/main.ts missing");
    process.exit(1);
  }

  const samples = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    const port = 32_000 + Math.floor(Math.random() * 4_000);
    const result = await measureTsxSpawnToHealth(port);
    if (result.status !== 200) {
      console.error(`cold-start-tsx-dev-probe: FAIL — /health status ${result.status}`);
      process.exit(1);
    }
    samples.push(Math.round(result.spawnToHealthMs * 100) / 100);
    await sleep(300);
  }

  const p50Ms = percentile(samples, 50);
  const p95Ms = percentile(samples, 95);
  const maxMs = Math.max(...samples);
  const unscalable = p95Ms > BUDGET_MS;

  const summary = {
    gate: "cold-start-tsx-dev-probe",
    id: "CS-UNSC-01",
    waived: true,
    productionPath: "dist/main.js",
    startedAt: new Date().toISOString(),
    budgetMs: BUDGET_MS,
    samples,
    p50Ms,
    p95Ms,
    maxMs,
    unscalable,
    verdict: "PASS",
    note: "record-only — tsx dev excluded from trunk/nightly readiness enforce",
    artifact: path.relative(ROOT, ARTIFACT),
  };

  fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
  fs.writeFileSync(ARTIFACT, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(
    `cold-start-tsx-dev-probe: PASS (waived) p50=${p50Ms}ms p95=${p95Ms}ms budget=${BUDGET_MS}ms unscalable=${unscalable}`
  );
  console.log(`  wrote ${summary.artifact}`);
}

main().catch((error) => {
  console.error("cold-start-tsx-dev-probe: FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
