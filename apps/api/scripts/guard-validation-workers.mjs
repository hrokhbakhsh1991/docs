#!/usr/bin/env node
/**
 * SCAL-DEBT-02 / DEC-056 — validation must offload CPU work to worker pool.
 * @see docs/phase-5/appendices/validation-fairness.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

const canonicalValidation = read("src/tours/canonical-validation.ts");
if (!canonicalValidation.includes("runValidationOffThread")) {
  violations.push(
    "canonical-validation.ts must call runValidationOffThread from validateCanonicalBeforePersist"
  );
}
if (!canonicalValidation.includes("validateCanonicalBeforePersistSync")) {
  violations.push(
    "canonical-validation.ts must export validateCanonicalBeforePersistSync for worker entry"
  );
}

const workerPool = read("src/canonical/validation-worker-pool.ts");
if (!workerPool.includes("SchemaVersionMismatchError")) {
  violations.push("validation-worker-pool.ts must rehydrate SchemaVersionMismatchError off-thread");
}
if (!workerPool.includes("ValidationTimeBudgetExceededError")) {
  violations.push("validation-worker-pool.ts must enforce ValidationTimeBudgetExceededError");
}
if (!workerPool.includes("validation_time_budget_exceeded_total")) {
  violations.push("validation-worker-pool.ts must increment validation_time_budget_exceeded_total");
}

const workerEntry = read("src/canonical/validation-worker-entry.ts");
if (!workerEntry.includes("validateCanonicalBeforePersistSync")) {
  violations.push("validation-worker-entry.ts must run validateCanonicalBeforePersistSync");
}

const preTx = read("src/canonical/pre-transaction-validation.ts");
if (!/await\s+validateCanonicalBeforePersist/.test(preTx)) {
  violations.push("pre-transaction-validation.ts must await validateCanonicalBeforePersist");
}

const interceptor = read("src/middleware/error-interceptor.ts");
if (!interceptor.includes("isValidationTimeBudgetExceededError")) {
  violations.push("error-interceptor.ts must map ValidationTimeBudgetExceededError to 408");
}

if (violations.length > 0) {
  console.error("guard-validation-workers: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-validation-workers: PASS");
