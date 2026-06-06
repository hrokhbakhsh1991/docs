#!/usr/bin/env node
/**
 * Burst benchmark — 1000 GET /health requests with vs without withRequestLogging.
 * Run: cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory npx tsx scripts/log-backpressure-burst.ts
 */
import http from "node:http";
import { performance } from "node:perf_hooks";
import pino from "pino";

import { createRequestListener } from "../src/app";
import { withRequestLogging } from "../src/http/request-logging";
import { createTestToursService } from "../test/test-helpers";

const BURST = 1000;
const CONCURRENCY = 100;

type Sample = { readonly ms: number };

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function summarize(samples: readonly Sample[]) {
  const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
  const sum = ms.reduce((a, b) => a + b, 0);
  return {
    count: ms.length,
    avgMs: sum / ms.length,
    p50Ms: percentile(ms, 50),
    p95Ms: percentile(ms, 95),
    p99Ms: percentile(ms, 99),
    maxMs: ms[ms.length - 1] ?? 0,
  };
}

async function runBurst(
  listener: (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>
): Promise<Sample[]> {
  const server = http.createServer(listener);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    server.close();
    throw new Error("no listen address");
  }
  const port = addr.port;

  const samples: Sample[] = [];
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next;
      next += 1;
      if (i >= BURST) return;

      const start = performance.now();
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          { hostname: "127.0.0.1", port, path: "/health", method: "GET" },
          (res) => {
            res.on("data", () => {});
            res.on("end", () => {
              samples.push({ ms: performance.now() - start });
              resolve();
            });
          }
        );
        req.on("error", reject);
        req.end();
      });
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  return samples;
}

/** Isolated pino write cost — no HTTP. */
function benchPinoWrites(count: number, destination: pino.DestinationStream): Sample[] {
  const log = pino({ level: "info" }, destination);
  const samples: Sample[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = performance.now();
    log.info(
      {
        event: "http.request",
        http: { method: "GET", path: "/health", statusCode: 200 },
        durationMs: 1,
      },
      "request completed"
    );
    samples.push({ ms: performance.now() - start });
  }
  return samples;
}

async function main(): Promise<void> {
  process.env.NODE_ENV = "test";
  process.env.STORAGE_DRIVER = "memory";
  process.env.OUTBOX_RELAY_ENABLED = "false";

  const base = createRequestListener({ toursService: createTestToursService() });
  const withLogging = withRequestLogging(base);

  console.error(`\n--- log-backpressure-burst (n=${BURST}, concurrency=${CONCURRENCY}) ---\n`);

  // Warmup
  await runBurst(base);
  await runBurst(withLogging);

  const bare = await runBurst(base);
  const logged = await runBurst(withLogging);

  const bareStats = summarize(bare);
  const loggedStats = summarize(logged);

  const deltaP50 = loggedStats.p50Ms - bareStats.p50Ms;
  const deltaP95 = loggedStats.p95Ms - bareStats.p95Ms;
  const deltaP99 = loggedStats.p99Ms - bareStats.p99Ms;

  console.error("GET /health (in-process, memory driver):");
  console.error(
    JSON.stringify(
      {
        bare: bareStats,
        withRequestLogging: loggedStats,
        deltaMs: { p50: deltaP50, p95: deltaP95, p99: deltaP99 },
      },
      null,
      2
    )
  );

  const devNull = pino.destination({ dest: "/dev/null", sync: false, minLength: 0 });
  const stdout = pino.destination({ dest: 1, sync: false, minLength: 4096 });

  const nullWrites = summarize(benchPinoWrites(BURST, devNull));
  const stdoutWrites = summarize(benchPinoWrites(BURST, stdout));

  console.error("\nPino info() sync return time (no HTTP, n=1000 sequential):");
  console.error(
    JSON.stringify({ devNull: nullWrites, stdoutDefaultBuffer: stdoutWrites }, null, 2)
  );

  devNull.end();
  stdout.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
