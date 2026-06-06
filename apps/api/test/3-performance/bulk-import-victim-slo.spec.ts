/**
 * Phase 3 step 18 — victim SLO: bulk import ∥ B login/read (DEC-069 / SCAL-DEBT-13).
 *
 * Tenant A: concurrent POST /tours (bulk-import shape).
 * Tenant B: GET /health, GET /api/v2/tenant-config, GET /tours/:id under A storm.
 *
 * Run:
 *   NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/3-performance/bulk-import-victim-slo.spec.ts
 */
import assert from "node:assert/strict";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { resetTenantRateLimiterStoreForTests } from "../../src/middleware/tenant-rate-limiter";
import { resetTenantRegistryCacheForTests } from "../../src/tenant/tenant-registry-cache";
import { createTestToursService } from "../test-helpers";

/** RuleContext-safe slugs for POST/GET /tours (platform-core rejects UUID-leading-digit ids). */
const TENANT_A_ID = "tenant-a";
const TENANT_B_TOUR_ID = "tenant-b";
/** Static registry id for GET /api/v2/tenant-config (must match DEV_TENANTS + host label). */
const TENANT_B_REGISTRY_ID = "00000000-0000-4000-8000-000000000002";
function tenantBConfigHost(port: number): string {
  return `tenant-b.localhost:${port}`;
}

const BULK_IMPORT_PARALLEL = Number.parseInt(process.env.BULK_IMPORT_PARALLEL ?? "12", 10);
const VICTIM_BASELINE_SAMPLES = Number.parseInt(process.env.VICTIM_BASELINE_SAMPLES ?? "5", 10);
const VICTIM_SLO_RATIO = Number.parseFloat(process.env.VICTIM_SLO_RATIO ?? "4");
const VICTIM_SLO_MIN_BUDGET_MS = Number.parseInt(process.env.VICTIM_SLO_MIN_BUDGET_MS ?? "500", 10);

const VALID_TOUR_BODY = {
  data: { basics: { title: "bulk-import-a" }, details: { summary: "import" } },
};

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "victim-slo-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-victim-slo",
  };
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
};

describe("bulk import victim SLO (DEC-069 / SCAL-DEBT-13)", { concurrency: false }, () => {
  let listener: ReturnType<typeof createRequestListener>;
  let server: http.Server;
  let port = 0;
  let victimTourId = "";

  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;
  const priorLimitPoints = process.env.TENANT_RATE_LIMIT_POINTS;
  const priorLimitEnabled = process.env.TENANT_RATE_LIMIT_ENABLED;
  const priorWorkers = process.env.P5_VALIDATION_WORKERS_ENABLED;

  before(async () => {
    await resetTenantRateLimiterStoreForTests();
    resetTenantRegistryCacheForTests();

    delete process.env.DATABASE_URL;
    process.env.STORAGE_DRIVER = "memory";
    process.env.NODE_ENV = "test";
    process.env.TENANT_RATE_LIMIT_ENABLED = "true";
    process.env.TENANT_RATE_LIMIT_POINTS = "1000";
    process.env.TENANT_RATE_LIMIT_DURATION_SEC = "1";
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";

    listener = createRequestListener({ toursService: createTestToursService() });
    server = http.createServer(listener);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          throw new Error("bulk-import-victim-slo: no listen address");
        }
        port = addr.port;
        resolve();
      });
    });

    const seed = await httpRequest({
      method: "POST",
      path: "/tours",
      tenantId: TENANT_B_TOUR_ID,
      body: {
        data: { basics: { title: "victim-seed-tour" }, details: { summary: "seed" } },
      },
    });
    assert.equal(seed.status, 201, "victim seed tour must be created");
    const seedBody = JSON.parse(seed.rawBody) as { id?: string };
    victimTourId = seedBody.id ?? "";
    assert.ok(victimTourId.length > 0, "seed tour id required");
  });

  after(async () => {
    server.close();
    await resetTenantRateLimiterStoreForTests();
    resetTenantRegistryCacheForTests();
    process.env.STORAGE_DRIVER = priorStorageDriver;
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
    process.env.TENANT_RATE_LIMIT_POINTS = priorLimitPoints;
    process.env.TENANT_RATE_LIMIT_ENABLED = priorLimitEnabled;
    process.env.P5_VALIDATION_WORKERS_ENABLED = priorWorkers;
  });

  async function httpRequest(options: {
    readonly method: "GET" | "POST";
    readonly path: string;
    readonly tenantId?: string;
    readonly host?: string;
    readonly body?: unknown;
  }): Promise<HttpResult & { readonly rawBody: string }> {
    const start = performance.now();
    const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: options.path,
          method: options.method,
          headers: {
            ...(options.host ? { host: options.host } : {}),
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
            ...(options.tenantId ? authHeaders(options.tenantId) : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            resolve({
              status: res.statusCode ?? 0,
              durationMs: performance.now() - start,
              rawBody: Buffer.concat(chunks).toString("utf8"),
            });
          });
        }
      );
      req.on("error", reject);
      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  async function victimProbeRound(): Promise<{
    readonly healthMs: number;
    readonly configMs: number;
    readonly tourMs: number;
    readonly healthStatus: number;
    readonly configStatus: number;
    readonly tourStatus: number;
  }> {
    const health = await httpRequest({ method: "GET", path: "/health" });
    const config = await httpRequest({
      method: "GET",
      path: "/api/v2/tenant-config",
      tenantId: TENANT_B_REGISTRY_ID,
      host: tenantBConfigHost(port),
    });
    const tour = await httpRequest({
      method: "GET",
      path: `/tours/${victimTourId}`,
      tenantId: TENANT_B_TOUR_ID,
    });
    return {
      healthMs: health.durationMs,
      configMs: config.durationMs,
      tourMs: tour.durationMs,
      healthStatus: health.status,
      configStatus: config.status,
      tourStatus: tour.status,
    };
  }

  it("tenant B login/read paths stay within SLO while tenant A bulk-imports", async () => {
    const baselineHealth: number[] = [];
    const baselineConfig: number[] = [];
    const baselineTour: number[] = [];

    for (let i = 0; i < VICTIM_BASELINE_SAMPLES; i += 1) {
      const round = await victimProbeRound();
      assert.equal(round.healthStatus, 200, `baseline health ${i}`);
      assert.equal(round.configStatus, 200, `baseline tenant-config ${i}`);
      assert.equal(round.tourStatus, 200, `baseline tour GET ${i}`);
      baselineHealth.push(round.healthMs);
      baselineConfig.push(round.configMs);
      baselineTour.push(round.tourMs);
    }

    const healthCeiling = Math.max(
      VICTIM_SLO_MIN_BUDGET_MS,
      percentile(baselineHealth, 50) * VICTIM_SLO_RATIO
    );
    const configCeiling = Math.max(
      VICTIM_SLO_MIN_BUDGET_MS,
      percentile(baselineConfig, 50) * VICTIM_SLO_RATIO
    );
    const tourCeiling = Math.max(
      VICTIM_SLO_MIN_BUDGET_MS,
      percentile(baselineTour, 50) * VICTIM_SLO_RATIO
    );

    const bulkPromise = Promise.all(
      Array.from({ length: BULK_IMPORT_PARALLEL }, (_, index) =>
        httpRequest({
          method: "POST",
          path: "/tours",
          tenantId: TENANT_A_ID,
          body: {
            ...VALID_TOUR_BODY,
            data: {
              basics: { title: `bulk-a-${index}` },
              details: { summary: "storm" },
            },
          },
        })
      )
    );

    await new Promise<void>((resolve) => setImmediate(resolve));

    const victimUnderNoise = await victimProbeRound();
    const bulkResults = await bulkPromise;

    const bulkAccepted = bulkResults.filter((r) => r.status === 201).length;
    assert.ok(bulkAccepted >= 1, "tenant A bulk import must complete at least one create");

    assert.equal(
      victimUnderNoise.healthStatus,
      200,
      "victim health must stay 200 under bulk import"
    );
    assert.equal(
      victimUnderNoise.configStatus,
      200,
      "victim tenant-config must stay 200 under bulk import"
    );
    assert.equal(
      victimUnderNoise.tourStatus,
      200,
      "victim tour GET must stay 200 under bulk import"
    );

    assert.ok(
      victimUnderNoise.healthMs <= healthCeiling,
      `health p99 budget exceeded: ${victimUnderNoise.healthMs}ms > ${healthCeiling}ms`
    );
    assert.ok(
      victimUnderNoise.configMs <= configCeiling,
      `tenant-config budget exceeded: ${victimUnderNoise.configMs}ms > ${configCeiling}ms`
    );
    assert.ok(
      victimUnderNoise.tourMs <= tourCeiling,
      `tour GET budget exceeded: ${victimUnderNoise.tourMs}ms > ${tourCeiling}ms`
    );
  });
});
