import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import http from "node:http";

import { metricsRegistry, resetMetricsRegistryForTests } from "../observability/metrics";
import {
  GracefulShutdownHttpTimeoutError,
  isGracefulShutdownInProgress,
  resetGracefulShutdownStateForTests,
  runGracefulShutdown,
} from "./graceful-shutdown";

const shutdownPath = join(dirname(fileURLToPath(import.meta.url)), "graceful-shutdown.ts");
const healthPath = join(dirname(fileURLToPath(import.meta.url)), "../health/health.routes.ts");
const workerPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../test/4-integration/graceful-shutdown-worker.ts"
);

describe("graceful shutdown HTTP watchdog (DEC-085)", () => {
  afterEach(() => {
    resetGracefulShutdownStateForTests();
    resetMetricsRegistryForTests();
  });

  it("source wires closeIdleConnections, HTTP timeout, and force-close metric", () => {
    const source = readFileSync(shutdownPath, "utf8");
    assert.match(source, /closeIdleConnections/);
    assert.match(source, /GRACEFUL_SHUTDOWN_HTTP_MS/);
    assert.match(source, /closeAllConnections/);
    assert.match(source, /graceful_shutdown_http_force_close_total/);
    assert.match(source, /flushLogSink/);
    assert.match(source, /SIGINT/);
  });

  it("health route wires shutting_down 503 contract", () => {
    const healthSource = readFileSync(healthPath, "utf8");
    assert.match(healthSource, /isGracefulShutdownInProgress/);
    assert.match(healthSource, /shutting_down/);
    assert.equal(isGracefulShutdownInProgress(), false);
  });

  it("worker uses installGracefulShutdownHandlers (SD-G7)", () => {
    const worker = readFileSync(workerPath, "utf8");
    assert.match(worker, /installGracefulShutdownHandlers/);
    assert.doesNotMatch(worker, /async function gracefulShutdown/);
  });

  it("HTTP watchdog rejects when server.close hangs", async () => {
    process.env.GRACEFUL_SHUTDOWN_HTTP_MS = "100";
    resetMetricsRegistryForTests();

    const server = createServer((_req, res) => {
      res.writeHead(200, { Connection: "keep-alive" });
      res.write("hang");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("no listen address");
    }

    const client = http.get({
      hostname: "127.0.0.1",
      port: addr.port,
      path: "/",
      agent: false,
    });
    await new Promise<void>((resolve) => client.on("response", () => resolve()));

    const outboxRelay = {
      stop: async () => undefined,
    };

    await assert.rejects(
      () => runGracefulShutdown({ server, outboxRelay }),
      (error: unknown) => error instanceof GracefulShutdownHttpTimeoutError
    );

    assert.ok(metricsRegistry.getMetric("graceful_shutdown_http_force_close_total") >= 1);
    client.destroy();
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
