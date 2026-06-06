#!/usr/bin/env node
/**
 * DEC-078 / Phase 4 step 8 — PATCH schema drift HTTP cases in contract spec.
 * @see docs/phase-5/appendices/patch-schema-drift.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const spec = read("test/4-integration/schema-version-compat.spec.ts");

if (!spec.includes("async function patchTour")) {
  violations.push("schema-version-compat.spec.ts must define patchTour HTTP helper");
}
if (!/PATCH \/tours\/:id SV-PATCH-01/.test(spec)) {
  violations.push(
    "schema-version-compat.spec.ts must include SV-PATCH-01 stale schemaVersion case"
  );
}
if (!/PATCH \/tours\/:id SV-PATCH-09/.test(spec)) {
  violations.push(
    "schema-version-compat.spec.ts must include SV-PATCH-09 merge + stale version case"
  );
}
if (!/PATCH \/tours\/:id SV-PATCH-05/.test(spec)) {
  violations.push("schema-version-compat.spec.ts must include SV-PATCH-05 partial data case");
}
if (!/PATCH \/tours\/:id SV-PATCH-OK/.test(spec)) {
  violations.push("schema-version-compat.spec.ts must include SV-PATCH-OK success merge case");
}
if (!/patchTour\([\s\S]*SCHEMA_VERSION_MISMATCH/.test(spec)) {
  violations.push("schema-version-compat.spec.ts must assert SCHEMA_VERSION_MISMATCH on PATCH");
}
if (!spec.includes("CanonicalTourService.updateTour")) {
  violations.push("schema-version-compat.spec.ts must cover updateTour service parity");
}

const service = read("src/canonical/canonical-tour.service.ts");
if (!service.includes("runPreTransactionValidation")) {
  violations.push("canonical-tour.service.ts must gate PATCH via runPreTransactionValidation");
}

const workerPool = read("src/canonical/validation-worker-pool.ts");
if (!workerPool.includes("SchemaVersionMismatchError")) {
  violations.push(
    "validation-worker-pool.ts must rehydrate SchemaVersionMismatchError for HTTP PATCH/POST"
  );
}

const interceptor = read("src/middleware/error-interceptor.ts");
if (!interceptor.includes('message.startsWith("SCHEMA_VERSION_MISMATCH")')) {
  violations.push("error-interceptor.ts must map SCHEMA_VERSION_MISMATCH message to 400");
}

if (violations.length > 0) {
  console.error("guard-patch-schema-drift: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-patch-schema-drift: PASS");
