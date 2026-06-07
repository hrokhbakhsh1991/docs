/**
 * Phase 3 P1 step 8 — 100-tenant rate-limiter flood probe (DEC-059 / SCAL-DEBT-14).
 *
 * 100 unique tenant IDs × 1 concurrent POST /tours each — exercises limiter + theme cache
 * without two-tenant fairness blind spot (RL-DOS-01 regression after DEC-053).
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory \
 *     TENANT_RATE_LIMIT_POINTS=100 \
 *     node --import tsx --test test/3-performance/tenant-rate-limiter-100.spec.ts
 */
import assert from "node:assert/strict";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { resetTenantRateLimiterStoreForTests } from "../../src/middleware/tenant-rate-limiter";
import {
  getAdminThemeLookupCountForTests,
  resetAdminThemeLookupCountForTests,
} from "../../src/tenant/resolve-registered-tenant";
import { resetTenantRegistryCacheForTests } from "../../src/tenant/tenant-registry-cache";
import { createTestToursService, integrationTenantId } from "../test-helpers";

const TENANT_FLOOD_COUNT = Number.parseInt(process.env.TENANT_FLOOD_COUNT ?? "100", 10);
const STORM_DEADLINE_MS = Number.parseInt(process.env.TENANT_FLOOD_DEADLINE_MS ?? "30000", 10);
const P95_BUDGET_MS = Number.parseInt(process.env.TENANT_FLOOD_P95_BUDGET_MS ?? "8000", 10);
/** Trunk / CI load can legitimately block the loop during 100-way HTTP storm; gap not tick count. */
const MAX_HEARTBEAT_GAP_MS = Number.parseInt(
  process.env.TENANT_FLOOD_MAX_HEARTBEAT_GAP_MS ?? "500",
  10
);
const HEARTBEAT_TICK_MS = 10;
const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

type HeartbeatProbe = {
  readonly stop: () => void;
  readonly maxGapMs: () => number;
};

function startHeartbeatProbe(tickMs = HEARTBEAT_TICK_MS): HeartbeatProbe {
  let lastBeat = performance.now();
  let maxGapMs = 0;
  let stopped = false;

  const timer = setInterval(() => {
    setImmediate(() => {
      if (stopped) {
        return;
      }
      const now = performance.now();
      const gap = now - lastBeat;
      if (gap > maxGapMs) {
        maxGapMs = gap;
      }
      lastBeat = now;
    });
  }, tickMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
    maxGapMs: () => maxGapMs,
  };
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "rate-flood-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-rate-flood",
  };
}

function uniqueTenantIds(count: number): string[] {
  const ids = new Set<string>();
  while (ids.size < count) {
    ids.add(integrationTenantId());
  }
  return [...ids];
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

type HttpResult = {
  readonly status: number;
  readonly durationMs: number;
  readonly body: { error?: string; code?: string };
};

describe("100-tenant rate limiter flood (DEC-059 / SCAL-DEBT-14)", { concurrency: false }, () => {
  const tenantIds = uniqueTenantIds(TENANT_FLOOD_COUNT);
  let listener: ReturnType<typeof createRequestListener>;
  let server: http.Server;
  let port = 0;

  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorLimitPoints = process.env.TENANT_RATE_LIMIT_POINTS;
  const priorLimitDuration = process.env.TENANT_RATE_LIMIT_DURATION_SEC;
  const priorLimitEnabled = process.env.TENANT_RATE_LIMIT_ENABLED;
  const priorMaxTourWrites = process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;
  const priorGlobalInflight = process.env.GLOBAL_HTTP_INFLIGHT_MAX;

  before(async () => {
    await resetTenantRateLimiterStoreForTests();
    resetTenantRegistryCacheForTests();
    resetAdminThemeLookupCountForTests();

    process.env.STORAGE_DRIVER = "memory";
    process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = String(TENANT_FLOOD_COUNT);
    process.env.GLOBAL_HTTP_INFLIGHT_MAX = String(TENANT_FLOOD_COUNT + 32);
    process.env.NODE_ENV = "test";
    process.env.TENANT_RATE_LIMIT_ENABLED = "true";
    process.env.TENANT_RATE_LIMIT_POINTS = String(
      Math.max(
        TENANT_FLOOD_COUNT,
        Number.parseInt(process.env.TENANT_RATE_LIMIT_POINTS ?? "100", 10)
      )
    );
    process.env.TENANT_RATE_LIMIT_DURATION_SEC = "1";

    listener = createRequestListener({ toursService: createTestToursService() });
    server = http.createServer(listener);
    return new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          throw new Error("tenant-rate-limiter-100: no listen address");
        }
        port = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    server.close();
    await resetTenantRateLimiterStoreForTests();
    resetTenantRegistryCacheForTests();
    resetAdminThemeLookupCountForTests();
    process.env.STORAGE_DRIVER = priorStorageDriver;
    process.env.TENANT_RATE_LIMIT_POINTS = priorLimitPoints;
    process.env.TENANT_RATE_LIMIT_DURATION_SEC = priorLimitDuration;
    process.env.TENANT_RATE_LIMIT_ENABLED = priorLimitEnabled;
    if (priorMaxTourWrites === undefined) {
      delete process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;
    } else {
      process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = priorMaxTourWrites;
    }
    if (priorGlobalInflight === undefined) {
      delete process.env.GLOBAL_HTTP_INFLIGHT_MAX;
    } else {
      process.env.GLOBAL_HTTP_INFLIGHT_MAX = priorGlobalInflight;
    }
  });

  async function httpPostTour(tenantId: string, index: number): Promise<HttpResult> {
    const payload = JSON.stringify({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: `flood-${index}` },
        details: { summary: "probe" },
      },
    });
    const started = performance.now();

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
            let body: HttpResult["body"] = {};
            if (raw.length > 0) {
              try {
                body = JSON.parse(raw) as HttpResult["body"];
              } catch {
                body = { error: "invalid_json" };
              }
            }
            resolve({
              status: res.statusCode ?? 0,
              durationMs: performance.now() - started,
              body,
            });
          });
        }
      );
      req.on("error", reject);
      req.setTimeout(STORM_DEADLINE_MS + 5_000, () => {
        req.destroy(new Error("client_timeout"));
      });
      req.write(payload);
      req.end();
    });
  }

  it("completes 100-tenant concurrent storm without hang or admin amplification", async () => {
    const heartbeat = startHeartbeatProbe();

    const stormStart = performance.now();
    const results = await Promise.all(
      tenantIds.map((tenantId, index) => httpPostTour(tenantId, index))
    );
    const stormDurationMs = performance.now() - stormStart;
    heartbeat.stop();
    const maxHeartbeatGapMs = heartbeat.maxGapMs();

    const count201 = results.filter((r) => r.status === 201).length;
    const count429 = results.filter((r) => r.status === 429).length;
    const count500 = results.filter((r) => r.status === 500).length;
    const countOther = results.length - count201 - count429 - count500;
    const p95Ms = percentile(
      results.map((r) => r.durationMs),
      95
    );

    const adminLookupsAfterFirstWave = getAdminThemeLookupCountForTests();

    assert.ok(
      maxHeartbeatGapMs <= MAX_HEARTBEAT_GAP_MS,
      `event loop stalled — max heartbeat gap=${maxHeartbeatGapMs.toFixed(1)}ms > ${MAX_HEARTBEAT_GAP_MS}ms (storm=${stormDurationMs.toFixed(1)}ms)`
    );
    assert.ok(
      stormDurationMs <= STORM_DEADLINE_MS,
      `storm exceeded deadline: ${stormDurationMs.toFixed(1)}ms > ${STORM_DEADLINE_MS}ms`
    );
    assert.ok(
      p95Ms <= P95_BUDGET_MS,
      `p95 ${p95Ms.toFixed(1)}ms exceeds budget ${P95_BUDGET_MS}ms`
    );
    assert.equal(count500, 0, `unexpected 500 during flood (other=${countOther})`);
    assert.equal(countOther, 0, `unexpected HTTP statuses during flood`);
    assert.equal(
      count201,
      TENANT_FLOOD_COUNT,
      `expected ${TENANT_FLOOD_COUNT}×201; got 201=${count201} 429=${count429}`
    );

    if (hasDatabase) {
      assert.ok(
        adminLookupsAfterFirstWave <= TENANT_FLOOD_COUNT,
        `admin theme lookups must not exceed unique tenant count — got ${adminLookupsAfterFirstWave}`
      );
    }

    const lookupsBeforeSecondWave = getAdminThemeLookupCountForTests();
    await Promise.all(tenantIds.map((tenantId, index) => httpPostTour(tenantId, index + 1000)));
    assert.equal(
      getAdminThemeLookupCountForTests(),
      lookupsBeforeSecondWave,
      "second wave must not trigger additional admin theme lookups (cache hit / negative cache)"
    );
  });
});
