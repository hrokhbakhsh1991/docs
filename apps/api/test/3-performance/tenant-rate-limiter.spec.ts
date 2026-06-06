/**
 * 3-performance — per-tenant POST /tours rate limiter (DEC-015).
 *
 * Tenant A and B each have an independent 10 req/s bucket (env).
 * Burst: 20 concurrent creates for A + 5 for B → 10×201 + 10×429 for A, 5×201 for B.
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory \
 *     TENANT_RATE_LIMIT_POINTS=10 TENANT_RATE_LIMIT_DURATION_SEC=1 \
 *     node --import tsx --test test/3-performance/tenant-rate-limiter.spec.ts
 *
 * @see docs/phase-5/appendices/rate-limiting.md
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-015
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { resetTenantRateLimiterStoreForTests } from "../../src/middleware/tenant-rate-limiter";
import { createTestToursService, integrationTenantId } from "../test-helpers";

const LIMIT_POINTS = Number.parseInt(process.env.TENANT_RATE_LIMIT_POINTS ?? "10", 10);
const BURST_A = 20;
const BURST_B = 5;

const VALID_TOUR_BODY = {
  data: { basics: { title: "tenant-rate-limiter" }, details: { summary: "ok" } },
} as const;

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "rate-limiter-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-rate-limiter",
  };
}

type PostResult = {
  readonly status: number;
  readonly body: { error?: string; code?: string; retryAfter?: string };
};

describe("tenant rate limiter (3-performance)", { concurrency: false }, () => {
  const tenantAId = integrationTenantId();
  const tenantBId = integrationTenantId();
  let listener: ReturnType<typeof createRequestListener>;
  let server: http.Server;
  let port = 0;
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorLimitPoints = process.env.TENANT_RATE_LIMIT_POINTS;
  const priorLimitDuration = process.env.TENANT_RATE_LIMIT_DURATION_SEC;
  const priorLimitEnabled = process.env.TENANT_RATE_LIMIT_ENABLED;
  const priorMaxTourWrites = process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;

  before(async () => {
    await resetTenantRateLimiterStoreForTests();
    process.env.STORAGE_DRIVER = "memory";
    process.env.NODE_ENV = "test";
    process.env.TENANT_RATE_LIMIT_ENABLED = "true";
    process.env.TENANT_RATE_LIMIT_POINTS = String(LIMIT_POINTS);
    process.env.TENANT_RATE_LIMIT_DURATION_SEC = "1";
    /** Burst exceeds default write cap (8); rate-limit 429 must not be conflated with tour-write shed. */
    process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = String(BURST_A + BURST_B);
    listener = createRequestListener({ toursService: createTestToursService() });
    server = http.createServer(listener);
    return new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          throw new Error("tenant-rate-limiter: no listen address");
        }
        port = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    server.close();
    await resetTenantRateLimiterStoreForTests();
    process.env.STORAGE_DRIVER = priorStorageDriver;
    process.env.TENANT_RATE_LIMIT_POINTS = priorLimitPoints;
    process.env.TENANT_RATE_LIMIT_DURATION_SEC = priorLimitDuration;
    process.env.TENANT_RATE_LIMIT_ENABLED = priorLimitEnabled;
    if (priorMaxTourWrites === undefined) {
      delete process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;
    } else {
      process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = priorMaxTourWrites;
    }
  });

  async function httpPostTour(tenantId: string, suffix: string): Promise<PostResult> {
    const body = {
      data: {
        basics: { title: `trl-${suffix}` },
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

  it("isolates per-tenant buckets: 20 for A (10 allowed) + 5 for B (all allowed)", async () => {
    const burstA = Array.from({ length: BURST_A }, (_, i) => httpPostTour(tenantAId, `a-${i}`));
    const burstB = Array.from({ length: BURST_B }, (_, i) => httpPostTour(tenantBId, `b-${i}`));

    const [resultsA, resultsB] = await Promise.all([Promise.all(burstA), Promise.all(burstB)]);

    const count201A = resultsA.filter((r) => r.status === 201).length;
    const count429RateA = resultsA.filter(
      (r) => r.status === 429 && r.body.code === "RATE_LIMIT_EXCEEDED"
    ).length;
    const count429CapacityA = resultsA.filter(
      (r) => r.status === 429 && String(r.body.error ?? "").startsWith("TOUR_CAPACITY_EXCEEDED")
    ).length;

    assert.equal(
      count201A,
      LIMIT_POINTS,
      `tenant A: expected ${LIMIT_POINTS} successes; got 201=${count201A} rate429=${count429RateA} capacity429=${count429CapacityA}`
    );
    assert.equal(
      count429RateA,
      BURST_A - LIMIT_POINTS,
      `tenant A: expected ${BURST_A - LIMIT_POINTS} rate-limit 429s`
    );
    assert.equal(count429CapacityA, 0, "rate limit 429 must not use TOUR_CAPACITY_EXCEEDED");

    const count201B = resultsB.filter((r) => r.status === 201).length;
    assert.equal(count201B, BURST_B, `tenant B: expected ${BURST_B} successes; got ${count201B}`);
    for (const r of resultsB) {
      assert.notEqual(
        r.body.code,
        "RATE_LIMIT_EXCEEDED",
        "tenant B must not be throttled by tenant A burst"
      );
    }

    const rateLimited = resultsA.find((r) => r.body.code === "RATE_LIMIT_EXCEEDED");
    if (rateLimited) {
      assert.equal(rateLimited.body.error, "rate_limit_exceeded");
      assert.ok(rateLimited.body.retryAfter !== undefined);
    }
  });
});
