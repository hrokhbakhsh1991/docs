#!/usr/bin/env node
/**
 * LOG-BP-04 / DEC-128 — internal 500 logs must use burst budget before logger.error.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const violations = [];
const interceptor = read("src/middleware/error-interceptor.ts");
const budget = read("src/observability/internal-error-log-budget.ts");

if (!budget.includes("acquireInternalErrorLogSlot")) {
  violations.push("internal-error-log-budget.ts must export acquireInternalErrorLogSlot");
}
if (!interceptor.includes("acquireInternalErrorLogSlot")) {
  violations.push(
    "error-interceptor.ts must use acquireInternalErrorLogSlot in logInternalServerError"
  );
}
if (!interceptor.includes("http_internal_error_log_suppressed_total")) {
  violations.push(
    "error-interceptor.ts must increment http_internal_error_log_suppressed_total when suppressed"
  );
}

const profile = read("scripts/reliability-outbox-relay-profile.ts");
if (profile.includes("console.error(process.env.P5_RELIABILITY_SAMPLES)")) {
  violations.push(
    "reliability-outbox-relay-profile.ts must sanitize P5_RELIABILITY_SAMPLES (H-03)"
  );
}
if (!profile.includes("sanitizeReliabilitySamplePayload")) {
  violations.push("reliability-outbox-relay-profile.ts must use sanitizeReliabilitySamplePayload");
}

if (violations.length > 0) {
  console.error("guard-internal-error-log-budget: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-internal-error-log-budget: PASS");
