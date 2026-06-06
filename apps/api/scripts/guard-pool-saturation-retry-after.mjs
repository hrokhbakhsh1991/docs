#!/usr/bin/env node
/**
 * DEC-113 — pool saturation 503 Retry-After wiring lock.
 * @see docs/phase-5/appendices/pool-saturation-retry-after.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

for (const rel of [
  "src/db/pool-saturation.ts",
  "src/db/pool-saturation.spec.ts",
  "src/middleware/error-interceptor-pool-saturation.spec.ts",
]) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

const pool = read("src/db/pool-saturation.ts");
if (!pool.includes("DbPoolSaturatedError")) {
  violations.push("pool-saturation.ts must export DbPoolSaturatedError");
}
if (!pool.includes("resolvePoolSaturationRetryAfterSec")) {
  violations.push("pool-saturation.ts must export resolvePoolSaturationRetryAfterSec");
}
if (!pool.includes("DB_POOL_SATURATED_RETRY_AFTER_SEC")) {
  violations.push("pool-saturation.ts must read DB_POOL_SATURATED_RETRY_AFTER_SEC");
}

const interceptor = read("src/middleware/error-interceptor.ts");
if (!interceptor.includes("isDbPoolSaturatedError")) {
  violations.push("error-interceptor.ts must handle isDbPoolSaturatedError");
}
if (!interceptor.includes("readDbPoolSaturatedRetryAfterSec")) {
  violations.push("error-interceptor.ts must pass pool saturation Retry-After");
}

const pkg = read("package.json");
if (!pkg.includes("guard:pool-saturation-retry-after")) {
  violations.push("package.json must define guard:pool-saturation-retry-after");
}

if (violations.length > 0) {
  console.error("guard-pool-saturation-retry-after: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-pool-saturation-retry-after: PASS");
