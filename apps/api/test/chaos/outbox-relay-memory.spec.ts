/**
 * Phase 5 hardened gate — outbox relay memory profile.
 *
 * Inserts 10_000 synthetic pending outbox rows, processes them via relay ticks,
 * samples heapUsed every SAMPLE_EVERY iterations. Bounded growth after GC indicates
 * no relay-path leak (handlers, Prisma clients, or unbounded dedupe buffers).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { resetDomainEventBusForTests } from "@app-tour/platform-events";
import { PrismaClient } from "@prisma/client";

import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { processOutboxRelayForTenantOnce } from "../../src/outbox/outbox-relay";
import { integrationTenantId } from "../test-helpers";
import { skipUnlessNightlyTier } from "../test-tier";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const ROW_COUNT = 10_000;
const BATCH_SIZE = 50;
const SAMPLE_EVERY = 500;
/** Allow 100% growth or 48MB absolute after post-run GC (full suite memory pressure). */
const MAX_HEAP_GROWTH_RATIO = 2.0;
const MAX_HEAP_ABS_GROWTH_MB = 48;

function sampleHeapMb(): number {
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

function forceGcIfAvailable(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  gc?.();
}

export type MemorySample = {
  readonly iteration: number;
  readonly heapMb: number;
};

/**
 * P5 hardened gate — relay processes 10k rows without unbounded heap growth.
 */
describe(
  "chaos outbox relay memory (integration)",
  {
    skip: !hasDatabase ? true : skipUnlessNightlyTier("10k outbox relay memory probe"),
    concurrency: false,
  },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    let admin: PrismaClient;
    const samples: MemorySample[] = [];

    before(async () => {
      await disconnectPrisma();
      resetDomainEventBusForTests();
      admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `mem-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      const rows = Array.from({ length: ROW_COUNT }, (_, index) => ({
        tenantId,
        aggregateType: "tour",
        aggregateId: randomUUID(),
        eventType: "TourCreated",
        payload: { tenantId, tourId: randomUUID(), index },
        status: "pending" as const,
        domainEventId: randomUUID(),
        correlationId: `mem-${runId}-${index}`,
      }));

      for (let offset = 0; offset < rows.length; offset += 500) {
        const batch = rows.slice(offset, offset + 500);
        const created = await admin.outboxEvent.createMany({ data: batch });
        assert.equal(
          created.count,
          batch.length,
          `createMany must insert full batch at offset ${offset}`
        );
      }

      const inserted = await admin.outboxEvent.count({ where: { tenantId } });
      assert.equal(inserted, ROW_COUNT, "all synthetic outbox rows must exist before relay");
    });

    after(async () => {
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("processes 10_000 relay ticks without monotonic heap leak", async () => {
      forceGcIfAvailable();
      const baselineHeapMb = sampleHeapMb();
      samples.push({ iteration: 0, heapMb: baselineHeapMb });

      let iteration = 0;

      async function unfinishedCount(): Promise<number> {
        return admin.outboxEvent.count({
          where: { tenantId, status: { in: ["pending", "processing"] } },
        });
      }

      while ((await unfinishedCount()) > 0) {
        iteration += 1;
        const result = await processOutboxRelayForTenantOnce(tenantId, BATCH_SIZE);

        const tenantFailed = await admin.outboxEvent.count({
          where: { tenantId, status: "failed" },
        });
        assert.equal(
          tenantFailed,
          0,
          `relay must not fail on synthetic TourCreated rows (tick failed=${result.failed})`
        );

        if (iteration % SAMPLE_EVERY === 0) {
          forceGcIfAvailable();
          samples.push({ iteration, heapMb: sampleHeapMb() });
        }
      }

      const doneCount = await admin.outboxEvent.count({
        where: { tenantId, status: "done" },
      });
      if (doneCount !== ROW_COUNT) {
        const breakdown = await admin.outboxEvent.groupBy({
          by: ["status"],
          where: { tenantId },
          _count: { _all: true },
        });
        assert.fail(
          `expected ${ROW_COUNT} done rows, got ${doneCount}: ${JSON.stringify(breakdown)}`
        );
      }

      forceGcIfAvailable();
      const finalHeapMb = sampleHeapMb();
      samples.push({ iteration: iteration + 1, heapMb: finalHeapMb });

      const absGrowthMb = finalHeapMb - baselineHeapMb;
      const growthRatio = finalHeapMb / baselineHeapMb;
      const withinRatio = growthRatio <= MAX_HEAP_GROWTH_RATIO;
      const withinAbsolute = absGrowthMb <= MAX_HEAP_ABS_GROWTH_MB;

      assert.ok(
        withinRatio || withinAbsolute,
        `heap growth ratio=${growthRatio.toFixed(3)} abs=${absGrowthMb.toFixed(1)}MB exceeds limits (ratio<=${MAX_HEAP_GROWTH_RATIO} or abs<=${MAX_HEAP_ABS_GROWTH_MB}MB; baseline=${baselineHeapMb.toFixed(1)}MB final=${finalHeapMb.toFixed(1)}MB)`
      );

      console.log(
        `[P5-MEMORY] baseline=${baselineHeapMb.toFixed(2)}MB final=${finalHeapMb.toFixed(2)}MB abs=+${absGrowthMb.toFixed(2)}MB ratio=${growthRatio.toFixed(3)} samples=${samples.length}`
      );
    });
  }
);
