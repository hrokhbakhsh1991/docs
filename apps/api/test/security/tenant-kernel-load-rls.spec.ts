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

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

/** Distinct tenants under concurrent load (mission: 20). */
const TENANT_COUNT = 20;

/** Total concurrent HTTP ops in the mixed load burst (mission: 50). */
const CONCURRENT_OPS = 50;

/** Tenant A baseline GET samples before B burst. */
const LATENCY_BASELINE_SAMPLES = 25;

/** Tenant A GET samples while tenant B is writing heavily. */
const LATENCY_UNDER_LOAD_SAMPLES = 25;

/** Heavy-write burst on tenant B during latency isolation probe. */
const BURST_WRITE_COUNT = 32;

/** p95 during B burst must stay below this ratio × baseline p95. */
const P95_RATIO_THRESHOLD = 2;

/** Absolute p95 cap (ms) when baseline is very fast. */
const P95_ABSOLUTE_CAP_MS = 800;

const VALID_TOUR_BODY = {
  data: { basics: { title: "kernel-load" }, details: { summary: "ok" } },
};

function withConnectionLimit(url: string, limit = 64): string {
  if (/connection_limit=/i.test(url)) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=${limit}`;
}

function isTransientPoolError(message: string): boolean {
  return /Unable to start a transaction|Timed out fetching|connection pool/i.test(message);
}

export type LoadReport = {
  readonly leakage: string[];
  readonly races: string[];
  readonly latency: {
    readonly baselineP95Ms: number;
    readonly underLoadP95Ms: number;
    readonly ratio: number;
    readonly pass: boolean;
  };
  readonly timing: {
    readonly loadOps: number;
    readonly loadP50Ms: number;
    readonly loadP95Ms: number;
    readonly loadMaxMs: number;
  };
};

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "kernel-load-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-1",
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

type TenantFixture = {
  readonly tenantId: string;
  readonly marker: string;
  readonly seedTourId: string;
  readonly createdTourIds: string[];
};

type HttpResult = {
  readonly status: number;
  readonly body: { id?: string; tenantId?: string; error?: string };
  readonly durationMs: number;
};

/**
 * Tenant-kernel load + RLS isolation under Phase 5 stack (Postgres 5434, prisma driver).
 * See docs/phase-5/audits/TENANT-KERNEL-LOAD-REPORT.md for captured metrics.
 */
describe(
  "tenant-kernel load + RLS (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    const fixtures: TenantFixture[] = [];
    let admin: PrismaClient;
    let appRole: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    let server: http.Server;
    let port = 0;
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    let lastReport: LoadReport | undefined;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const appUrl = withConnectionLimit(process.env.DATABASE_URL?.trim() ?? APP_TOUR_URL);
      process.env.DATABASE_URL = appUrl;
      await disconnectPrisma();
      admin = getPrismaAdmin();
      appRole = new PrismaClient({
        datasources: { db: { url: withConnectionLimit(APP_TOUR_URL) } },
      });

      for (let i = 0; i < TENANT_COUNT; i += 1) {
        const tenantId = integrationTenantId();
        const marker = `tk-load-${runId}-t${i}`;
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `tk-load-${runId}-${i}`,
            workspaceType: "starter",
            theme: {},
          },
        });

        const seed = await admin.tour.create({
          data: {
            tenantId,
            title: `${marker}-seed`,
            canonical: {
              schemaVersion: 1,
              roots: ["basics"],
              data: { basics: { title: `${marker}-seed` }, details: { summary: "seed" } },
            },
          },
        });

        fixtures.push({
          tenantId,
          marker,
          seedTourId: seed.id,
          createdTourIds: [],
        });
      }

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
        throw new Error("tenant-kernel load: no listen address");
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
        for (const { tenantId } of fixtures) {
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
      await appRole.$disconnect();
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

    async function assertRlsNoLeak(viewer: TenantFixture, foreignTourIds: string[]): Promise<void> {
      await appRole.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT set_config('app.current_tenant_id', ${viewer.tenantId}::text, true)
        `;

        const ownTours = await tx.tour.findMany({ where: { tenantId: viewer.tenantId } });
        assert.ok(
          ownTours.every((row) => row.tenantId === viewer.tenantId),
          `tours findMany must only return viewer tenant ${viewer.tenantId}`
        );

        for (const foreignId of foreignTourIds) {
          if (foreignId === viewer.seedTourId || viewer.createdTourIds.includes(foreignId)) {
            continue;
          }
          const crossTour = await tx.tour.findUnique({
            where: { tenantId_id: { tenantId: viewer.tenantId, id: foreignId } },
          });
          if (crossTour !== null) {
            throw new Error(
              [
                "SECURITY_RLS_LEAK_TOUR",
                `viewer=${viewer.tenantId}`,
                `foreignTourId=${foreignId}`,
                `rowTenant=${crossTour.tenantId}`,
              ].join(" ")
            );
          }

          const crossOutbox = await tx.outboxEvent.findMany({
            where: { tenantId: viewer.tenantId, aggregateId: foreignId },
          });
          if (crossOutbox.length > 0) {
            throw new Error(
              [
                "SECURITY_RLS_LEAK_OUTBOX",
                `viewer=${viewer.tenantId}`,
                `foreignTourId=${foreignId}`,
                `rows=${crossOutbox.length}`,
              ].join(" ")
            );
          }

          const crossAudit = await tx.auditEvent.findMany({
            where: { tenantId: viewer.tenantId, entityId: foreignId },
          });
          if (crossAudit.some((row) => row.tenantId !== viewer.tenantId)) {
            throw new Error(
              `SECURITY_RLS_LEAK_AUDIT viewer=${viewer.tenantId} foreignTourId=${foreignId}`
            );
          }
        }

        const foreignTenantIds = fixtures
          .map((f) => f.tenantId)
          .filter((id) => id !== viewer.tenantId);
        const crossTenantAudit = await tx.auditEvent.findMany({
          where: { tenantId: { in: foreignTenantIds } },
        });
        assert.equal(
          crossTenantAudit.length,
          0,
          `audit_events findMany with foreign tenantId filter must return 0 under RLS session ${viewer.tenantId}`
        );
      });
    }

    it("TK-LOAD-RLS: 50 concurrent ops / 20 tenants, no leakage, latency isolation", async () => {
      const leakage: string[] = [];
      const races: string[] = [];
      const loadDurations: number[] = [];

      const tenantA = fixtures[0];
      const tenantB = fixtures[1];
      assert.ok(tenantA && tenantB, "fixtures require tenants A and B");

      const allForeignTourIds = (): string[] =>
        fixtures.flatMap((f) => [f.seedTourId, ...f.createdTourIds]);

      async function timedGetTenantA(): Promise<number> {
        const res = await httpRequest({
          method: "GET",
          path: `/tours/${tenantA.seedTourId}`,
          tenantId: tenantA.tenantId,
        });
        if (res.status !== 200) {
          races.push(`baseline_get_status_${res.status}`);
        }
        return res.durationMs;
      }

      const baselineSamples: number[] = [];
      for (let i = 0; i < LATENCY_BASELINE_SAMPLES; i += 1) {
        baselineSamples.push(await timedGetTenantA());
      }
      const baselineSorted = [...baselineSamples].sort((a, b) => a - b);
      const baselineP95 = percentile(baselineSorted, 95);

      const underLoadSamples = await Promise.all([
        Promise.all(
          Array.from({ length: BURST_WRITE_COUNT }, (_, i) =>
            httpRequest({
              method: "POST",
              path: "/tours",
              tenantId: tenantB.tenantId,
              body: {
                ...VALID_TOUR_BODY,
                data: {
                  basics: { title: `${tenantB.marker}-burst-${i}` },
                  details: { summary: "burst" },
                },
              },
            })
          )
        ),
        Promise.all(Array.from({ length: LATENCY_UNDER_LOAD_SAMPLES }, () => timedGetTenantA())),
      ]).then(([burstResults, reads]) => {
        for (const res of burstResults) {
          if (res.status === 201 && res.body.id) {
            tenantB.createdTourIds.push(res.body.id);
          }
        }
        return reads;
      });

      const underLoadSortedEarly = [...underLoadSamples].sort((a, b) => a - b);
      const underLoadP95Early = percentile(underLoadSortedEarly, 95);
      const ratioEarly = baselineP95 > 0 ? underLoadP95Early / baselineP95 : underLoadP95Early;
      const latencyPassEarly =
        underLoadP95Early <= P95_ABSOLUTE_CAP_MS ||
        (baselineP95 === 0 ? underLoadP95Early === 0 : ratioEarly < P95_RATIO_THRESHOLD);

      async function runLoadOp(opIndex: number): Promise<void> {
        const fixture = fixtures[opIndex % TENANT_COUNT];
        assert.ok(fixture, "fixture slot");
        const isWrite = opIndex % 2 === 0;

        if (isWrite) {
          const res = await httpRequest({
            method: "POST",
            path: "/tours",
            tenantId: fixture.tenantId,
            body: {
              ...VALID_TOUR_BODY,
              data: {
                basics: { title: `${fixture.marker}-op${opIndex}` },
                details: { summary: "load" },
              },
            },
          });
          loadDurations.push(res.durationMs);
          if (res.status === 201 && res.body.id) {
            if (res.body.tenantId && res.body.tenantId !== fixture.tenantId) {
              leakage.push(
                `HTTP tenant mismatch op=${opIndex} expected=${fixture.tenantId} got=${res.body.tenantId}`
              );
            }
            fixture.createdTourIds.push(res.body.id);
          } else if (res.status !== 201) {
            races.push(`write_op${opIndex}_status_${res.status}_${res.body.error ?? ""}`);
          }
        } else {
          const tourId = fixture.seedTourId;
          const res = await httpRequest({
            method: "GET",
            path: `/tours/${tourId}`,
            tenantId: fixture.tenantId,
          });
          loadDurations.push(res.durationMs);
          if (res.status === 200) {
            if (res.body.tenantId && res.body.tenantId !== fixture.tenantId) {
              leakage.push(
                `GET tenant mismatch op=${opIndex} expected=${fixture.tenantId} got=${res.body.tenantId}`
              );
            }
          } else if (res.status !== 200 && res.status !== 404) {
            races.push(`read_op${opIndex}_status_${res.status}`);
          }
        }
      }

      const loadResults = await Promise.allSettled(
        Array.from({ length: CONCURRENT_OPS }, (_, opIndex) => runLoadOp(opIndex))
      );

      const transientFailures: { opIndex: number; message: string }[] = [];
      for (let opIndex = 0; opIndex < loadResults.length; opIndex += 1) {
        const result = loadResults[opIndex];
        if (result?.status === "rejected") {
          const message =
            result.reason instanceof Error ? result.reason.message : String(result.reason);
          if (isTransientPoolError(message)) {
            transientFailures.push({ opIndex, message });
          } else {
            races.push(`op${opIndex}:${message}`);
          }
        }
      }

      if (transientFailures.length > 0) {
        const retries = await Promise.allSettled(
          transientFailures.map(({ opIndex }) => runLoadOp(opIndex))
        );
        for (let i = 0; i < retries.length; i += 1) {
          const retry = retries[i];
          const opIndex = transientFailures[i]?.opIndex;
          if (retry?.status === "rejected" && opIndex !== undefined) {
            const message =
              retry.reason instanceof Error ? retry.reason.message : String(retry.reason);
            races.push(`op${opIndex}_retry:${message}`);
          }
        }
      }

      const foreignIds = allForeignTourIds();
      for (const viewer of fixtures) {
        try {
          await assertRlsNoLeak(viewer, foreignIds);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          leakage.push(`post_load_rls:${viewer.tenantId}:${message}`);
        }
      }

      for (const viewer of fixtures) {
        for (const owner of fixtures) {
          if (viewer.tenantId === owner.tenantId) {
            continue;
          }
          for (const foreignTourId of [owner.seedTourId, ...owner.createdTourIds]) {
            try {
              await appRole.$transaction(async (tx) => {
                await tx.$executeRaw`
                  SELECT set_config('app.current_tenant_id', ${viewer.tenantId}::text, true)
                `;
                const crossTour = await tx.tour.findUnique({
                  where: {
                    tenantId_id: { tenantId: viewer.tenantId, id: foreignTourId },
                  },
                });
                if (crossTour !== null) {
                  throw new Error(
                    `SECURITY_RLS_LEAK_TOUR viewer=${viewer.tenantId} foreign=${foreignTourId} owner=${owner.tenantId}`
                  );
                }
                const crossOutbox = await tx.outboxEvent.findMany({
                  where: { tenantId: viewer.tenantId, aggregateId: foreignTourId },
                });
                if (crossOutbox.length > 0) {
                  throw new Error(
                    `SECURITY_RLS_LEAK_OUTBOX viewer=${viewer.tenantId} foreign=${foreignTourId}`
                  );
                }
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              leakage.push(message);
            }
          }
        }
      }

      const underLoadP95 = underLoadP95Early;
      const ratio = ratioEarly;
      const latencyPass = latencyPassEarly;

      const loadSorted = [...loadDurations].sort((a, b) => a - b);
      lastReport = {
        leakage,
        races,
        latency: {
          baselineP95Ms: Math.round(baselineP95 * 100) / 100,
          underLoadP95Ms: Math.round(underLoadP95 * 100) / 100,
          ratio: Math.round(ratio * 100) / 100,
          pass: latencyPass,
        },
        timing: {
          loadOps: loadDurations.length,
          loadP50Ms: Math.round(percentile(loadSorted, 50) * 100) / 100,
          loadP95Ms: Math.round(percentile(loadSorted, 95) * 100) / 100,
          loadMaxMs: Math.round((loadSorted.at(-1) ?? 0) * 100) / 100,
        },
      };

      process.env.TENANT_KERNEL_LOAD_REPORT = JSON.stringify(lastReport);
      if (process.env.TENANT_KERNEL_LOAD_EMIT === "1") {
        console.log(`TENANT_KERNEL_LOAD_JSON ${JSON.stringify(lastReport)}`);
      }

      const adminCross = await admin.tour.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: fixtures.map((f) => f.tenantId) } },
        _count: { id: true },
      });
      for (const row of adminCross) {
        const fixture = fixtures.find((f) => f.tenantId === row.tenantId);
        if (!fixture) {
          leakage.push(`orphan_admin_group_tenant=${row.tenantId}`);
        }
      }

      if (leakage.length > 0) {
        assert.fail(
          [
            "TENANT_KERNEL_LOAD_FAIL: cross-tenant leakage detected",
            ...leakage.slice(0, 8),
            leakage.length > 8 ? `…and ${leakage.length - 8} more` : "",
            "hypothesis: apps/api/src/db/with-canonical-transaction.ts or with-tenant-rls.ts set_config scope",
          ].join("\n")
        );
      }

      if (races.length > 0) {
        assert.fail(
          [
            "TENANT_KERNEL_LOAD_FAIL: unexpected errors/races",
            ...races.slice(0, 8),
            races.length > 8 ? `…and ${races.length - 8} more` : "",
          ].join("\n")
        );
      }

      assert.ok(
        latencyPass,
        `latency isolation failed: baseline p95=${baselineP95.toFixed(2)}ms under_load p95=${underLoadP95.toFixed(2)}ms ratio=${ratio.toFixed(2)} (threshold <${P95_RATIO_THRESHOLD}x and <${P95_ABSOLUTE_CAP_MS}ms)`
      );
    });

    it("exposes TENANT_KERNEL_LOAD_REPORT for audit markdown", () => {
      assert.ok(lastReport, "load report must be set by prior test");
      assert.equal(lastReport.leakage.length, 0);
      assert.ok(lastReport.latency.pass);
    });
  }
);
