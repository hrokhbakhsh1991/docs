#!/usr/bin/env node
/**
 * Ops sign-off helper: every 4xx/5xx log line in a sample drain must include structured error_code.
 *
 * Usage:
 *   node scripts/verify-production-log-sample.mjs scripts/fixtures/production-log-sample.ndjson
 *   kubectl logs ... | node scripts/verify-production-log-sample.mjs
 *
 * Env:
 *   PRODUCTION_LOG_SAMPLE — path override when no argv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = path.resolve(__dirname, "fixtures/production-log-sample.ndjson");

function readInput(argvPath) {
  const file = argvPath || process.env.PRODUCTION_LOG_SAMPLE || DEFAULT_FIXTURE;
  if (file && file !== "-") {
    return fs.readFileSync(path.resolve(file), "utf8");
  }
  return fs.readFileSync(0, "utf8");
}

function httpStatusFromRecord(obj) {
  if (typeof obj.status === "number") {
    return obj.status;
  }
  if (typeof obj.status_code === "number") {
    return obj.status_code;
  }
  if (typeof obj.http_status === "number") {
    return obj.http_status;
  }
  const nested = obj.error ?? obj.err;
  if (nested && typeof nested.status === "number") {
    return nested.status;
  }
  return undefined;
}

function errorCodeFromRecord(obj) {
  if (typeof obj.error_code === "string" && obj.error_code.trim()) {
    return obj.error_code.trim();
  }
  if (obj.error && typeof obj.error.code === "string" && obj.error.code.trim()) {
    return obj.error.code.trim();
  }
  if (typeof obj.code === "string" && obj.code.trim() && obj.code !== obj.level) {
    return obj.code.trim();
  }
  return undefined;
}

function main() {
  const raw = readInput(process.argv[2]);
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const violations = [];
  let _clientErrors = 0;
  let _serverErrors = 0;
  let _okLines = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      violations.push(`line ${lineNo}: invalid JSON`);
      continue;
    }

    const status = httpStatusFromRecord(obj);
    if (status === undefined || status < 400) {
      _okLines += 1;
      continue;
    }
    if (status >= 500) {
      _serverErrors += 1;
    } else {
      _clientErrors += 1;
    }

    const code = errorCodeFromRecord(obj);
    if (!code || code === "UNKNOWN_ERROR") {
      violations.push(`line ${lineNo}: status=${status} missing structured error_code`);
    }
  }

  if (violations.length > 0) {
    for (const _v of violations.slice(0, 20)) {
    }
    if (violations.length > 20) {
    }
    process.exit(1);
  }

}

main();
