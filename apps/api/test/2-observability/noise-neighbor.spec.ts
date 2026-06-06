/**
 * 2-observability — noisy-neighbor resource fairness probe.
 *
 * Scenario:
 *   - Tenant A: 500 fast read operations (GET /tours/:id) — noise
 *   - Tenant B: 1 slow write (POST /tours) — victim, concurrent with noise
 *
 * If Tenant A read volume pushes Tenant B write latency beyond
 * `baseline × RATIO_THRESHOLD` (default 4 = 300% over measured SLO), the test
 * FAILs — signaling a lack of per-tenant resource throttling / noisy-neighbor
 * controls. Data isolation may remain intact; this probes latency fairness only.
 *
 * Requires Postgres (`DATABASE_URL`) for realistic connection-pool / RLS contention.
 * In-memory storage would not exercise DB throttling — skipped without DATABASE_URL.
 *
 * Env tunables:
 *   NOISE_READ_COUNT     — parallel GET burst on tenant A (default 500)
 *   SLO_BASELINE_MS      — optional fixed baseline; otherwise measured from B-only writes
 *   RATIO_THRESHOLD      — fail when under-noise write exceeds baseline × this (default 4)
 *   BASELINE_WRITE_SAMPLES — solo B writes before probe (default 10)
 *   NOISE_NEIGHBOR_EMIT  — set "1" to log JSON report to stdout
 *
 * @see apps/api/test/security/tenant-kernel-load-rls.spec.ts — p95 ratio patterns
 * @see docs/phase-5/audits/TENANT-KERNEL-LOAD-REPORT.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";
import { skipUnlessNightlyTier } from "../test-tier";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const NOISE_READ_COUNT = Number(process.env.NOISE_READ_COUNT ?? "500");
const RATIO_THRESHOLD = Number(process.env.RATIO_THRESHOLD ?? "4");
const BASELINE_WRITE_SAMPLES = Number(process.env.BASELINE_WRITE_SAMPLES ?? "10");
const SLO_BASELINE_MS_OVERRIDE = process.env.SLO_BASELINE_MS?.trim()
  ? Number(process.env.SLO_BASELINE_MS)
  : undefined;

const VALID_TOUR_BODY = {
  data: { basics: { title: "noise-neighbor" }, details: { summary: "ok" } },
};

export type NoiseNeighborReport = {
  readonly verdict: "pass" | "throttling_gap";
  readonly baselineMs: number;
  readonly baselineSource: "measured" | "env_override";
  readonly underNoiseWriteMs: number;
  readonly ratio: number;
  readonly ratioThreshold: number;
  readonly noiseReadCount: number;
  readonly noiseReadsOk: number;
  readonly noiseReadsRateLimited?: number;
  readonly noiseReadsFailed: number;
  readonly writeStatus: number;
  readonly writeSucceeded: boolean;
};

function withConnectionLimit(url: string, limit = 64): string {
  if (/connection_limit=/i.test(url)) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=${limit}`;
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "noise-neighbor-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-noise",
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

type HttpResult = {
  readonly status: number;
  readonly body: { id?: string; tenantId?: string; error?: string };
  readonly durationMs: number;
};

describe(
  "noisy-neighbor observability (2-observability)",
  {
    skip: !hasDatabase
      ? "requires DATABASE_URL"
      : skipUnlessNightlyTier("noise-neighbor HTTP fairness probe"),
    concurrency: false,
  },
  () => {
    const runId = randomUUID().slice(0, 8);
    let tenantAId: string;
    let tenantBId: string;
    let seedTourId: string;
    const createdTourIds: string[] = [];
    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    let server: http.Server;
    let port = 0;
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    let lastReport: NoiseNeighborReport | undefined;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const appUrl = withConnectionLimit(process.env.DATABASE_URL?.trim() ?? APP_TOUR_URL);
      process.env.DATABASE_URL = appUrl;
      process.env.TENANT_RATE_LIMIT_READ_POINTS = process.env.TENANT_RATE_LIMIT_READ_POINTS ?? "2";
      await disconnectPrisma();
      admin = getPrismaAdmin();

      tenantAId = integrationTenantId();
      tenantBId = integrationTenantId();

      await admin.tenant.create({
        data: {
          id: tenantAId,
          subdomain: `noise-a-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });
      await admin.tenant.create({
        data: {
          id: tenantBId,
          subdomain: `noise-b-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      const seed = await admin.tour.create({
        data: {
          tenantId: tenantAId,
          title: `noise-a-seed-${runId}`,
          canonical: {
            schemaVersion: 1,
            roots: ["basics"],
            data: {
              basics: { title: `noise-a-seed-${runId}` },
              details: { summary: "seed" },
            },
          },
        },
      });
      seedTourId = seed.id;

      const toursService = new ToursService(
        new CanonicalTourService(
          new TourStorageDbAdapter(createTourStorageRepository()),
          new LegacyCanonicalAdapter()
        )
      );
      listener = createRequestListener({ toursService });
      server = http.createServer(listener);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        throw new Error("noise-neighbor: no listen address");
      }
      port = addr.port;
    });

    after(async () => {
      server.close();
      process.env.STORAGE_DRIVER = priorStorageDriver;
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        for (const tenantId of [tenantAId, tenantBId]) {
          await admin.auditEvent.deleteMany({ where: { tenantId } });
          await admin.outboxEvent.deleteMany({ where: { tenantId } });
          await admin.tour.deleteMany({ where: { tenantId } });
          await admin.tenant.delete({ where: { id: tenantId } });
        }
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await disconnectPrisma();
    });

    async function httpRequest(options: {
      readonly method: "GET" | "POST";
      readonly path: string;
      readonly tenantId: string;
      readonly body?: unknown;
    }): Promise<HttpResult> {
      const start = performance.now();
      return new Promise((resolve, reject) => {
        const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: options.path,
            method: options.method,
            headers: {
              "Content-Type": "application/json",
              ...(payload ? { "Content-Length": String(Buffer.byteLength(payload)) } : {}),
              ...authHeaders(options.tenantId),
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
              });
            });
          }
        );
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
      });
    }

    async function postTourB(suffix: string): Promise<HttpResult> {
      return httpRequest({
        method: "POST",
        path: "/tours",
        tenantId: tenantBId,
        body: {
          ...VALID_TOUR_BODY,
          data: {
            basics: { title: `noise-b-${runId}-${suffix}` },
            details: { summary: "write" },
          },
        },
      });
    }

    it("NOISE-NEIGHBOR: 500 tenant-A reads must not push tenant-B write beyond SLO × 4", async () => {
      const baselineSamples: number[] = [];
      for (let i = 0; i < BASELINE_WRITE_SAMPLES; i += 1) {
        const res = await postTourB(`baseline-${i}`);
        assert.equal(res.status, 201, `baseline write ${i} must succeed`);
        if (res.body.id) {
          createdTourIds.push(res.body.id);
        }
        baselineSamples.push(res.durationMs);
      }

      const baselineSorted = [...baselineSamples].sort((a, b) => a - b);
      const measuredBaselineMs = percentile(baselineSorted, 50);
      const baselineMs =
        SLO_BASELINE_MS_OVERRIDE !== undefined && !Number.isNaN(SLO_BASELINE_MS_OVERRIDE)
          ? SLO_BASELINE_MS_OVERRIDE
          : measuredBaselineMs;
      const baselineSource =
        SLO_BASELINE_MS_OVERRIDE !== undefined && !Number.isNaN(SLO_BASELINE_MS_OVERRIDE)
          ? ("env_override" as const)
          : ("measured" as const);

      const sloCeilingMs = baselineMs * RATIO_THRESHOLD;

      const writePromise = postTourB("under-noise");

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      const noiseBatchSize = Number.parseInt(process.env.NOISE_READ_BATCH_SIZE ?? "25", 10);
      const readResults: HttpResult[] = [];
      const noiseReadPromise = (async () => {
        for (let offset = 0; offset < NOISE_READ_COUNT; offset += noiseBatchSize) {
          const slice = Math.min(noiseBatchSize, NOISE_READ_COUNT - offset);
          const batch = await Promise.all(
            Array.from({ length: slice }, () =>
              httpRequest({
                method: "GET",
                path: `/tours/${seedTourId}`,
                tenantId: tenantAId,
              }).catch((error: unknown) => ({
                status: 0,
                body: {
                  error: error instanceof Error ? error.message : String(error),
                },
                durationMs: 0,
              }))
            )
          );
          readResults.push(...batch);
        }
      })();

      const [writeResult] = await Promise.all([writePromise, noiseReadPromise]);

      if (writeResult.status === 201 && writeResult.body.id) {
        createdTourIds.push(writeResult.body.id);
      }

      const noiseReadsOk = readResults.filter((r) => r.status === 200).length;
      const noiseReadsRateLimited = readResults.filter((r) => {
        if (r.status !== 429) {
          return false;
        }
        const body = r.body as { code?: string; error?: string };
        return body.code === "RATE_LIMIT_EXCEEDED" || body.error === "rate_limit_exceeded";
      }).length;
      const noiseReadsHandled = noiseReadsOk + noiseReadsRateLimited;
      const noiseReadsFailed = readResults.length - noiseReadsHandled;

      assert.equal(
        writeResult.status,
        201,
        `tenant B write under noise must succeed (got ${writeResult.status}: ${writeResult.body.error ?? ""})`
      );
      assert.ok(
        noiseReadsHandled >= NOISE_READ_COUNT * 0.95,
        `noise reads: expected ≥95% success or RATE_LIMIT_EXCEEDED, got ok=${noiseReadsOk} limited=${noiseReadsRateLimited}/${NOISE_READ_COUNT}`
      );

      const underNoiseWriteMs = writeResult.durationMs;
      const ratio = baselineMs > 0 ? underNoiseWriteMs / baselineMs : underNoiseWriteMs;
      const withinSlo = underNoiseWriteMs <= sloCeilingMs;
      const verdict: NoiseNeighborReport["verdict"] = withinSlo ? "pass" : "throttling_gap";

      lastReport = {
        verdict,
        baselineMs: Math.round(baselineMs * 100) / 100,
        baselineSource,
        underNoiseWriteMs: Math.round(underNoiseWriteMs * 100) / 100,
        ratio: Math.round(ratio * 100) / 100,
        ratioThreshold: RATIO_THRESHOLD,
        noiseReadCount: NOISE_READ_COUNT,
        noiseReadsOk,
        noiseReadsRateLimited,
        noiseReadsFailed,
        writeStatus: writeResult.status,
        writeSucceeded: writeResult.status === 201,
      };

      process.env.NOISE_NEIGHBOR_REPORT = JSON.stringify(lastReport);
      if (process.env.NOISE_NEIGHBOR_EMIT === "1") {
        console.log(`NOISE_NEIGHBOR_JSON ${JSON.stringify(lastReport)}`);
      }

      if (!withinSlo) {
        assert.fail(
          [
            "NOISE_NEIGHBOR_THROTTLING_GAP: tenant B write exceeded SLO under tenant A read noise",
            `  baseline: ${baselineMs.toFixed(2)}ms (${baselineSource}, p50 of ${BASELINE_WRITE_SAMPLES} solo writes)`,
            `  under noise: ${underNoiseWriteMs.toFixed(2)}ms`,
            `  ratio: ${ratio.toFixed(2)}x (threshold ≤${RATIO_THRESHOLD}x = 300% over SLO)`,
            `  noise: ${NOISE_READ_COUNT} parallel GET /tours/:id on tenant A`,
            "  hypothesis: missing per-tenant connection/rate throttling — noisy neighbor degrades victim latency",
            "  data isolation may still be intact; this is a resource-fairness observability signal",
          ].join("\n")
        );
      }
    });

    it("exposes NOISE_NEIGHBOR_REPORT for SRE audit", () => {
      assert.ok(lastReport, "noise-neighbor report must be set by prior test");
      assert.ok(lastReport.writeSucceeded, "victim write must complete despite noise");
      assert.ok(
        lastReport.verdict === "pass" || lastReport.verdict === "throttling_gap",
        "verdict must be pass or throttling_gap"
      );
      if (lastReport.verdict === "throttling_gap") {
        console.info(
          `NOISE_NEIGHBOR_SRE_VERDICT throttling_gap ratio=${lastReport.ratio}x baseline=${lastReport.baselineMs}ms under_noise=${lastReport.underNoiseWriteMs}ms`
        );
      }
    });
  }
);
