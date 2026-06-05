#!/usr/bin/env node
/**
 * TRACE-LOST-01 / DEC-048 — HTTP access logs must carry trace correlation.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-048
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const violations = [];

const requestLogging = read("src/http/request-logging.ts");
if (!requestLogging.includes("getActiveTraceId")) {
  violations.push("request-logging.ts: must read getActiveTraceId in finish handler");
}
if (!/correlationId:\s*getActiveTraceId\(\)/.test(requestLogging)) {
  violations.push("request-logging.ts: logHttpRequest must pass correlationId: getActiveTraceId()");
}

const loggerTs = read("src/observability/logger.ts");
if (!loggerTs.includes("correlationId")) {
  violations.push("logger.ts: RequestLogContext must include correlationId");
}
if (!loggerTs.includes("correlation_id")) {
  violations.push("logger.ts: logHttpRequest must emit correlation_id");
}

if (violations.length > 0) {
  console.error("guard-http-access-trace: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-http-access-trace: PASS");
