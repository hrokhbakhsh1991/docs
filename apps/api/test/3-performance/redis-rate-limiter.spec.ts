/**
 * P1-1 — Redis rate limiter store (requires REDIS_URL).
 *
 * Run:
 *   REDIS_URL=redis://127.0.0.1:6379 NODE_ENV=test node --import tsx --test test/3-performance/redis-rate-limiter.spec.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RedisRateLimiterStore } from "../../src/middleware/redis-rate-limiter-store";
import {
  MemoryRateLimiterStore,
  resetTenantRateLimiterStoreForTests,
  resolveTenantRateLimitConfig,
  TenantRateLimitExceededError,
} from "../../src/middleware/tenant-rate-limiter";

const redisUrl = process.env.REDIS_URL?.trim();

describe("3-performance — redis rate limiter store", { skip: !redisUrl }, () => {
  it("enforces per-tenant keys in Redis when REDIS_URL is set", async () => {
    await resetTenantRateLimiterStoreForTests();
    const config = resolveTenantRateLimitConfig(
      {
        ...process.env,
        TENANT_RATE_LIMIT_POINTS: "2",
        TENANT_RATE_LIMIT_DURATION_SEC: "60",
        TENANT_RATE_LIMIT_ENABLED: "true",
      },
      "write"
    );
    const store = new RedisRateLimiterStore(redisUrl!, config, new MemoryRateLimiterStore(config));
    const tenantKey = `redis-rl-test-${Date.now()}`;

    try {
      await store.consume(tenantKey);
      await store.consume(tenantKey);

      await assert.rejects(
        () => store.consume(tenantKey),
        (error: unknown) => {
          assert.ok(error instanceof TenantRateLimitExceededError);
          return true;
        }
      );
    } finally {
      await store.disconnect();
    }
  });
});

describe("3-performance — redis rate limiter store (BLOCKER without REDIS_URL)", () => {
  it(
    "documents skip when REDIS_URL is unset — multi-replica needs Redis tier",
    {
      skip: Boolean(redisUrl),
    },
    () => {
      assert.ok(
        true,
        "REDIS_URL unset: MemoryRateLimiterStore remains interim per 7.6-rate-limits.md"
      );
    }
  );
});
