/**
 * Loaded via `node --import ./test/bootstrap-outbox-test-env.ts` before every API test run.
 * Disables in-process outbox relay / projection auto-reconcile and quiesces stale processing rows.
 */
import { before, beforeEach } from "node:test";

import { resetDbCircuitBreakerForTests } from "../src/db/db-circuit-breaker";
import { resetTenantConnectionBudgetForTests } from "../src/db/tenant-connection-budget";
import { resetWeightedFairAdmissionForTests } from "../src/http/weighted-fair-admission";
import { resetRedisRateLimiterCircuitForTests } from "../src/middleware/redis-rate-limiter-resilience";
import { resetTenantRateLimiterStoreForTests } from "../src/middleware/tenant-rate-limiter";
import { resetTourWriteConcurrencyBudgetForTests } from "../src/http/tour-write-concurrency-budget";
import { resetOutboxRelayTenantBudgetForTests } from "../src/outbox/outbox-relay-tenant-budget";

process.env.OUTBOX_RELAY_ENABLED = "false";
process.env.PROJECTION_AUTO_RECONCILE_ENABLED = "false";
process.env.P5_VALIDATION_WORKERS_ENABLED = "false";

/**
 * Memory trunk specs must not resolve tenant workspace_type via Postgres while storage is in-memory.
 * Shell `.env` DATABASE_URL would otherwise bind operator-smoke tenant 014 to denali and break
 * starter-canonical POST /tours bodies in Phase 9.3 memory specs.
 */
if (process.env.STORAGE_DRIVER?.trim() === "memory") {
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_URL_ADMIN;
  delete process.env.REDIS_URL;
}

/** Integration suites need headroom for concurrent mixed-tenant specs (DEC-055). */
if (process.env.DATABASE_URL?.trim() && !process.env.TENANT_MAX_CONCURRENT_DB_OPS?.trim()) {
  process.env.TENANT_MAX_CONCURRENT_DB_OPS = "64";
}

beforeEach(async () => {
  resetTenantConnectionBudgetForTests();
  resetDbCircuitBreakerForTests();
  resetWeightedFairAdmissionForTests();
  resetRedisRateLimiterCircuitForTests();
  resetTourWriteConcurrencyBudgetForTests();
  resetOutboxRelayTenantBudgetForTests();
  await resetTenantRateLimiterStoreForTests();
});

if (process.env.DATABASE_URL?.trim()) {
  before(async () => {
    const { reclaimStaleProcessingOutboxRows } =
      await import("../src/outbox/outbox-processing-reclaim");
    await reclaimStaleProcessingOutboxRows(0);
  });
}
