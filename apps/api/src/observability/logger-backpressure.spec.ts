import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  bindLogSinkErrorHandler,
  createBoundedLogDestination,
  resolveLogSinkFlushTimeoutMs,
  resolveLogSinkMaxLength,
  resolveLogSinkMinLength,
} from "./log-sink";
import { metricsRegistry, resetMetricsRegistryForTests } from "./metrics";

const ROOT = dirname(fileURLToPath(import.meta.url));

describe("logging backpressure contract (DEC-063)", () => {
  it("resolves bounded sink defaults", () => {
    assert.equal(resolveLogSinkMinLength(), 4096);
    assert.equal(resolveLogSinkMaxLength(), 4_194_304);
    assert.equal(resolveLogSinkFlushTimeoutMs(), 2000);
  });

  it("bindLogSinkErrorHandler increments metric on destination error (SCAL-HF-09)", () => {
    const destination = createBoundedLogDestination();
    bindLogSinkErrorHandler(destination);
    const before = metricsRegistry.getMetric("log_sink_error_total");
    destination.emit("error", new Error("EPIPE"));
    assert.ok(
      metricsRegistry.getMetric("log_sink_error_total") > before,
      "destination error must increment log_sink_error_total without throwing"
    );
    destination.end();
  });

  it("graceful shutdown drains access-log queue then flushes sink", () => {
    const source = readFileSync(join(ROOT, "../server/graceful-shutdown.ts"), "utf8");
    const runBody = source.slice(source.indexOf("export async function runGracefulShutdown"));
    const closeIndex = runBody.indexOf("closeHttpServerWithWatchdog(deps.server)");
    const drainIndex = runBody.indexOf("drainHttpRequestLogQueueSync()");
    const flushIndex = runBody.indexOf("await flushLogSink()");
    const outboxIndex = runBody.indexOf("drainOutboxRelayOnShutdown");

    assert.ok(closeIndex >= 0);
    assert.ok(drainIndex > closeIndex, "queue drain must run after HTTP close");
    assert.ok(flushIndex > drainIndex, "log flush must run after queue drain");
    assert.ok(outboxIndex > flushIndex, "outbox drain must run after log flush");
  });
});
