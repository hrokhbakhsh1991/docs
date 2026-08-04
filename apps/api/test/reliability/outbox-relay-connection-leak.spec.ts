/**
 * Phase 5 reliability — outbox relay + withTenantRls memory and connection audit.
 *
 * Runs ~10_000 operations (relay publish/fail + tenant RLS sessions), samples heap
 * and pg_stat_activity for app_tour, injects error paths, then disconnectPrisma and
 * confirms connections return to baseline.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { resetDomainEventBusForTests, subscribeDomainEvent } from "@app-tour/platform-events";
import { PrismaClient } from "@prisma/client";

import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { withTenantRls } from "../../src/db/with-tenant-rls";
import { processOutboxRelayForTenantOnce } from "../../src/outbox/outbox-relay";
import { integrationTenantId } from "../test-helpers";
import { skipUnlessNightlyTier } from "../test-tier";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const TARGET_OPERATIONS = 10_000;
const BATCH_SIZE = 50;
const SAMPLE_EVERY = 500;
/** Allow 120% growth above post-warmup minimum after GC (full suite memory pressure). */
const MAX_HEAP_GROWTH_RATIO = 2.25;
/** Prisma default pool ~10 per client; two singletons + headroom. */
const MAX_APP_TOUR_CONNECTIONS = 25;

export type ConnectionSnapshot = {
  readonly total: number;
  readonly active: number;
  readonly idle: number;
  readonly idleInTransaction: number;
};

export type ReliabilitySample = {
  readonly operation: number;
  readonly heapMb: number;
  readonly connections: ConnectionSnapshot;
  readonly label: string;
};

function sampleHeapMb(): number {
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

function forceGcIfAvailable(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  gc?.();
}

async function countAppTourConnections(admin: PrismaClient): Promise<ConnectionSnapshot> {
  const rows = await admin.$queryRaw<Array<{ state: string | null; count: number }>>`
    SELECT state, count(*)::int AS count
    FROM pg_stat_activity
    WHERE usename = 'app_tour'
      AND datname = current_database()
    GROUP BY state
  `;

  let total = 0;
  let active = 0;
  let idle = 0;
  let idleInTransaction = 0;

  for (const row of rows) {
    total += row.count;
    const state = row.state ?? "unknown";
    if (state === "active") {
      active += row.count;
    } else if (state === "idle") {
      idle += row.count;
    } else if (state === "idle in transaction") {
      idleInTransaction += row.count;
    }
  }

  return { total, active, idle, idleInTransaction };
}

async function waitForConnectionDrain(
  admin: PrismaClient,
  maxAttempts = 20,
  delayMs = 100
): Promise<ConnectionSnapshot> {
  let snapshot = await countAppTourConnections(admin);
  for (let attempt = 0; attempt < maxAttempts && snapshot.idleInTransaction > 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    snapshot = await countAppTourConnections(admin);
  }
  return snapshot;
}

async function seedValidPendingRows(
  admin: PrismaClient,
  tenantId: string,
  count: number,
  offset: number
): Promise<void> {
  const rows = Array.from({ length: count }, (_, index) => ({
    tenantId,
    aggregateType: "tour",
    aggregateId: randomUUID(),
    eventType: "TourCreated",
    payload: { tenantId, tourId: randomUUID(), index: offset + index },
    status: "pending" as const,
    domainEventId: randomUUID(),
  }));

  for (let start = 0; start < rows.length; start += 500) {
    await admin.outboxEvent.createMany({ data: rows.slice(start, start + 500) });
  }
}

async function seedErrorRows(admin: PrismaClient, tenantId: string, count: number): Promise<void> {
  const otherTenantId = integrationTenantId();
  await admin.tenant.create({
    data: {
      id: otherTenantId,
      subdomain: `err-${otherTenantId.slice(0, 8)}`,
      workspaceType: "starter",
      theme: {},
    },
  });

  const errorRows = [
    ...Array.from({ length: Math.ceil(count / 3) }, () => ({
      tenantId,
      aggregateType: "tour",
      aggregateId: randomUUID(),
      eventType: "TourCreated",
      payload: "not-an-object" as unknown as object,
      status: "pending" as const,
      domainEventId: randomUUID(),
    })),
    ...Array.from({ length: Math.ceil(count / 3) }, () => ({
      tenantId,
      aggregateType: "tour",
      aggregateId: randomUUID(),
      eventType: "TourCreated",
      payload: { tenantId: otherTenantId, tourId: randomUUID() },
      status: "pending" as const,
      domainEventId: randomUUID(),
    })),
    ...Array.from({ length: Math.floor(count / 3) }, () => ({
      tenantId,
      aggregateType: "tour",
      aggregateId: randomUUID(),
      eventType: "TourCreated",
      payload: { tenantId, tourId: randomUUID() },
      status: "pending" as const,
      domainEventId: null,
    })),
  ];

  await admin.outboxEvent.createMany({ data: errorRows.slice(0, count) });
  await admin.tenant.delete({ where: { id: otherTenantId } });
}

describe(
  "reliability outbox relay connection leak (integration)",
  {
    skip: !hasDatabase
      ? "requires DATABASE_URL"
      : skipUnlessNightlyTier("10k relay + connection leak probe"),
    concurrency: false,
  },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    let admin: PrismaClient;
    const samples: ReliabilitySample[] = [];
    let baselineConnections: ConnectionSnapshot;

    before(async () => {
      resetDomainEventBusForTests();
      admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `rel-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      // Valid rows + error injection budget (~200 errors in 10k ops).
      await seedValidPendingRows(admin, tenantId, 9_800, 0);
      await seedErrorRows(admin, tenantId, 200);

      const pendingAfterSeed = await admin.outboxEvent.count({
        where: { tenantId, status: "pending" },
      });
      assert.equal(pendingAfterSeed, 10_000, "seed must create 10_000 pending rows");

      subscribeDomainEvent("TourCreated", () => {
        // noop — exercises bus delivery without accumulating per-handler state
      });

      forceGcIfAvailable();
      baselineConnections = await countAppTourConnections(admin);
      samples.push({
        operation: 0,
        heapMb: sampleHeapMb(),
        connections: baselineConnections,
        label: "start",
      });
    });

    after(async () => {
      const cleanupAdmin = getPrismaAdmin();
      await cleanupAdmin.outboxEvent.deleteMany({ where: { tenantId } });
      await cleanupAdmin.tenant.delete({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("10_000 relay + RLS ops without heap or connection leak", async () => {
      let operations = 0;
      let relayTicks = 0;
      let maxConnections = baselineConnections.total;
      let errorsInjectedProcessed = 0;

      let safetyTicks = 0;
      while (safetyTicks < 1_500) {
        safetyTicks += 1;
        relayTicks += 1;

        const pendingBeforeTick = await admin.outboxEvent.count({
          where: { tenantId, status: { in: ["pending", "processing"] } },
        });
        if (pendingBeforeTick === 0) {
          break;
        }

        // Periodic bus reset — prevents listener accumulation across long runs.
        if (relayTicks % 100 === 0) {
          resetDomainEventBusForTests();
          subscribeDomainEvent("TourCreated", () => {});
        }

        const result = await processOutboxRelayForTenantOnce(tenantId, BATCH_SIZE);
        operations += result.published + result.failed;
        errorsInjectedProcessed += result.failed;

        if (result.claimed === 0 && pendingBeforeTick > 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // Interleave withTenantRls load (10 parallel sessions per 5 relay ticks).
        if (relayTicks % 5 === 0) {
          await Promise.all(
            Array.from({ length: 10 }, () =>
              withTenantRls(tenantId, async (tx) => {
                await tx.outboxEvent.count({ where: { tenantId } });
              })
            )
          );
          operations += 10;
        }

        if (operations % SAMPLE_EVERY === 0 || pendingBeforeTick === 0) {
          const connections = await countAppTourConnections(admin);
          maxConnections = Math.max(maxConnections, connections.total);
          const label =
            operations >= 2_000 && operations < 2_500
              ? "2k"
              : operations >= 5_000 && operations < 5_500
                ? "5k"
                : operations >= TARGET_OPERATIONS - BATCH_SIZE
                  ? "10k"
                  : `op-${operations}`;
          samples.push({
            operation: operations,
            heapMb: sampleHeapMb(),
            connections,
            label,
          });
        }
      }

      assert.ok(operations >= TARGET_OPERATIONS, `expected >= ${TARGET_OPERATIONS} ops`);
      const statusCounts = await admin.outboxEvent.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: { _all: true },
      });
      const failedRowsInDb = await admin.outboxEvent.count({
        where: { tenantId, status: "failed" },
      });
      assert.ok(
        errorsInjectedProcessed >= 100 || failedRowsInDb >= 100,
        `error path rows must be processed (markOutboxFailed); tickFailed=${errorsInjectedProcessed} dbFailed=${failedRowsInDb} status=${JSON.stringify(statusCounts)}`
      );

      const connectionsAfterErrors = await waitForConnectionDrain(admin);
      samples.push({
        operation: operations,
        heapMb: sampleHeapMb(),
        connections: connectionsAfterErrors,
        label: "after-errors",
      });

      assert.ok(
        connectionsAfterErrors.total <= MAX_APP_TOUR_CONNECTIONS,
        `pool exhaustion: ${connectionsAfterErrors.total} app_tour connections (max ${MAX_APP_TOUR_CONNECTIONS})`
      );
      assert.ok(
        connectionsAfterErrors.idleInTransaction === 0,
        `idle-in-transaction leak: ${connectionsAfterErrors.idleInTransaction} sessions stuck`
      );

      forceGcIfAvailable();
      const finalHeapMb = sampleHeapMb();
      samples.push({
        operation: operations,
        heapMb: finalHeapMb,
        connections: connectionsAfterErrors,
        label: "pre-disconnect",
      });

      const postWarmupSamples = samples.filter(
        (s) => s.operation > 0 && s.label !== "start" && s.label !== "pre-disconnect"
      );
      const minAfterWarmup =
        postWarmupSamples.length > 0
          ? Math.min(...postWarmupSamples.map((s) => s.heapMb))
          : (samples[0]?.heapMb ?? finalHeapMb);
      const growthRatio = finalHeapMb / minAfterWarmup;

      assert.ok(
        growthRatio <= MAX_HEAP_GROWTH_RATIO,
        `monotonic heap growth ${growthRatio.toFixed(3)} exceeds ${MAX_HEAP_GROWTH_RATIO}`
      );

      await disconnectPrisma();

      const probeAdmin = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL_ADMIN } },
      });
      try {
        const connectionsAfterDisconnect = await countAppTourConnections(probeAdmin);
        samples.push({
          operation: operations,
          heapMb: sampleHeapMb(),
          connections: connectionsAfterDisconnect,
          label: "post-disconnect",
        });

        assert.ok(
          connectionsAfterDisconnect.total <= baselineConnections.total + 2,
          `connections did not return after disconnect: baseline=${baselineConnections.total} after=${connectionsAfterDisconnect.total}`
        );
      } finally {
        await probeAdmin.$disconnect();
      }

      process.env.P5_RELIABILITY_SAMPLES = JSON.stringify(samples);
      process.env.P5_RELIABILITY_MAX_CONNECTIONS = String(maxConnections);
      process.env.P5_RELIABILITY_HEAP_GROWTH = growthRatio.toFixed(4);
      process.env.P5_RELIABILITY_VERDICT = "PASS";

      const reportPath = join(dirname(fileURLToPath(import.meta.url)), ".last-run.json");
      writeFileSync(
        reportPath,
        JSON.stringify(
          {
            verdict: "PASS",
            heapGrowthRatio: growthRatio,
            maxConnections,
            baselineConnections,
            samples,
            monotonicHeapGrowth: growthRatio > MAX_HEAP_GROWTH_RATIO,
            poolExhaustion: maxConnections > MAX_APP_TOUR_CONNECTIONS,
          },
          null,
          2
        )
      );
    });
  }
);
