/**
 * DEC-083 — Redis runtime blip must not surface HTTP 500 on rate-limited routes.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { disconnectPrisma } from "../../src/db/prisma";
import {
  resetRedisRateLimiterCircuitForTests,
  resolveRedisFailurePolicy,
} from "../../src/middleware/redis-rate-limiter-resilience";
import { resetTenantRateLimiterStoreForTests } from "../../src/middleware/tenant-rate-limiter";
import { metricsRegistry, resetMetricsRegistryForTests } from "../../src/observability/metrics";
import { createTestToursService, integrationTenantId } from "../test-helpers";

describe("4-integration — redis rate limiter fallback (DEC-083)", () => {
  const tenantId = integrationTenantId();
  let server: http.Server;
  const envSnapshot = {
    REDIS_URL: process.env.REDIS_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    TENANT_RATE_LIMIT_ENABLED: process.env.TENANT_RATE_LIMIT_ENABLED,
    TENANT_RATE_LIMIT_POINTS: process.env.TENANT_RATE_LIMIT_POINTS,
    TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY: process.env.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    NODE_ENV: process.env.NODE_ENV,
  };

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
    process.env.REDIS_URL = "redis://127.0.0.1:59999";
    process.env.TENANT_RATE_LIMIT_ENABLED = "true";
    process.env.TENANT_RATE_LIMIT_POINTS = "100";
    process.env.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY = "fail_local";
    await resetTenantRateLimiterStoreForTests();
    resetRedisRateLimiterCircuitForTests();
    resetMetricsRegistryForTests();

    const listener = createRequestListener({ toursService: createTestToursService() });
    server = http.createServer(listener);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  after(
    async () => {
      process.env.REDIS_URL = envSnapshot.REDIS_URL;
      process.env.TENANT_RATE_LIMIT_ENABLED = envSnapshot.TENANT_RATE_LIMIT_ENABLED;
      process.env.TENANT_RATE_LIMIT_POINTS = envSnapshot.TENANT_RATE_LIMIT_POINTS;
      process.env.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY =
        envSnapshot.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY;
      process.env.STORAGE_DRIVER = envSnapshot.STORAGE_DRIVER;
      process.env.NODE_ENV = envSnapshot.NODE_ENV;
      if (envSnapshot.DATABASE_URL === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = envSnapshot.DATABASE_URL;
      }
      await disconnectPrisma();
      await resetTenantRateLimiterStoreForTests();
      resetRedisRateLimiterCircuitForTests();
      if (typeof server.closeIdleConnections === "function") {
        server.closeIdleConnections();
      }
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    { scope: "suite" }
  );

  function authHeaders(): Record<string, string> {
    return {
      "x-tenant-id": tenantId,
      "x-authenticated-tenant-id": tenantId,
      "x-user-id": "redis-fallback-user",
      "x-actor-role": "admin",
      "x-membership-status": "ACTIVE",
      "x-workspace-id": "ws-redis-fallback",
    };
  }

  async function postTour(): Promise<number> {
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("server not listening");
    }
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        schemaVersion: 1,
        data: {
          basics: { title: "Redis fallback probe" },
          details: { description: "DEC-083" },
        },
      });
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/tours",
          method: "POST",
          headers: {
            ...authHeaders(),
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
            connection: "close",
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve(res.statusCode ?? 0));
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  it("write tier defaults to fail_local when env unset", () => {
    const prior = process.env.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY;
    delete process.env.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY;
    assert.equal(resolveRedisFailurePolicy("write"), "fail_local");
    assert.equal(resolveRedisFailurePolicy("read"), "fail_open");
    process.env.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY = prior;
  });

  it("SH-GAP-13: unreachable Redis + fail_local returns 201 or 429, never 500", async () => {
    const status = await postTour();
    assert.notEqual(status, 500, "Redis blip must not surface internal_error");
    assert.ok(
      status === 201 || status === 429,
      `expected 201 or 429 under fail_local; got ${status}`
    );
    assert.ok(
      metricsRegistry.getMetric("rate_limiter_redis_fallback_total") >= 1,
      "fallback metric must increment"
    );
  });
});
