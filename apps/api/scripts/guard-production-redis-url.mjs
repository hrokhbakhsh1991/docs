#!/usr/bin/env node
/**
 * SCAL-DEBT-04 / DEC-065 — production REDIS_URL fail-closed when rate limiting enabled.
 * @see docs/phase-5/appendices/rate-limiting.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const limiter = read("src/middleware/tenant-rate-limiter.ts");
if (!limiter.includes("assertProductionRedisUrl")) {
  violations.push("tenant-rate-limiter.ts must export assertProductionRedisUrl");
}
if (!limiter.includes("PRODUCTION_REDIS_URL_REQUIRED")) {
  violations.push("tenant-rate-limiter.ts must define PRODUCTION_REDIS_URL_REQUIRED");
}

const productionRuntime = read("src/server/production-runtime-env.ts");
if (!productionRuntime.includes("assertProductionRedisUrl()")) {
  violations.push("production-runtime-env.ts must call assertProductionRedisUrl()");
}

const mainTs = read("src/main.ts");
if (!mainTs.includes("assertProductionRuntimeIntegrity()")) {
  violations.push("main.ts must call assertProductionRuntimeIntegrity() at boot");
}

if (violations.length > 0) {
  console.error("guard:production-redis-url: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard:production-redis-url: PASS");
