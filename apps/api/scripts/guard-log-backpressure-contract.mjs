#!/usr/bin/env node
/**
 * SCAL-DEBT-08 / DEC-063 — bounded log sink + shutdown flush contract.
 * @see docs/phase-5/appendices/logging-backpressure.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const logSink = read("src/observability/log-sink.ts");
if (!logSink.includes("pino.destination")) {
  violations.push("log-sink.ts must use explicit pino.destination");
}
if (!logSink.includes("maxLength")) {
  violations.push("log-sink.ts must configure maxLength for bounded buffer");
}
if (!logSink.includes('destination.on("drain"')) {
  violations.push("log-sink.ts must subscribe to drain events");
}
if (!logSink.includes('destination.on("drop"')) {
  violations.push("log-sink.ts must subscribe to drop events");
}
if (!logSink.includes("log_sink_drain_total")) {
  violations.push("log-sink.ts must increment log_sink_drain_total");
}
if (!logSink.includes("log_sink_drop_total")) {
  violations.push("log-sink.ts must increment log_sink_drop_total");
}
if (!logSink.includes("bindLogSinkErrorHandler")) {
  violations.push("log-sink.ts must export bindLogSinkErrorHandler (SCAL-HF-09)");
}
if (!logSink.includes("log_sink_error_total")) {
  violations.push("log-sink.ts must increment log_sink_error_total on destination error");
}
if (!logSink.includes("retryEAGAIN")) {
  violations.push("log-sink.ts must disable Sonic-Boom retryEAGAIN spin on full pipe");
}

const loggerTs = read("src/observability/logger.ts");
if (!loggerTs.includes("bindLogSinkErrorHandler")) {
  violations.push("logger.ts must call bindLogSinkErrorHandler");
}
if (!loggerTs.includes("createBoundedLogDestination")) {
  violations.push("logger.ts must use createBoundedLogDestination");
}
if (!loggerTs.includes("flushLogSink")) {
  violations.push("logger.ts must export flushLogSink");
}

const shutdownTs = read("src/server/graceful-shutdown.ts");
if (!shutdownTs.includes("drainHttpRequestLogQueueSync")) {
  violations.push("graceful-shutdown.ts must drain HTTP log queue before exit");
}
if (!shutdownTs.includes("flushLogSink")) {
  violations.push("graceful-shutdown.ts must call flushLogSink after server.close");
}

const requestLogging = read("src/http/request-logging.ts");
if (!requestLogging.includes("drainHttpRequestLogQueueSync")) {
  violations.push("request-logging.ts must export drainHttpRequestLogQueueSync");
}

if (violations.length > 0) {
  console.error("guard-log-backpressure-contract: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-log-backpressure-contract: PASS");
