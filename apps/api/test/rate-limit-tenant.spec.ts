/**
 * Phase 7.6 — Redis per-tenant rate limit isolation + structured 429 body.
 *
 * Skips when REDIS_URL unset (BL-P7-02).
 *
 * Run:
 *   REDIS_URL=redis://127.0.0.1:6379 RATE_LIMIT_POOL_RPM=5 \
 *     pnpm --filter @apps/api exec node --import tsx --test test/rate-limit-tenant.spec.ts
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  rateLimitConsumerKey,
  resetTenantRateLimiterStoreForTests,
} from "../src/middleware/tenant-rate-limiter";
import { createTestToursService, integrationTenantId } from "./test-helpers";

const redisUrl = process.env.REDIS_URL?.trim();
const describeRedis = redisUrl !== undefined && redisUrl.length > 0 ? describe : describe.skip;

const POOL_RPM = Number.parseInt(process.env.RATE_LIMIT_POOL_RPM ?? "5", 10);
const BURST_A = POOL_RPM + 3;
const BURST_B = 2;

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "rate-limit-redis-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-rate-limit-redis",
  };
}

type PostResult = {
  readonly status: number;
  readonly body: { error?: string; requestId?: string; retryAfterMs?: number };
};

describeRedis("rate-limit-tenant (7.6 Redis)", { concurrency: false }, () => {
  const tenantAId = integrationTenantId();
  const tenantBId = integrationTenantId();
  let listener: ReturnType<typeof createRequestListener>;
  let server: http.Server;
  let port = 0;
  const priorEnv = { ...process.env };

  before(async () => {
    await resetTenantRateLimiterStoreForTests();
    process.env.STORAGE_DRIVER = "memory";
    process.env.NODE_ENV = "test";
    process.env.REDIS_URL = redisUrl;
    process.env.TENANT_RATE_LIMIT_ENABLED = "true";
    process.env.RATE_LIMIT_POOL_RPM = String(POOL_RPM);
    delete process.env.TENANT_RATE_LIMIT_POINTS;
    process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = String(BURST_A + BURST_B);
    listener = createRequestListener({ toursService: createTestToursService() });
    server = http.createServer(listener);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          throw new Error("rate-limit-tenant: no listen address");
        }
        port = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    server.close();
    await resetTenantRateLimiterStoreForTests();
    for (const key of Object.keys(process.env)) {
      if (!(key in priorEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, priorEnv);
  });

  it("uses pool-tier route key shape", () => {
    const key = rateLimitConsumerKey(tenantAId, "pool", "write", {
      method: "POST",
      path: "/tours",
    });
    assert.equal(key, `${tenantAId}:pool:write:POST:/tours`);
  });

  async function httpPostTour(tenantId: string, suffix: string): Promise<PostResult> {
    const body = {
      data: {
        basics: { title: `rlt-${suffix}` },
        details: { summary: "burst" },
      },
    };
    const payload = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/tours",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(payload)),
            ...authHeaders(tenantId),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : {},
            });
          });
        }
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }

  it("isolates tenants and returns structured 429 body", async () => {
    const burstA = Array.from({ length: BURST_A }, (_, i) => httpPostTour(tenantAId, `a-${i}`));
    const burstB = Array.from({ length: BURST_B }, (_, i) => httpPostTour(tenantBId, `b-${i}`));

    const [resultsA, resultsB] = await Promise.all([Promise.all(burstA), Promise.all(burstB)]);

    const count201A = resultsA.filter((r) => r.status === 201).length;
    const count429A = resultsA.filter((r) => r.status === 429).length;
    assert.ok(count201A > 0, "tenant A must get some successes");
    assert.ok(count429A > 0, "tenant A must be throttled");

    const count201B = resultsB.filter((r) => r.status === 201).length;
    assert.equal(count201B, BURST_B, "tenant B must not be blocked by tenant A");

    const limited = resultsA.find((r) => r.status === 429);
    assert.ok(limited !== undefined);
    assert.equal(limited.body.error, "rate_limit_exceeded");
    assert.ok(typeof limited.body.requestId === "string");
    assert.ok(typeof limited.body.retryAfterMs === "number");
  });
});
