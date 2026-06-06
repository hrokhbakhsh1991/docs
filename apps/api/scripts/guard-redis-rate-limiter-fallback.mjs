#!/usr/bin/env node
/**
 * DEC-083 — Redis runtime fallback wiring lock.
 * @see docs/phase-5/appendices/redis-rate-limiter-fallback.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "../..");
const violations = [];

function read(rel, base = ROOT) {
  return fs.readFileSync(path.join(base, rel), "utf8");
}

function exists(rel, base = ROOT) {
  return fs.existsSync(path.join(base, rel));
}

const docPath = "docs/phase-5/appendices/redis-rate-limiter-fallback.md";
if (!exists(docPath, REPO)) {
  violations.push(`${docPath} must exist`);
}

const resilience = read("src/middleware/redis-rate-limiter-resilience.ts");
if (!resilience.includes("resolveRedisFailurePolicy")) {
  violations.push("redis-rate-limiter-resilience.ts must export resolveRedisFailurePolicy");
}
if (!resilience.includes("fail_local")) {
  violations.push("redis-rate-limiter-resilience.ts must define fail_local policy");
}

const store = read("src/middleware/redis-rate-limiter-store.ts");
if (!store.includes("rate_limiter_redis_fallback_total")) {
  violations.push("redis-rate-limiter-store.ts must increment rate_limiter_redis_fallback_total");
}
if (!store.includes("RateLimiterRedisUnavailableError")) {
  violations.push(
    "redis-rate-limiter-store.ts must throw RateLimiterRedisUnavailableError for fail_closed"
  );
}

const limiter = read("src/middleware/tenant-rate-limiter.ts");
if (!limiter.includes("RateLimiterRedisUnavailableError")) {
  violations.push("tenant-rate-limiter.ts must define RateLimiterRedisUnavailableError");
}

const interceptor = read("src/middleware/error-interceptor.ts");
if (!interceptor.includes("rate_limiter_redis_unavailable")) {
  violations.push("error-interceptor.ts must map Redis unavailable to 503");
}

const specPath = "test/4-integration/redis-rate-limiter-fallback.spec.ts";
if (!exists(specPath)) {
  violations.push(`${specPath} must exist`);
}

const gate = read("scripts/phase-3-regression-gate.mjs");
if (!gate.includes("guard:redis-rate-limiter-fallback")) {
  violations.push("phase-3-regression-gate.mjs must run guard:redis-rate-limiter-fallback");
}

if (violations.length > 0) {
  console.error("guard-redis-rate-limiter-fallback: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-redis-rate-limiter-fallback: PASS");
