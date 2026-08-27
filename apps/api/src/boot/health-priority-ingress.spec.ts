import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { after, afterEach, before, describe, it } from "node:test";

import { createRequestListener } from "../app";
import { createHealthAwareServerListener, isHealthGetRequest } from "./health-priority-ingress";
import {
  __getHttpRequestLogQueueSizeForTests,
  __resetHttpRequestLogQueueForTests,
} from "../http/request-logging";
import { logger, flushLogSink } from "../observability/logger";
import {
  readHealthProbeP99Ms,
  readHealthProbeSlowTotal,
  resetHealthProbeLatencyMonitorForTests,
} from "../health/health-probe-latency";
import { validateCanonicalBeforePersistSync } from "../tours/canonical-validation";
import { createTestToursService } from "../../test/test-helpers";

const mainPath = join(dirname(fileURLToPath(import.meta.url)), "../main.ts");
const ingressPath = join(dirname(fileURLToPath(import.meta.url)), "./health-priority-ingress.ts");

const isCiRunner = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

const HEALTH_BURST = Number.parseInt(process.env.HEALTH_PRIORITY_BURST ?? "120", 10);
const HEALTH_CONCURRENCY = Number.parseInt(process.env.HEALTH_PRIORITY_CONCURRENCY ?? "24", 10);
const HEALTH_P99_CEILING_MS = Number.parseInt(
  process.env.HEALTH_PRIORITY_P99_CEILING_MS ??
    (isCiRunner ? "12000" : "2500"),
  10
);
const SLOW_LOG_WRITE_MS = Number.parseInt(process.env.HEALTH_PRIORITY_SLOW_LOG_MS ?? "3", 10);
const VALIDATION_STORM_TICK = Number.parseInt(
  process.env.HEALTH_PRIORITY_VALIDATION_TICK ?? "120",
  10
);
const VALIDATION_STORM_MS = Number.parseInt(
  process.env.HEALTH_PRIORITY_VALIDATION_MS ?? "1200",
  10
);
const HEALTH_PROBE_STORM_P99_CEILING_MS = Number.parseInt(
  process.env.HEALTH_PROBE_STORM_P99_CEILING_MS ??
    (isCiRunner ? "12000" : "3000"),
  10
);

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function installSlowLoggerInfo(delayMs: number): () => void {
  const originalInfo = logger.info.bind(logger);
  (logger.info as unknown as (...args: unknown[]) => void) = (...args: unknown[]) => {
    const start = performance.now();
    while (performance.now() - start < delayMs) {
      // Simulate slow access-log drain under adversarial sink pressure.
    }
    return originalInfo(...args);
  };
  return () => {
    (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
  };
}

function validationInput(index: number) {
  return {
    body: {
      data: {
        basics: { title: `health-priority-${index}` },
        details: { summary: index % 2 === 0 ? "ok" : "" },
      },
    },
    tenantId: "tenant-health-priority",
    workspaceType: "starter",
  } as const;
}

async function runHealthProbeBurst(
  listener: (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>
): Promise<{ readonly latenciesMs: number[]; readonly ok: number; readonly failed: number }> {
  const server = http.createServer(listener);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    server.close();
    throw new Error("health-priority: no listen address");
  }
  const port = addr.port;

  const latenciesMs: number[] = [];
  let ok = 0;
  let failed = 0;
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next;
      next += 1;
      if (i >= HEALTH_BURST) {
        return;
      }

      const start = performance.now();
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          { hostname: "127.0.0.1", port, path: "/health", method: "GET" },
          (res) => {
            res.on("data", () => {});
            res.on("end", () => {
              latenciesMs.push(performance.now() - start);
              if (res.statusCode === 200) {
                ok += 1;
              } else {
                failed += 1;
              }
              resolve();
            });
          }
        );
        req.on("error", reject);
        req.end();
      });
    }
  }

  await Promise.all(Array.from({ length: HEALTH_CONCURRENCY }, () => worker()));
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  return { latenciesMs, ok, failed };
}

describe("health priority ingress (NN-08)", () => {
  let priorStorageDriver: string | undefined;
  let priorDatabaseUrl: string | undefined;
  let priorDatabaseUrlAdmin: string | undefined;

  before(() => {
    // Ingress unit tests must not depend on CI gate Postgres — probeDatabaseHealth would 503.
    priorStorageDriver = process.env.STORAGE_DRIVER;
    priorDatabaseUrl = process.env.DATABASE_URL;
    priorDatabaseUrlAdmin = process.env.DATABASE_URL_ADMIN;
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_ADMIN;
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
    if (priorDatabaseUrlAdmin === undefined) {
      delete process.env.DATABASE_URL_ADMIN;
    } else {
      process.env.DATABASE_URL_ADMIN = priorDatabaseUrlAdmin;
    }
  });

  afterEach(async () => {
    __resetHttpRequestLogQueueForTests();
    resetHealthProbeLatencyMonitorForTests();
    await flushLogSink();
  });

  it("isHealthGetRequest matches GET /health only", async () => {
    assert.equal(
      isHealthGetRequest({ method: "GET", url: "/health" } as http.IncomingMessage),
      true
    );
    assert.equal(
      isHealthGetRequest({ method: "GET", url: "/health?probe=1" } as http.IncomingMessage),
      true
    );
    assert.equal(
      isHealthGetRequest({ method: "POST", url: "/health" } as http.IncomingMessage),
      false
    );
    assert.equal(
      isHealthGetRequest({ method: "GET", url: "/healthz" } as http.IncomingMessage),
      false
    );
  });

  it("main.ts wires createHealthAwareServerListener at createServer root", async () => {
    const source = readFileSync(mainPath, "utf8");
    assert.match(source, /createServer\(createHealthAwareServerListener/);
    assert.doesNotMatch(source, /createServer\s*\(\s*withRequestLogging/);
  });

  it("createHealthAwareServerListener keeps /health off the logging wrapper", async () => {
    const source = readFileSync(ingressPath, "utf8");
    const listenerStart = source.indexOf("export function createHealthAwareServerListener");
    assert.ok(listenerStart >= 0);
    const listenerBody = source.slice(listenerStart);
    assert.match(listenerBody, /isHealthGetRequest\(req\)/);
    assert.doesNotMatch(listenerBody, /withRequestLogging/);
  });

  it("GET /health bypasses access-log queue under slow sink while API traffic logs", async () => {
    const restoreLogger = installSlowLoggerInfo(SLOW_LOG_WRITE_MS);
    try {
      const appListener = createRequestListener({ toursService: createTestToursService() });
      const listener = createHealthAwareServerListener(appListener);

      const server = http.createServer(listener);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const addr = server.address();
      assert.ok(addr && typeof addr !== "string");
      const port = addr.port;

      const apiFlood = Array.from(
        { length: 40 },
        () =>
          new Promise<void>((resolve, reject) => {
            const req = http.request(
              { hostname: "127.0.0.1", port, path: "/tours/missing", method: "GET" },
              (res) => {
                res.on("data", () => {});
                res.on("end", () => resolve());
              }
            );
            req.on("error", reject);
            req.end();
          })
      );

      const [{ latenciesMs, ok, failed }] = await Promise.all([
        runHealthProbeBurst(listener),
        Promise.all(apiFlood),
      ]);

      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });

      assert.equal(failed, 0, "health probes must stay 200 under slow log drain");
      assert.equal(ok, HEALTH_BURST);
      const p99 = percentile(latenciesMs, 99);
      assert.ok(
        p99 <= HEALTH_P99_CEILING_MS,
        `health p99 ${p99}ms exceeded ceiling ${HEALTH_P99_CEILING_MS}ms`
      );
      assert.ok(
        __getHttpRequestLogQueueSizeForTests() < HEALTH_BURST,
        "health path must not enqueue one access log per probe"
      );
    } finally {
      restoreLogger();
    }
  });

  it("GET /health responds during interleaved sync validation storm", async () => {
    const priorLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "error";
    try {
    const appListener = createRequestListener({ toursService: createTestToursService() });
    const listener = createHealthAwareServerListener(appListener);

    let stormIndex = 0;
    let stormActive = true;
    const storm = (async () => {
      while (stormActive) {
        for (let i = 0; i < VALIDATION_STORM_TICK; i += 1) {
          await validateCanonicalBeforePersistSync(validationInput(stormIndex));
          stormIndex += 1;
        }
        await waitMs(0);
      }
    })();

    const deadline = Date.now() + VALIDATION_STORM_MS;
    const { latenciesMs, ok, failed } = await runHealthProbeBurst(listener);
    stormActive = false;
    await storm;

    assert.equal(failed, 0, "health must respond 200 during validation CPU storm");
    assert.equal(ok, HEALTH_BURST);
    assert.ok(latenciesMs.length === HEALTH_BURST);
    assert.ok(Date.now() <= deadline + 5_000, "health burst should finish during storm window");

    const stormP99 = percentile(latenciesMs, 99);
    assert.ok(
      stormP99 <= HEALTH_PROBE_STORM_P99_CEILING_MS,
      `validation storm health p99 ${stormP99}ms exceeded ceiling ${HEALTH_PROBE_STORM_P99_CEILING_MS}ms (NN-01 residual)`
    );
    assert.ok(readHealthProbeP99Ms() > 0, "health probe metrics must record samples during storm");
    assert.ok(
      readHealthProbeSlowTotal() >= 0,
      "health_probe_slow_total must be readable after storm"
    );
    } finally {
      if (priorLogLevel === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = priorLogLevel;
      }
      logger.level = process.env.LOG_LEVEL ?? "info";
    }
  });
});
