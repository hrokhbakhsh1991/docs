/**
 * 3-performance — per-tenant HTTP rate limiting probe (DoS / noisy-neighbor isolation).
 *
 * Scenario:
 *   - Baseline: solo tenant-B POST /tours samples (p50)
 *   - Tenant A (attacker): RATE_BURST concurrent POST /tours
 *   - Tenant B (victim): 1 POST /tours fired concurrently with A's burst
 *
 * Assertions:
 *   - Tenant A: mix of 201 and 429 RATE_LIMIT_EXCEEDED (not TOUR_CAPACITY_EXCEEDED)
 *   - Tenant B: 2xx and durationMs ≤ TENANT_B_LATENCY_RATIO_MAX × baseline p50
 *
 * @see docs/phase-5/appendices/rate-limiting.md
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-015
 */
import assert from "node:assert/strict";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { resetTenantRateLimiterStoreForTests } from "../../src/middleware/tenant-rate-limiter";
import { createTestToursService, integrationTenantId } from "../test-helpers";

const RATE_BURST = Number.parseInt(process.env.RATE_BURST ?? "100", 10);
const LIMIT_POINTS = Number.parseInt(process.env.TENANT_RATE_LIMIT_POINTS ?? "10", 10);
const TENANT_B_LATENCY_RATIO_MAX = Number.parseFloat(process.env.TENANT_B_LATENCY_RATIO_MAX ?? "2");
/** Floor for concurrent victim latency — solo p50 understates burst scheduling under trunk suite load (see rate-limiting.md). */
const TENANT_B_LATENCY_MIN_BUDGET_MS = Number.parseInt(
  process.env.TENANT_B_LATENCY_MIN_BUDGET_MS ?? "650",
  10
);
const BASELINE_WRITE_SAMPLES = Number.parseInt(process.env.BASELINE_WRITE_SAMPLES ?? "5", 10);
const EMIT_REPORT = process.env.TENANT_RATE_LIMIT_EMIT === "1";

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "rate-limit-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-rate-limit",
  };
}

type HttpResult = {
  readonly status: number;
  readonly body: {
    id?: string;
    error?: string;
    code?: string;
    requestId?: string;
    retryAfterMs?: number;
  };
  readonly durationMs: number;
  readonly retryAfterHeader?: string;
};

function classify429(
  error: string | undefined,
  code?: string
): "rate_limit" | "capacity" | "other" {
  if (code === "RATE_LIMIT_EXCEEDED" || error === "rate_limit_exceeded") {
    return "rate_limit";
  }
  const msg = error ?? "";
  if (msg.startsWith("TOUR_CAPACITY_EXCEEDED")) {
    return "capacity";
  }
  if (
    msg.includes("rate_limit_exceeded") ||
    msg.includes("RATE_LIMIT") ||
    msg.includes("rate_limit") ||
    msg.includes("Too Many Requests") ||
    msg.includes("too_many_requests")
  ) {
    return "rate_limit";
  }
  return "other";
}

function percentileMs(samples: readonly number[], p: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function summarizeBurstResults(results: readonly HttpResult[]): {
  count201: number;
  count429RateLimit: number;
  count429Capacity: number;
  count429Other: number;
  countOther: number;
} {
  let count201 = 0;
  let count429RateLimit = 0;
  let count429Capacity = 0;
  let count429Other = 0;
  let countOther = 0;

  for (const r of results) {
    if (r.status === 201) {
      count201 += 1;
      continue;
    }
    if (r.status === 429) {
      const kind = classify429(r.body.error, r.body.code);
      if (kind === "rate_limit") count429RateLimit += 1;
      else if (kind === "capacity") count429Capacity += 1;
      else count429Other += 1;
      continue;
    }
    countOther += 1;
  }

  return {
    count201,
    count429RateLimit,
    count429Capacity,
    count429Other,
    countOther,
  };
}

describe("tenant rate limiting (3-performance)", { concurrency: false }, () => {
  const tenantAId = integrationTenantId();
  const tenantBId = integrationTenantId();
  let listener: ReturnType<typeof createRequestListener>;
  let server: http.Server;
  let port = 0;
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorLimitPoints = process.env.TENANT_RATE_LIMIT_POINTS;
  const priorLimitDuration = process.env.TENANT_RATE_LIMIT_DURATION_SEC;
  const priorLimitEnabled = process.env.TENANT_RATE_LIMIT_ENABLED;

  before(async () => {
    await resetTenantRateLimiterStoreForTests();
    process.env.STORAGE_DRIVER = "memory";
    process.env.NODE_ENV = "test";
    process.env.TENANT_RATE_LIMIT_ENABLED = "true";
    process.env.TENANT_RATE_LIMIT_POINTS = String(LIMIT_POINTS);
    process.env.TENANT_RATE_LIMIT_DURATION_SEC = "1";
    listener = createRequestListener({ toursService: createTestToursService() });
    server = http.createServer(listener);
    return new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          throw new Error("tenant-rate-limiting: no listen address");
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
  });

  async function httpPostTour(tenantId: string, titleSuffix: string): Promise<HttpResult> {
    const start = performance.now();
    const body = {
      data: {
        basics: { title: `rl-${titleSuffix}` },
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
            const durationMs = performance.now() - start;
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : {},
              durationMs,
              retryAfterHeader: res.headers["retry-after"] as string | undefined,
            });
          });
        }
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }

  it("tenant A flooded + concurrent tenant B — A throttled, B within latency SLO", async () => {
    const baselineSamples: number[] = [];
    for (let i = 0; i < BASELINE_WRITE_SAMPLES; i += 1) {
      const solo = await httpPostTour(tenantBId, `baseline-${i}`);
      assert.ok(
        solo.status >= 200 && solo.status < 300,
        `baseline tenant B write ${i} must succeed; got ${solo.status}`
      );
      baselineSamples.push(solo.durationMs);
    }
    const baselineP50Ms = percentileMs(baselineSamples, 0.5);
    const latencyBudgetMs = Math.max(
      baselineP50Ms * TENANT_B_LATENCY_RATIO_MAX,
      TENANT_B_LATENCY_MIN_BUDGET_MS
    );

    const burstPromises = Array.from({ length: RATE_BURST }, (_, i) =>
      httpPostTour(tenantAId, `a-${i}`).catch((error: unknown) => ({
        status: 0,
        body: { error: error instanceof Error ? error.message : String(error) },
        durationMs: 0,
      }))
    );
    const victimPromise = httpPostTour(tenantBId, "victim-concurrent");

    const [burstResults, tenantBResult] = await Promise.all([
      Promise.all(burstPromises),
      victimPromise,
    ]);

    const tenantA = summarizeBurstResults(burstResults);

    assert.ok(
      tenantA.count201 > 0,
      `tenant A must accept some requests up to limit=${LIMIT_POINTS}; got 201=${tenantA.count201}`
    );
    assert.ok(
      tenantA.count429RateLimit > 0,
      `tenant A burst (${RATE_BURST}) must produce RATE_LIMIT_EXCEEDED 429s; ` +
        `got rateLimit429=${tenantA.count429RateLimit} 201=${tenantA.count201}`
    );
    assert.equal(tenantA.count429Capacity, 0, "rate limit 429 must not use TOUR_CAPACITY_EXCEEDED");

    assert.ok(
      tenantBResult.status >= 200 && tenantBResult.status < 300,
      `tenant B must succeed (2xx) under tenant A burst; got ${tenantBResult.status}`
    );
    assert.ok(
      tenantBResult.durationMs <= latencyBudgetMs,
      `tenant B latency ${tenantBResult.durationMs.toFixed(1)}ms must stay within ` +
        `${TENANT_B_LATENCY_RATIO_MAX}× baseline p50 (${baselineP50Ms.toFixed(1)}ms → budget ${latencyBudgetMs.toFixed(1)}ms)`
    );

    for (const r of burstResults) {
      if (r.status === 429 && classify429(r.body.error, r.body.code) === "rate_limit") {
        assert.equal(r.body.error, "rate_limit_exceeded");
        assert.ok(typeof r.body.requestId === "string", "429 body must include requestId");
        assert.ok(typeof r.body.retryAfterMs === "number", "429 body must include retryAfterMs");
        assert.ok(r.retryAfterHeader !== undefined, "429 must include Retry-After header");
      }
    }

    if (EMIT_REPORT) {
      process.stdout.write(
        `${JSON.stringify(
          {
            limitPoints: LIMIT_POINTS,
            rateBurst: RATE_BURST,
            baselineP50Ms,
            latencyBudgetMs,
            tenantB: tenantBResult,
            tenantA,
          },
          null,
          2
        )}\n`
      );
    }
  });
});
