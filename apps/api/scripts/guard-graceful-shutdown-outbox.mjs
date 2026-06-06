#!/usr/bin/env node
/**
 * DEC-076 / Phase 4 step 6 — await relay tick + flush timeout signal.
 * @see docs/phase-5/appendices/graceful-shutdown-outbox-drain.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const relay = read("src/outbox/start-outbox-relay.ts");
if (!relay.includes("await inFlightTick")) {
  violations.push("start-outbox-relay.ts must await in-flight tick on stop (SD-G2)");
}
if (!relay.includes("Promise<void>")) {
  violations.push("start-outbox-relay.ts must expose async stop(): Promise<void>");
}

const reclaim = read("src/outbox/outbox-shutdown-drain.ts");
if (!reclaim.includes("OutboxShutdownDrainResult")) {
  violations.push("drainOutboxRelayOnShutdown must return OutboxShutdownDrainResult");
}
if (!reclaim.includes("drained: false")) {
  violations.push("drainOutboxRelayOnShutdown must report drained=false on deadline");
}

const shutdown = read("src/server/graceful-shutdown.ts");
if (!shutdown.includes("await deps.outboxRelay.stop()")) {
  violations.push("graceful-shutdown.ts must await outboxRelay.stop()");
}
if (!shutdown.includes("assertOutboxShutdownDrained")) {
  violations.push("graceful-shutdown.ts must assert outbox drain completed (SD-G3)");
}
if (!shutdown.includes("GRACEFUL_SHUTDOWN_HTTP_MS")) {
  violations.push("graceful-shutdown.ts must define HTTP shutdown watchdog (DEC-085)");
}
if (!shutdown.includes("graceful_shutdown_http_force_close_total")) {
  violations.push("graceful-shutdown.ts must increment graceful_shutdown_http_force_close_total");
}
if (!shutdown.includes("flushLogSink")) {
  violations.push("graceful-shutdown.ts must flush log sink before outbox drain (SD-G5)");
}
if (!shutdown.includes('process.on("SIGINT"')) {
  violations.push("graceful-shutdown.ts must register SIGINT handler (SD-G7)");
}

const health = read("src/health/health.routes.ts");
if (!health.includes("shutting_down")) {
  violations.push("health.routes.ts must return shutting_down 503 during shutdown");
}

const flush = read("src/server/graceful-shutdown-outbox-flush.ts");
if (!flush.includes("GracefulShutdownOutboxFlushTimeoutError")) {
  violations.push("graceful-shutdown-outbox-flush.ts must define flush timeout error");
}
if (!flush.includes("graceful_shutdown_outbox_flush_timeout_total")) {
  violations.push("graceful-shutdown-outbox-flush.ts must increment flush timeout metric");
}

const worker = read("test/4-integration/graceful-shutdown-worker.ts");
if (!worker.includes("installGracefulShutdownHandlers")) {
  violations.push("graceful-shutdown-worker.ts must use installGracefulShutdownHandlers (SD-G7)");
}

for (const spec of [
  "src/server/graceful-shutdown-outbox.spec.ts",
  "src/server/graceful-shutdown-http-watchdog.spec.ts",
  "src/outbox/start-outbox-relay.spec.ts",
]) {
  if (!fs.existsSync(path.join(ROOT, spec))) {
    violations.push(`${spec} must exist`);
  }
}

if (violations.length > 0) {
  console.error("guard-graceful-shutdown-outbox: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-graceful-shutdown-outbox: PASS");
