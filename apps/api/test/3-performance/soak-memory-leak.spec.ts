/**
 * 3-performance — sustained-load soak probe for tenant-context / rule-engine heap leaks.
 *
 * Fires SOAK_RPS requests/sec for SOAK_DURATION_SEC while sampling `heapUsed` every
 * SOAK_SAMPLE_INTERVAL_SEC (with `forceGcIfAvailable` between samples). After warmup,
 * linear regression on post-GC samples must not show monotonic growth — unbounded slope
 * after GC indicates a leak in AsyncLocalStorage tenant bindings or PlatformWizardEngine
 * rule-cache retention.
 *
 * Practical CI constraints:
 *   - Full spec: 50 rps × 900 s = 45k requests (~15 min) — too long for default CI.
 *   - Skipped unless RUN_SOAK=1.
 *   - SOAK_DURATION_SEC defaults to 60 (CI smoke); SOAK_MIN_DURATION_SEC=900 for full soak.
 *
 * Env tunables:
 *   RUN_SOAK                  — set "1" to execute (otherwise describe is skipped)
 *   SOAK_DURATION_SEC         — load duration seconds (default 60; use 900 for full soak)
 *   SOAK_MIN_DURATION_SEC     — full-soak target when SOAK_FULL=1 (default 900)
 *   SOAK_FULL                 — set "1" to use SOAK_MIN_DURATION_SEC when DURATION unset
 *   SOAK_RPS                  — sustained request rate (default 50)
 *   SOAK_SAMPLE_INTERVAL_SEC  — heap sample cadence (default 5)
 *   SOAK_WARMUP_SEC           — regression warmup exclusion (default min(30, 25% duration))
 *   SOAK_HEAP_SLOPE_MAX_MB_PER_SEC — fail when |slope| exceeds this post-warmup (default 0.03)
 *   SOAK_STABILIZE_RANGE_MB   — last-K sample peak-trough ≤ this ⇒ stabilized (default 8)
 *   SOAK_TENANT_ROTATE        — "0" = single tenant; default rotates tenant pool
 *   SOAK_TENANT_POOL          — distinct tenants when rotating (default 8)
 *   SOAK_MODE                 — `http` (POST /tours, default) or `validation` (plugin loop)
 *   SOAK_MAX_INFLIGHT         — cap concurrent in-flight work (default rps × 4)
 *   STORAGE_DRIVER            — `memory` (default) or `prisma` (requires DATABASE_URL)
 *   SOAK_MEMORY_EMIT          — set "1" to log JSON report to stdout
 *
 * Run — CI smoke (60 s, memory, no Postgres):
 *   cd apps/api && pnpm run test:soak
 *
 * Run — full 15 min soak (requires --expose-gc for reliable GC sampling):
 *   cd apps/api && RUN_SOAK=1 SOAK_DURATION_SEC=900 SOAK_RPS=50 \
 *     node --expose-gc --import tsx --test --test-concurrency=1 \
 *     test/3-performance/soak-memory-leak.spec.ts
 *
 * Run — Postgres integration soak:
 *   cd apps/api && RUN_SOAK=1 STORAGE_DRIVER=prisma DATABASE_URL=... \
 *     node --expose-gc --import tsx --test --test-concurrency=1 \
 *     test/3-performance/soak-memory-leak.spec.ts
 *
 * @see apps/api/test/chaos/outbox-relay-memory.spec.ts — relay-path heap sampling
 * @see apps/api/test/security-isolation-stress.spec.ts — concurrent tenant ALS patterns
 * @see apps/api/test/3-performance/noisy-neighbor-latency.spec.ts — validation load shape
 * @see packages/platform-core/test/3-performance/rule-cache-eviction.spec.ts — rule-cache bounds
 */
import assert from "node:assert/strict";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import {
  validateCanonicalBeforePersist,
  type ValidateBeforePersistInput,
} from "../../src/tours/canonical-validation";
import { ToursService } from "../../src/tours/tours.service";
import { createTestToursService, integrationTenantId } from "../test-helpers";

const RUN_SOAK = process.env.RUN_SOAK === "1";

function resolveDurationSec(): number {
  const explicit = process.env.SOAK_DURATION_SEC?.trim();
  if (explicit) {
    const parsed = Number.parseInt(explicit, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  if (process.env.SOAK_FULL === "1") {
    return Number.parseInt(process.env.SOAK_MIN_DURATION_SEC ?? "900", 10);
  }
  return 60;
}

const SOAK_DURATION_SEC = resolveDurationSec();
const SOAK_RPS = Number.parseInt(process.env.SOAK_RPS ?? "50", 10);
const SOAK_SAMPLE_INTERVAL_SEC = Number.parseInt(process.env.SOAK_SAMPLE_INTERVAL_SEC ?? "5", 10);
const SOAK_WARMUP_SEC = Number.parseInt(
  process.env.SOAK_WARMUP_SEC ?? String(Math.min(30, Math.floor(SOAK_DURATION_SEC * 0.25))),
  10
);
const SOAK_HEAP_SLOPE_MAX_MB_PER_SEC = Number.parseFloat(
  process.env.SOAK_HEAP_SLOPE_MAX_MB_PER_SEC ?? "0.03"
);
const SOAK_STABILIZE_RANGE_MB = Number.parseFloat(process.env.SOAK_STABILIZE_RANGE_MB ?? "8");
const SOAK_TENANT_ROTATE = process.env.SOAK_TENANT_ROTATE !== "0";
const SOAK_TENANT_POOL = Number.parseInt(process.env.SOAK_TENANT_POOL ?? "8", 10);
const SOAK_MODE = (process.env.SOAK_MODE?.trim().toLowerCase() ?? "http") as "http" | "validation";
const SOAK_MAX_INFLIGHT = Number.parseInt(
  process.env.SOAK_MAX_INFLIGHT ?? String(SOAK_RPS * 4),
  10
);

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const requestedDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase();
const usePostgres = requestedDriver === "prisma" || (requestedDriver !== "memory" && hasDatabase);

const SUITE_TIMEOUT_MS = SOAK_DURATION_SEC * 1000 + 180_000;

const VALID_TOUR_BODY = {
  data: { basics: { title: "soak-tour" }, details: { summary: "ok" } },
} as const;

export type HeapSample = {
  readonly elapsedSec: number;
  readonly heapMb: number;
};

export type SoakMemoryReport = {
  readonly verdict: "stabilized" | "leak_flagged";
  readonly storageDriver: "memory" | "prisma";
  readonly mode: "http" | "validation";
  readonly durationSec: number;
  readonly rps: number;
  readonly requestCount: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly startHeapMb: number;
  readonly endHeapMb: number;
  readonly heapSlopeMbPerSec: number;
  readonly heapSlopeMaxMbPerSec: number;
  readonly regressionR2: number;
  readonly warmupSec: number;
  readonly sampleCount: number;
  readonly stabilized: boolean;
  readonly tenantRotate: boolean;
  readonly tenantPoolSize: number;
  readonly samples: readonly HeapSample[];
  readonly sreNote: string;
};

function sampleHeapMb(): number {
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

function forceGcIfAvailable(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  gc?.();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function linearRegression(
  xs: readonly number[],
  ys: readonly number[]
): { slope: number; intercept: number; r2: number } {
  const n = xs.length;
  if (n < 2) {
    return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  }
  const sumX = xs.reduce((acc, x) => acc + x, 0);
  const sumY = ys.reduce((acc, y) => acc + y, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i]!, 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  const ssTot = ys.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((acc, y, i) => acc + (y - (slope * xs[i]! + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "soak-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-soak",
  };
}

function authForTenant(tenantId: string): TenantAuthContext {
  return {
    userId: "soak-user",
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-soak",
  };
}

function validationInput(tenantId: string, index: number): ValidateBeforePersistInput {
  return {
    body: {
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: `soak-${index}-${randomUUID().slice(0, 8)}` },
        details: { summary: `payload-${index % 17}` },
      },
    },
    tenantId,
    workspaceType: "starter",
  };
}

function isStabilized(samples: readonly HeapSample[], rangeMb: number): boolean {
  if (samples.length < 3) {
    return true;
  }
  const tail = samples.slice(-5);
  const heaps = tail.map((s) => s.heapMb);
  const spread = Math.max(...heaps) - Math.min(...heaps);
  return spread <= rangeMb;
}

function leakMessage(report: SoakMemoryReport): string {
  return [
    "SOAK_MEMORY_LEAK: heap grows linearly without stabilizing after GC",
    `  mode=${report.mode} driver=${report.storageDriver}`,
    `  duration=${report.durationSec}s rps=${report.rps} requests=${report.requestCount} ok=${report.successCount} err=${report.errorCount}`,
    `  start_heap=${report.startHeapMb.toFixed(2)}MB end_heap=${report.endHeapMb.toFixed(2)}MB`,
    `  slope=${report.heapSlopeMbPerSec.toFixed(4)}MB/s (max=${report.heapSlopeMaxMbPerSec}MB/s) r2=${report.regressionR2.toFixed(3)}`,
    `  warmup=${report.warmupSec}s samples=${report.sampleCount} stabilized=${report.stabilized}`,
    `  tenant_rotate=${report.tenantRotate} pool=${report.tenantPoolSize}`,
    "  hypothesis: AsyncLocalStorage tenant context or PlatformWizardEngine rule-cache retention",
    "  remediation: audit runWithTenantContext teardown, rule-engine outer tenant map caps",
  ].join("\n");
}

describe(
  "soak memory leak (3-performance)",
  {
    skip: !RUN_SOAK
      ? "set RUN_SOAK=1 to run soak memory leak probe (see test file header for CI vs full soak)"
      : usePostgres && !hasDatabase
        ? "DATABASE_URL required when STORAGE_DRIVER=prisma"
        : false,
    concurrency: false,
    timeout: SUITE_TIMEOUT_MS,
  },
  () => {
    const runId = randomUUID().slice(0, 8);
    const tenantIds: string[] = [];
    let toursService: ToursService;
    let listener: ReturnType<typeof createRequestListener> | undefined;
    let server: http.Server | undefined;
    let port = 0;
    let admin: PrismaClient | undefined;
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    let lastReport: SoakMemoryReport | undefined;

    before(async () => {
      for (let i = 0; i < SOAK_TENANT_POOL; i += 1) {
        tenantIds.push(integrationTenantId());
      }

      if (usePostgres) {
        process.env.STORAGE_DRIVER = "prisma";
        await disconnectPrisma();
        admin = getPrismaAdmin();
        for (let i = 0; i < tenantIds.length; i += 1) {
          await admin.tenant.create({
            data: {
              id: tenantIds[i]!,
              subdomain: `soak-${runId}-${i}`,
              workspaceType: "starter",
              theme: {},
            },
          });
        }
        toursService = new ToursService(
          new CanonicalTourService(
            new TourStorageDbAdapter(createTourStorageRepository()),
            new LegacyCanonicalAdapter()
          )
        );
      } else {
        process.env.STORAGE_DRIVER = "memory";
        toursService = createTestToursService();
      }

      if (SOAK_MODE === "http") {
        listener = createRequestListener({ toursService });
        server = http.createServer(listener);
        await new Promise<void>((resolve) => server!.listen(0, resolve));
        const addr = server!.address();
        if (!addr || typeof addr === "string") {
          throw new Error("soak-memory-leak: no listen address");
        }
        port = addr.port;
      }
    });

    after(async () => {
      server?.close();
      if (priorStorageDriver === undefined) {
        delete process.env.STORAGE_DRIVER;
      } else {
        process.env.STORAGE_DRIVER = priorStorageDriver;
      }

      if (admin) {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
        );
        try {
          for (const tenantId of tenantIds) {
            await admin.auditEvent.deleteMany({ where: { tenantId } });
            await admin.outboxEvent.deleteMany({ where: { tenantId } });
            await admin.tour.deleteMany({ where: { tenantId } });
            await admin.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
          }
        } finally {
          await admin.$executeRawUnsafe(
            `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
          );
        }
        await disconnectPrisma();
      }
    });

    function pickTenant(requestIndex: number): string {
      if (!SOAK_TENANT_ROTATE || tenantIds.length <= 1) {
        return tenantIds[0]!;
      }
      return tenantIds[requestIndex % tenantIds.length]!;
    }

    async function postTourHttp(tenantId: string, index: number): Promise<void> {
      if (!server || port === 0) {
        throw new Error("soak-memory-leak: HTTP server not started");
      }
      const body = {
        ...VALID_TOUR_BODY,
        data: {
          basics: { title: `soak-${runId}-${index}` },
          details: { summary: "write" },
        },
      };
      const payload = JSON.stringify(body);

      await new Promise<void>((resolve, reject) => {
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
              const status = res.statusCode ?? 0;
              if (status >= 200 && status < 300) {
                resolve();
                return;
              }
              reject(new Error(`POST /tours status=${status}`));
            });
          }
        );
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
    }

    async function runValidationTask(tenantId: string, index: number): Promise<void> {
      await validateCanonicalBeforePersist(validationInput(tenantId, index));
    }

    async function dispatchWork(tenantId: string, index: number): Promise<void> {
      if (SOAK_MODE === "validation") {
        await Promise.resolve().then(() => runValidationTask(tenantId, index));
        return;
      }
      await postTourHttp(tenantId, index);
    }

    async function runSustainedLoad(): Promise<SoakMemoryReport> {
      const samples: HeapSample[] = [];
      const loadStart = performance.now();
      const loadEndMs = loadStart + SOAK_DURATION_SEC * 1000;
      const intervalMs = Math.max(1, 1000 / SOAK_RPS);

      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;
      let inFlight = 0;

      forceGcIfAvailable();
      const startHeapMb = sampleHeapMb();
      samples.push({ elapsedSec: 0, heapMb: startHeapMb });

      const sampleTimer = setInterval(() => {
        forceGcIfAvailable();
        samples.push({
          elapsedSec: (performance.now() - loadStart) / 1000,
          heapMb: sampleHeapMb(),
        });
      }, SOAK_SAMPLE_INTERVAL_SEC * 1000);

      while (performance.now() < loadEndMs) {
        while (inFlight >= SOAK_MAX_INFLIGHT) {
          await sleep(5);
        }

        const tenantId = pickTenant(requestCount);
        const index = requestCount;
        requestCount += 1;
        inFlight += 1;

        void dispatchWork(tenantId, index)
          .then(() => {
            successCount += 1;
          })
          .catch(() => {
            errorCount += 1;
          })
          .finally(() => {
            inFlight -= 1;
          });

        await sleep(intervalMs);
      }

      const drainDeadline = performance.now() + 30_000;
      while (inFlight > 0 && performance.now() < drainDeadline) {
        await sleep(25);
      }

      clearInterval(sampleTimer);
      forceGcIfAvailable();
      const endHeapMb = sampleHeapMb();
      samples.push({
        elapsedSec: (performance.now() - loadStart) / 1000,
        heapMb: endHeapMb,
      });

      const regressionSamples = samples.filter((s) => s.elapsedSec >= SOAK_WARMUP_SEC);
      const xs = regressionSamples.map((s) => s.elapsedSec);
      const ys = regressionSamples.map((s) => s.heapMb);
      const { slope, r2 } = linearRegression(xs, ys);
      const stabilized = isStabilized(regressionSamples, SOAK_STABILIZE_RANGE_MB);
      const slopeExceeds = Math.abs(slope) > SOAK_HEAP_SLOPE_MAX_MB_PER_SEC;
      const leakFlagged = slopeExceeds && !stabilized;

      const verdict: SoakMemoryReport["verdict"] = leakFlagged ? "leak_flagged" : "stabilized";

      return {
        verdict,
        storageDriver: usePostgres ? "prisma" : "memory",
        mode: SOAK_MODE,
        durationSec: SOAK_DURATION_SEC,
        rps: SOAK_RPS,
        requestCount,
        successCount,
        errorCount,
        startHeapMb: Math.round(startHeapMb * 100) / 100,
        endHeapMb: Math.round(endHeapMb * 100) / 100,
        heapSlopeMbPerSec: Math.round(slope * 10_000) / 10_000,
        heapSlopeMaxMbPerSec: SOAK_HEAP_SLOPE_MAX_MB_PER_SEC,
        regressionR2: Math.round(r2 * 1000) / 1000,
        warmupSec: SOAK_WARMUP_SEC,
        sampleCount: samples.length,
        stabilized,
        tenantRotate: SOAK_TENANT_ROTATE,
        tenantPoolSize: tenantIds.length,
        samples,
        sreNote: leakFlagged
          ? "Heap slope post-warmup exceeds threshold without stabilization — investigate tenant context / rule cache"
          : "Heap post-GC stabilized or slope within threshold under sustained load",
      };
    }

    it("SOAK-MEMORY: sustained load must not leak heap (tenant context / rule engine)", async () => {
      lastReport = await runSustainedLoad();

      process.env.SOAK_MEMORY_REPORT = JSON.stringify(lastReport);

      const summary = [
        `SOAK_MEMORY verdict=${lastReport.verdict} mode=${lastReport.mode} driver=${lastReport.storageDriver}`,
        `  duration=${lastReport.durationSec}s rps=${lastReport.rps} requests=${lastReport.requestCount} ok=${lastReport.successCount} err=${lastReport.errorCount}`,
        `  heap start=${lastReport.startHeapMb}MB end=${lastReport.endHeapMb}MB slope=${lastReport.heapSlopeMbPerSec}MB/s (max=${lastReport.heapSlopeMaxMbPerSec})`,
        `  warmup=${lastReport.warmupSec}s samples=${lastReport.sampleCount} stabilized=${lastReport.stabilized} r2=${lastReport.regressionR2}`,
        `  tenant_rotate=${lastReport.tenantRotate} pool=${lastReport.tenantPoolSize}`,
      ].join("\n");
      console.info(summary);

      if (process.env.SOAK_MEMORY_EMIT === "1") {
        console.log(`SOAK_MEMORY_JSON ${JSON.stringify(lastReport)}`);
      }

      assert.ok(lastReport.successCount > 0, "soak must complete at least one successful request");

      const errorRatio =
        lastReport.requestCount > 0 ? lastReport.errorCount / lastReport.requestCount : 0;
      assert.ok(
        errorRatio <= 0.05,
        `soak error rate ${(errorRatio * 100).toFixed(2)}% exceeds 5% (${lastReport.errorCount}/${lastReport.requestCount})`
      );

      if (lastReport.verdict === "leak_flagged") {
        assert.fail(leakMessage(lastReport));
      }
    });

    it("exposes SOAK_MEMORY_REPORT for SRE audit", () => {
      assert.ok(lastReport, "SOAK_MEMORY_REPORT must be set by prior test");
      assert.ok(
        lastReport.verdict === "stabilized" || lastReport.verdict === "leak_flagged",
        "verdict must be stabilized or leak_flagged"
      );

      const sreVerdict =
        lastReport.verdict === "stabilized"
          ? `SOAK_SRE_VERDICT pass slope=${lastReport.heapSlopeMbPerSec}MB/s start=${lastReport.startHeapMb}MB end=${lastReport.endHeapMb}MB stabilized=${lastReport.stabilized}`
          : `SOAK_SRE_VERDICT leak_flagged slope=${lastReport.heapSlopeMbPerSec}MB/s start=${lastReport.startHeapMb}MB end=${lastReport.endHeapMb}MB — audit tenant ALS + rule cache`;

      console.info(sreVerdict);
    });
  }
);
