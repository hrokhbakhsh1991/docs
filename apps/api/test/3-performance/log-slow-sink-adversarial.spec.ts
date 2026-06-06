/**
 * Nightly — slow-sink adversarial probe (DEC-070 / LOG-BP-03 / FOF-LOG post DEC-062/063).
 *
 * Simulates log sink drain slower than HTTP access-log emit rate. Proves:
 *   - HTTP responses complete (200) without waiting on Pino (async enqueue on finish)
 *   - Access-log queue drains (no unbounded growth)
 *   - Bounded destination records drop under tiny maxLength
 *
 * Run:
 *   pnpm run test:nightly:slow-sink
 *
 * @see docs/phase-5/appendices/logging-backpressure.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { Writable } from "node:stream";
import { after, before, describe, it } from "node:test";
import pino from "pino";

import { createRequestListener } from "../../src/app";
import {
  __getHttpRequestLogQueueSizeForTests,
  __resetHttpRequestLogQueueForTests,
  enqueueHttpRequestLog,
  withRequestLogging,
} from "../../src/http/request-logging";
import { logger } from "../../src/observability/logger";
import {
  bindLogSinkBackpressureMetrics,
  createBoundedLogDestination,
} from "../../src/observability/log-sink";
import { metricsRegistry, resetMetricsRegistryForTests } from "../../src/observability/metrics";
import { createTestToursService } from "../test-helpers";
import { skipUnlessNightlyTier } from "../test-tier";

const SLOW_SINK_BURST = Number.parseInt(process.env.SLOW_SINK_BURST ?? "500", 10);
const SLOW_SINK_CONCURRENCY = Number.parseInt(process.env.SLOW_SINK_CONCURRENCY ?? "50", 10);
const SLOW_LOG_WRITE_MS = Number.parseInt(process.env.SLOW_LOG_WRITE_MS ?? "2", 10);
const SLOW_SINK_HTTP_P99_CEILING_MS = Number.parseInt(
  process.env.SLOW_SINK_HTTP_P99_CEILING_MS ?? "3000",
  10
);
const SLOW_SINK_QUEUE_DRAIN_MS = Number.parseInt(
  process.env.SLOW_SINK_QUEUE_DRAIN_MS ?? "15000",
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

function waitForImmediate(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function installSlowLoggerInfo(delayMs: number): () => void {
  const originalInfo = logger.info.bind(logger);
  (logger.info as unknown as (...args: unknown[]) => void) = (...args: unknown[]) => {
    const start = performance.now();
    while (performance.now() - start < delayMs) {
      // Simulate event-loop work during Sonic-Boom drain / slow stdout consumer.
    }
    return originalInfo(...args);
  };
  return () => {
    (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
  };
}

async function runHealthBurst(
  listener: (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>
): Promise<{ readonly latenciesMs: number[]; readonly ok: number; readonly failed: number }> {
  const server = http.createServer(listener);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    server.close();
    throw new Error("log-slow-sink: no listen address");
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
      if (i >= SLOW_SINK_BURST) {
        return;
      }

      const start = performance.now();
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          { hostname: "127.0.0.1", port, path: "/health", method: "GET" },
          (res) => {
            res.on("data", () => {});
            res.on("end", () => {
              const elapsed = performance.now() - start;
              latenciesMs.push(elapsed);
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

  await Promise.all(Array.from({ length: SLOW_SINK_CONCURRENCY }, () => worker()));
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  return { latenciesMs, ok, failed };
}

describe(
  "slow-sink adversarial logging (DEC-070)",
  { skip: skipUnlessNightlyTier("log-slow-sink-adversarial"), concurrency: false },
  () => {
    const priorNodeEnv = process.env.NODE_ENV;
    const priorStorage = process.env.STORAGE_DRIVER;
    const priorOutbox = process.env.OUTBOX_RELAY_ENABLED;

    before(() => {
      process.env.NODE_ENV = "test";
      process.env.STORAGE_DRIVER = "memory";
      process.env.OUTBOX_RELAY_ENABLED = "false";
      __resetHttpRequestLogQueueForTests();
      resetMetricsRegistryForTests();
    });

    after(() => {
      __resetHttpRequestLogQueueForTests();
      resetMetricsRegistryForTests();
      process.env.NODE_ENV = priorNodeEnv;
      process.env.STORAGE_DRIVER = priorStorage;
      process.env.OUTBOX_RELAY_ENABLED = priorOutbox;
    });

    it("GET /health stays available while access-log drain simulates slow sink", async () => {
      const restoreLogger = installSlowLoggerInfo(SLOW_LOG_WRITE_MS);
      try {
        const base = createRequestListener({ toursService: createTestToursService() });
        const listener = withRequestLogging(base);

        const { latenciesMs, ok, failed } = await runHealthBurst(listener);

        assert.equal(failed, 0, "all health probes must return 200 under slow log drain");
        assert.equal(ok, SLOW_SINK_BURST);

        const p99 = percentile(latenciesMs, 99);
        assert.ok(
          p99 <= SLOW_SINK_HTTP_P99_CEILING_MS,
          `health p99 ${p99}ms exceeded ceiling ${SLOW_SINK_HTTP_P99_CEILING_MS}ms`
        );

        const deadline = Date.now() + SLOW_SINK_QUEUE_DRAIN_MS;
        while (__getHttpRequestLogQueueSizeForTests() > 0 && Date.now() < deadline) {
          await waitForImmediate();
          await waitMs(5);
        }
        assert.equal(
          __getHttpRequestLogQueueSizeForTests(),
          0,
          "access-log queue must drain after slow-sink burst"
        );
      } finally {
        restoreLogger();
      }
    });

    it("enqueue path remains fail-open when logger drain is slower than emit rate", async () => {
      const restoreLogger = installSlowLoggerInfo(SLOW_LOG_WRITE_MS);
      const originalWarn = logger.warn.bind(logger);
      (logger.warn as unknown as (...args: unknown[]) => void) = () => {};
      try {
        for (let i = 0; i < SLOW_SINK_BURST; i += 1) {
          enqueueHttpRequestLog({
            method: "GET",
            path: "/health",
            statusCode: 200,
            durationMs: i % 20,
          });
        }

        const deadline = Date.now() + SLOW_SINK_QUEUE_DRAIN_MS;
        while (__getHttpRequestLogQueueSizeForTests() > 0 && Date.now() < deadline) {
          await waitForImmediate();
          await waitMs(5);
        }

        assert.equal(__getHttpRequestLogQueueSizeForTests(), 0);
      } finally {
        (logger.warn as unknown as (...args: unknown[]) => void) = originalWarn;
        restoreLogger();
      }
    });

    it("bounded destination emits drop metric under tiny maxLength flood", () => {
      resetMetricsRegistryForTests();

      const priorMax = process.env.LOG_SINK_MAX_LENGTH;
      const priorMin = process.env.LOG_SINK_MIN_LENGTH;
      process.env.LOG_SINK_MAX_LENGTH = "4096";
      process.env.LOG_SINK_MIN_LENGTH = "1";

      try {
        const destination = createBoundedLogDestination();
        bindLogSinkBackpressureMetrics(destination);
        const log = pino({ level: "info" }, destination);

        for (let i = 0; i < 2_000; i += 1) {
          log.info(
            {
              event: "slow_sink.probe",
              index: i,
              payload: "x".repeat(256),
            },
            "adversarial line"
          );
        }

        assert.ok(
          metricsRegistry.getMetric("log_sink_drop_total") >= 1,
          "bounded sink must record at least one drop under adversarial flood"
        );
      } finally {
        if (priorMax === undefined) {
          delete process.env.LOG_SINK_MAX_LENGTH;
        } else {
          process.env.LOG_SINK_MAX_LENGTH = priorMax;
        }
        if (priorMin === undefined) {
          delete process.env.LOG_SINK_MIN_LENGTH;
        } else {
          process.env.LOG_SINK_MIN_LENGTH = priorMin;
        }
      }
    });

    it("throttled writable stream backs up without blocking HTTP finish enqueue", async () => {
      const slowWritable = new Writable({
        highWaterMark: 8 * 1024,
        write(_chunk, _encoding, callback) {
          setTimeout(callback, SLOW_LOG_WRITE_MS);
        },
      });

      const adversarialLog = pino({ level: "info" }, slowWritable);
      const originalInfo = logger.info.bind(logger);
      (logger.info as unknown as (...args: unknown[]) => void) = (...args: unknown[]) =>
        adversarialLog.info(...(args as [Record<string, unknown>, string]));

      try {
        const base = createRequestListener({ toursService: createTestToursService() });
        const listener = withRequestLogging(base);
        const sampleBurst = Math.min(100, SLOW_SINK_BURST);

        const server = http.createServer(listener);
        await new Promise<void>((resolve) => server.listen(0, resolve));
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          throw new Error("log-slow-sink: no listen address");
        }
        const port = addr.port;
        const cappedLatencies: number[] = [];
        let okCount = 0;
        let next = 0;

        await Promise.all(
          Array.from({ length: Math.min(SLOW_SINK_CONCURRENCY, 20) }, async () => {
            while (true) {
              const i = next;
              next += 1;
              if (i >= sampleBurst) {
                return;
              }
              const start = performance.now();
              const status = await new Promise<number>((resolve, reject) => {
                http
                  .get(`http://127.0.0.1:${port}/health`, (res) => {
                    res.on("data", () => {});
                    res.on("end", () => resolve(res.statusCode ?? 0));
                  })
                  .on("error", reject);
              });
              cappedLatencies.push(performance.now() - start);
              if (status === 200) {
                okCount += 1;
              }
            }
          })
        );
        server.close();

        assert.equal(okCount, sampleBurst);
        const p99 = percentile(cappedLatencies, 99);
        assert.ok(
          p99 <= SLOW_SINK_HTTP_P99_CEILING_MS,
          `stream-backed slow sink: health p99 ${p99}ms > ${SLOW_SINK_HTTP_P99_CEILING_MS}ms`
        );
      } finally {
        (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
      }
    });
  }
);
