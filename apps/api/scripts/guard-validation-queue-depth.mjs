#!/usr/bin/env node
/**
 * SCAL-DEBT-06 / DEC-054 — validation scheduler must enforce per-tenant queue depth.
 * @see docs/phase-5/appendices/validation-fairness.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEDULER = path.join(ROOT, "src/canonical/validation-scheduler.ts");
const source = fs.readFileSync(SCHEDULER, "utf8");

const violations = [];

if (!source.includes("ValidationQueueSaturatedError")) {
  violations.push("validation-scheduler.ts must reject with ValidationQueueSaturatedError");
}
if (!source.includes("readMaxQueueDepthPerTenant")) {
  violations.push("validation-scheduler.ts must read P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT");
}
if (!/pendingDepth\s*>=\s*maxDepth/.test(source)) {
  violations.push("validation-scheduler.ts must compare pending queue depth before enqueue");
}
if (!source.includes("validation_queue_shed_total")) {
  violations.push("validation-scheduler.ts must increment validation_queue_shed_total metric");
}

const interceptorPath = path.join(ROOT, "src/middleware/error-interceptor.ts");
const interceptorSource = fs.readFileSync(interceptorPath, "utf8");
if (!interceptorSource.includes("isValidationQueueSaturatedError")) {
  violations.push("error-interceptor.ts must map ValidationQueueSaturatedError to 429");
}

if (violations.length > 0) {
  console.error("guard-validation-queue-depth: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-validation-queue-depth: PASS");
