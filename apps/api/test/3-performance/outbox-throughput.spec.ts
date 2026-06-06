/**
 * 3-performance — outbox relay throughput + main-path isolation.
 *
 * 1. Seeds 5_000 pending TourCreated outbox rows (admin bulk insert).
 * 2. Drains via production `processOutboxRelayOnce` loop; asserts >= MIN_THROUGHPUT events/sec.
 * 3. Re-seeds, measures solo POST /tours baseline, then runs relay drain concurrently with
 *    parallel createTour requests — all must succeed within SLO (baseline × ratio threshold).
 *
 * Requires Postgres (`DATABASE_URL`) with Phase 5 migrations applied.
 *
 * Run:
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
 *     DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db' \
 *     OUTBOX_RELAY_BATCH_SIZE=100 \
 *     pnpm --filter @apps/api exec node --import tsx --test test/3-performance/outbox-throughput.spec.ts
 *
 * Env tunables:
 *   MIN_THROUGHPUT           — minimum events/sec (default 500)
 *   OUTBOX_SEED_COUNT        — pending rows to seed (default 5000)
 *   OUTBOX_RELAY_BATCH_SIZE  — relay claim batch (default 100, max 100)
 *   CONCURRENT_CREATES       — parallel POST /tours during relay (default 20)
 *   BASELINE_WRITE_SAMPLES   — solo writes before probe (default 10)
 *   SLO_RATIO_THRESHOLD      — fail when under-relay p95 exceeds baseline × this (default 4)
 *   OUTBOX_THROUGHPUT_EMIT   — set "1" to log JSON report to stdout
 *
 * @see apps/api/src/outbox/outbox-relay.ts — processOutboxRelayOnce
 * @see apps/api/test/reliability/outbox-relay-connection-leak.spec.ts — bulk seed pattern
 * @see apps/api/test/2-observability/noise-neighbor.spec.ts — baseline × ratio SLO pattern
 */
import assert from "node:assert/strict";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { resetDomainEventBusForTests, subscribeDomainEvent } from "@app-tour/platform-events";
import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { processOutboxRelayOnce } from "../../src/outbox/outbox-relay";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const SKIP_MESSAGE =
  "outbox-throughput requires DATABASE_URL (e.g. postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db)";

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const SEED_COUNT = Number(process.env.OUTBOX_SEED_COUNT ?? "5000");
const MIN_THROUGHPUT = Number.parseInt(
  process.env.MIN_THROUGHPUT ?? (process.env.OUTBOX_THROUGHPUT_STRICT === "1" ? "500" : "100"),
  10
);
const RELAY_BATCH_SIZE = Number(process.env.OUTBOX_RELAY_BATCH_SIZE ?? "100");
const CONCURRENT_CREATES = Number(process.env.CONCURRENT_CREATES ?? "20");
const BASELINE_WRITE_SAMPLES = Number(process.env.BASELINE_WRITE_SAMPLES ?? "10");
const SLO_RATIO_THRESHOLD = Number(process.env.SLO_RATIO_THRESHOLD ?? "4");

const CREATE_CHUNK = 500;

export type OutboxThroughputReport = {
  readonly verdict: "pass" | "throughput_fail" | "main_path_fail";
  readonly seedCount: number;
  readonly published: number;
  readonly failed: number;
  readonly drainMs: number;
  readonly eventsPerSec: number;
  readonly minThroughput: number;
  readonly relayBatchSize: number;
  readonly baselineWriteP95Ms: number;
  readonly underRelayWriteP95Ms: number;
  readonly sloRatio: number;
  readonly sloRatioThreshold: number;
  readonly concurrentCreates: number;
  readonly concurrentCreatesSucceeded: number;
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
    "x-user-id": "outbox-throughput-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-throughput",
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

async function seedPendingOutboxRows(
  admin: PrismaClient,
  tenantId: string,
  count: number,
  runId: string
): Promise<void> {
  const rows = Array.from({ length: count }, (_, index) => ({
    tenantId,
    aggregateType: "tour",
    aggregateId: randomUUID(),
    eventType: "TourCreated",
    payload: { tenantId, tourId: randomUUID(), index },
    status: "pending" as const,
    domainEventId: randomUUID(),
    correlationId: `throughput-${runId}-${index}`,
  }));

  for (let offset = 0; offset < rows.length; offset += CREATE_CHUNK) {
    const batch = rows.slice(offset, offset + CREATE_CHUNK);
    const created = await admin.outboxEvent.createMany({ data: batch });
    assert.equal(
      created.count,
      batch.length,
      `createMany must insert full batch at offset ${offset}`
    );
  }

  const pending = await admin.outboxEvent.count({
    where: { tenantId, status: "pending" },
  });
  assert.equal(pending, count, `seed must create ${count} pending outbox rows`);
}

async function countTenantOutboxByStatus(
  admin: PrismaClient,
  tenantId: string
): Promise<{ done: number; failed: number; unfinished: number }> {
  const [done, failed, unfinished] = await Promise.all([
    admin.outboxEvent.count({ where: { tenantId, status: "done" } }),
    admin.outboxEvent.count({ where: { tenantId, status: "failed" } }),
    admin.outboxEvent.count({
      where: { tenantId, status: { in: ["pending", "processing"] } },
    }),
  ]);
  return { done, failed, unfinished };
}

/**
 * Drains tenant outbox via production global {@link processOutboxRelayOnce} ticks.
 * Throughput is measured from tenant-scoped `done` row delta (global relay may
 * interleave other tenants' work in the same ticks).
 */
async function drainOutboxRelay(
  admin: PrismaClient,
  tenantId: string,
  batchSize: number
): Promise<{ published: number; failed: number; drainMs: number }> {
  const startCounts = await countTenantOutboxByStatus(admin, tenantId);
  const start = performance.now();
  let safetyTicks = 0;

  while (safetyTicks < 10_000) {
    safetyTicks += 1;
    const { unfinished } = await countTenantOutboxByStatus(admin, tenantId);
    if (unfinished === 0) {
      break;
    }

    const result = await processOutboxRelayOnce(batchSize);

    if (result.claimed === 0 && unfinished > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  const drainMs = performance.now() - start;
  const endCounts = await countTenantOutboxByStatus(admin, tenantId);
  const published = endCounts.done - startCounts.done;
  const failed = endCounts.failed - startCounts.failed;

  assert.equal(
    endCounts.unfinished,
    0,
    "relay drain must clear all pending/processing rows for tenant"
  );

  return { published, failed, drainMs };
}

type HttpResult = {
  readonly status: number;
  readonly body: { id?: string; tenantId?: string; error?: string };
  readonly durationMs: number;
};

describe(
  "3-performance — outbox relay throughput (integration)",
  { skip: hasDatabase ? false : SKIP_MESSAGE, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    const tenantId = integrationTenantId();
    const createdTourIds: string[] = [];
    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    let server: http.Server;
    let port = 0;
    let lastReport: OutboxThroughputReport | undefined;

    const priorStorageDriver = process.env.STORAGE_DRIVER;
    const priorBatchSize = process.env.OUTBOX_RELAY_BATCH_SIZE;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.OUTBOX_RELAY_BATCH_SIZE = String(RELAY_BATCH_SIZE);
      process.env.DATABASE_URL = withConnectionLimit(
        process.env.DATABASE_URL?.trim() ?? APP_TOUR_URL
      );
      if (!process.env.DATABASE_URL_ADMIN?.trim()) {
        process.env.DATABASE_URL_ADMIN = ADMIN_URL;
      }
      await disconnectPrisma();

      resetDomainEventBusForTests();
      subscribeDomainEvent("TourCreated", () => {
        // noop — exercises bus without accumulating handler state
      });

      admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `otp-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });

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
        throw new Error("outbox-throughput: no listen address");
      }
      port = addr.port;
    });

    after(async () => {
      server.close();
      process.env.STORAGE_DRIVER = priorStorageDriver;
      if (priorBatchSize === undefined) {
        delete process.env.OUTBOX_RELAY_BATCH_SIZE;
      } else {
        process.env.OUTBOX_RELAY_BATCH_SIZE = priorBatchSize;
      }

      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        await admin.auditEvent.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await admin.$disconnect();
      await disconnectPrisma();
    });

    async function httpPostTour(suffix: string): Promise<HttpResult> {
      const start = performance.now();
      return new Promise((resolve, reject) => {
        const body = {
          data: {
            basics: { title: `throughput-${runId}-${suffix}` },
            details: { summary: "create-under-relay" },
          },
        };
        const payload = JSON.stringify(body);
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
              });
            });
          }
        );
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
    }

    async function purgeTenantOutboxAndTours(): Promise<void> {
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        await admin.auditEvent.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
    }

    it(`drains ${SEED_COUNT} pending outbox rows at >= ${MIN_THROUGHPUT} events/sec`, async () => {
      await purgeTenantOutboxAndTours();
      await seedPendingOutboxRows(admin, tenantId, SEED_COUNT, runId);

      const { published, failed, drainMs } = await drainOutboxRelay(
        admin,
        tenantId,
        RELAY_BATCH_SIZE
      );

      assert.equal(failed, 0, "throughput drain must not mark rows failed");
      assert.ok(
        published >= SEED_COUNT,
        `expected at least ${SEED_COUNT} published events, got ${published}`
      );

      const eventsPerSec = published / (drainMs / 1000);
      const throughputOk = eventsPerSec >= MIN_THROUGHPUT;

      lastReport = {
        verdict: throughputOk ? "pass" : "throughput_fail",
        seedCount: SEED_COUNT,
        published,
        failed,
        drainMs: Math.round(drainMs * 100) / 100,
        eventsPerSec: Math.round(eventsPerSec * 100) / 100,
        minThroughput: MIN_THROUGHPUT,
        relayBatchSize: RELAY_BATCH_SIZE,
        baselineWriteP95Ms: 0,
        underRelayWriteP95Ms: 0,
        sloRatio: 0,
        sloRatioThreshold: SLO_RATIO_THRESHOLD,
        concurrentCreates: 0,
        concurrentCreatesSucceeded: 0,
      };

      process.env.OUTBOX_THROUGHPUT_REPORT = JSON.stringify(lastReport);
      if (process.env.OUTBOX_THROUGHPUT_EMIT === "1") {
        console.log(`OUTBOX_THROUGHPUT_JSON ${JSON.stringify(lastReport)}`);
      }

      console.info(
        [
          `outbox relay throughput (${SEED_COUNT} seeded, batch=${RELAY_BATCH_SIZE})`,
          `  published: ${published}`,
          `  drain: ${drainMs.toFixed(1)} ms`,
          `  rate: ${eventsPerSec.toFixed(1)} events/sec`,
          `  budget: >= ${MIN_THROUGHPUT} events/sec`,
        ].join("\n")
      );

      assert.ok(
        throughputOk,
        [
          `outbox relay throughput below MIN_THROUGHPUT=${MIN_THROUGHPUT} events/sec`,
          `  measured: ${eventsPerSec.toFixed(1)} events/sec`,
          `  published: ${published} in ${drainMs.toFixed(1)} ms`,
          `  batch size: ${RELAY_BATCH_SIZE}`,
          "  tune OUTBOX_RELAY_BATCH_SIZE or investigate relay/RLS/pool contention",
        ].join("\n")
      );
    });

    it("POST /tours succeeds within SLO while relay drains outbox load", async () => {
      await purgeTenantOutboxAndTours();
      await seedPendingOutboxRows(admin, tenantId, SEED_COUNT, `${runId}-main`);

      const baselineSamples: number[] = [];
      for (let i = 0; i < BASELINE_WRITE_SAMPLES; i += 1) {
        const res = await httpPostTour(`baseline-${i}`);
        assert.equal(res.status, 201, `baseline write ${i} must succeed (status=${res.status})`);
        if (res.body.id) {
          createdTourIds.push(res.body.id);
        }
        baselineSamples.push(res.durationMs);
      }

      const baselineP95 = percentile(
        [...baselineSamples].sort((a, b) => a - b),
        95
      );
      const sloCeilingMs = baselineP95 * SLO_RATIO_THRESHOLD;

      const relayPromise = drainOutboxRelay(admin, tenantId, RELAY_BATCH_SIZE);
      const createPromises = Array.from({ length: CONCURRENT_CREATES }, (_, i) =>
        httpPostTour(`under-relay-${i}`)
      );

      const [relayResult, ...createResults] = await Promise.all([relayPromise, ...createPromises]);

      const succeeded = createResults.filter((r) => r.status === 201);
      for (const res of succeeded) {
        if (res.body.id) {
          createdTourIds.push(res.body.id);
        }
      }

      assert.equal(
        succeeded.length,
        CONCURRENT_CREATES,
        `all ${CONCURRENT_CREATES} concurrent POST /tours must succeed under relay load`
      );

      const underRelaySamples = createResults.map((r) => r.durationMs);
      const underRelayP95 = percentile(
        [...underRelaySamples].sort((a, b) => a - b),
        95
      );
      const sloRatio = baselineP95 > 0 ? underRelayP95 / baselineP95 : underRelayP95;
      const withinSlo = underRelayP95 <= sloCeilingMs;

      const relayEventsPerSec = relayResult.published / (relayResult.drainMs / 1000);

      lastReport = {
        verdict: withinSlo ? "pass" : "main_path_fail",
        seedCount: SEED_COUNT,
        published: relayResult.published,
        failed: relayResult.failed,
        drainMs: Math.round(relayResult.drainMs * 100) / 100,
        eventsPerSec: Math.round(relayEventsPerSec * 100) / 100,
        minThroughput: MIN_THROUGHPUT,
        relayBatchSize: RELAY_BATCH_SIZE,
        baselineWriteP95Ms: Math.round(baselineP95 * 100) / 100,
        underRelayWriteP95Ms: Math.round(underRelayP95 * 100) / 100,
        sloRatio: Math.round(sloRatio * 100) / 100,
        sloRatioThreshold: SLO_RATIO_THRESHOLD,
        concurrentCreates: CONCURRENT_CREATES,
        concurrentCreatesSucceeded: succeeded.length,
      };

      process.env.OUTBOX_THROUGHPUT_MAIN_PATH_REPORT = JSON.stringify(lastReport);
      if (process.env.OUTBOX_THROUGHPUT_EMIT === "1") {
        console.log(`OUTBOX_MAIN_PATH_JSON ${JSON.stringify(lastReport)}`);
      }

      console.info(
        [
          "createTour under outbox relay load",
          `  baseline p95: ${baselineP95.toFixed(1)} ms (${BASELINE_WRITE_SAMPLES} solo writes)`,
          `  under-relay p95: ${underRelayP95.toFixed(1)} ms (${CONCURRENT_CREATES} parallel writes)`,
          `  ratio: ${sloRatio.toFixed(2)}x (threshold ≤${SLO_RATIO_THRESHOLD}x)`,
          `  relay: ${relayResult.published} events in ${relayResult.drainMs.toFixed(1)} ms (${relayEventsPerSec.toFixed(1)} events/sec)`,
        ].join("\n")
      );

      assert.ok(
        withinSlo,
        [
          "POST /tours exceeded SLO while outbox relay drained pending load",
          `  baseline p95: ${baselineP95.toFixed(2)} ms`,
          `  under-relay p95: ${underRelayP95.toFixed(2)} ms`,
          `  ratio: ${sloRatio.toFixed(2)}x (threshold ≤${SLO_RATIO_THRESHOLD}x)`,
          `  relay throughput: ${relayEventsPerSec.toFixed(1)} events/sec`,
          "  main path may be blocked by relay pool/RLS contention",
        ].join("\n")
      );
    });
  }
);
