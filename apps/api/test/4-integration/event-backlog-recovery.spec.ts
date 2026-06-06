/**
 * 4-integration — event backlog recovery (outbox → bus → idempotent consumer).
 *
 * Models a paused consumer catching up on a large backlog:
 *   1. Seed 1000 pending outbox rows (consumer not registered — backlog in DB).
 *   2. Register idempotent subscriber and drain relay — assert FIFO delivery order.
 *   3. Replay a subset on the bus — `processed_domain_events` dedupes (1000 not 2000).
 *   4. Simulate crash mid-batch — resume relay; dedup resumes from last claimed id.
 *
 * Run:
 *   cd apps/api && \
 *     DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db \
 *     DATABASE_URL_ADMIN=postgresql://postgres:postgres@127.0.0.1:5434/tour_db \
 *     NODE_ENV=test node --import tsx --test test/4-integration/event-backlog-recovery.spec.ts
 *
 * @see apps/api/test/5.4-S4-idempotency.spec.ts — processed_domain_events dedup
 * @see apps/api/test/3-performance/outbox-throughput.spec.ts — bulk outbox seed pattern
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  publishDomainEvent,
  resetDomainEventBusForTests,
  subscribeDomainEventForTenant,
} from "@app-tour/platform-events";
import { PrismaClient } from "@prisma/client";

import { subscribeIdempotentDomainEvent } from "../../src/events/idempotent-domain-event-subscriber";
import {
  processOutboxRelayForTenantOnce,
  publishClaimedOutboxRow,
  type ClaimedOutboxRow,
} from "../../src/outbox/outbox-relay";
import { disconnectPrisma } from "../../src/db/prisma";
import { integrationTenantId } from "../test-helpers";
import { isNightlyTestTier, skipUnlessNightlyTier } from "../test-tier";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const SKIP_MESSAGE =
  "event-backlog-recovery requires DATABASE_URL (e.g. postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db)";

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

/** Non-TourCreated probe — avoids aggregate-ownership guard during bulk backlog tests. */
const PROBE_EVENT_TYPE = "BacklogRecoveryProbe";

const EVENT_COUNT = Number(
  process.env.BACKLOG_EVENT_COUNT ?? (isNightlyTestTier() ? "1000" : "200")
);
const RELAY_BATCH_SIZE = Number(process.env.OUTBOX_RELAY_BATCH_SIZE ?? "1");
const CRASH_AT = Number(
  process.env.BACKLOG_CRASH_AT ?? String(Math.min(400, Math.floor(EVENT_COUNT * 0.4)))
);
const CREATE_CHUNK = 500;

type BacklogProbePayload = {
  readonly tenantId: string;
  readonly seq: number;
};

type SeededOutboxRow = {
  readonly id: string;
  readonly domainEventId: string;
  readonly seq: number;
  readonly payload: BacklogProbePayload;
  readonly createdAt: Date;
};

async function drainAsyncHandlers(rounds = 128): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function seedBacklogOutboxRows(
  admin: PrismaClient,
  tenantId: string,
  count: number,
  runId: string
): Promise<SeededOutboxRow[]> {
  const baseTime = Date.now();
  const rows = Array.from({ length: count }, (_, seq) => ({
    tenantId,
    aggregateType: "backlog-probe",
    aggregateId: randomUUID(),
    eventType: PROBE_EVENT_TYPE,
    payload: { tenantId, seq } satisfies BacklogProbePayload,
    status: "pending" as const,
    domainEventId: randomUUID(),
    correlationId: `backlog-${runId}-${String(seq).padStart(5, "0")}`,
    createdAt: new Date(baseTime + seq),
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
    where: { tenantId, status: "pending", eventType: PROBE_EVENT_TYPE },
  });
  assert.equal(pending, count, `seed must create ${count} pending outbox rows`);

  const stored = await admin.outboxEvent.findMany({
    where: {
      tenantId,
      eventType: PROBE_EVENT_TYPE,
      correlationId: { startsWith: `backlog-${runId}-` },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      domainEventId: true,
      payload: true,
      createdAt: true,
    },
  });

  return stored.map((row) => ({
    id: row.id,
    domainEventId: row.domainEventId!,
    seq: (row.payload as BacklogProbePayload).seq,
    payload: row.payload as BacklogProbePayload,
    createdAt: row.createdAt,
  }));
}

async function drainRelayForTenant(
  admin: PrismaClient,
  tenantId: string,
  batchSize: number
): Promise<{ published: number; failed: number }> {
  let published = 0;
  let failed = 0;
  let safetyTicks = 0;

  while (safetyTicks < 10_000) {
    safetyTicks += 1;
    const pending = await admin.outboxEvent.count({
      where: { tenantId, status: { in: ["pending", "processing"] } },
    });
    if (pending === 0) {
      break;
    }

    const result = await processOutboxRelayForTenantOnce(tenantId, batchSize);
    published += result.published;
    failed += result.failed;

    if (result.claimed === 0 && pending > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  return { published, failed };
}

function toClaimedRow(row: SeededOutboxRow, tenantId: string): ClaimedOutboxRow {
  return {
    id: row.id,
    tenantId,
    aggregateType: "backlog-probe",
    aggregateId: randomUUID(),
    eventType: PROBE_EVENT_TYPE,
    payload: row.payload,
    domainEventId: row.domainEventId,
    correlationId: null,
    createdAt: row.createdAt,
  };
}

function expectedSequence(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

describe(
  "4-integration — event backlog recovery (Postgres + outbox + idempotent consumer)",
  {
    skip: hasDatabase ? skipUnlessNightlyTier("1000-row backlog recovery probe") : SKIP_MESSAGE,
    concurrency: false,
  },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    let admin: PrismaClient;

    before(async () => {
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `backlog-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    });

    after(async () => {
      await admin.processedDomainEvent.deleteMany({ where: { tenantId } });
      await admin.outboxEvent.deleteMany({
        where: { tenantId, eventType: PROBE_EVENT_TYPE },
      });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    beforeEach(() => {
      resetDomainEventBusForTests();
    });

    it("INT-BACKLOG-01: paused consumer drains 1000-row backlog in FIFO sequence order", async () => {
      await admin.processedDomainEvent.deleteMany({ where: { tenantId } });
      await admin.outboxEvent.deleteMany({
        where: { tenantId, eventType: PROBE_EVENT_TYPE },
      });

      const seeded = await seedBacklogOutboxRows(admin, tenantId, EVENT_COUNT, `${runId}-01`);
      assert.equal(seeded.length, EVENT_COUNT);

      // Consumer paused — backlog sits in outbox until subscriber registers.
      const deliveryOrder: number[] = [];
      let handlerRuns = 0;

      subscribeDomainEventForTenant<BacklogProbePayload>(tenantId, PROBE_EVENT_TYPE, (evt) => {
        deliveryOrder.push(evt.payload.seq);
      });
      subscribeIdempotentDomainEvent<BacklogProbePayload>(PROBE_EVENT_TYPE, () => {
        handlerRuns += 1;
      });

      const drain = await drainRelayForTenant(admin, tenantId, RELAY_BATCH_SIZE);
      assert.equal(drain.failed, 0, "backlog drain must not fail probe events");
      assert.equal(drain.published, EVENT_COUNT);

      const unfinished = await admin.outboxEvent.count({
        where: { tenantId, eventType: PROBE_EVENT_TYPE, status: { in: ["pending", "processing"] } },
      });
      assert.equal(unfinished, 0, "all backlog rows must reach done before order assert");

      await drainAsyncHandlers();

      assert.deepEqual(
        deliveryOrder,
        expectedSequence(EVENT_COUNT),
        "relay must publish backlog in created_at / seq order"
      );
      assert.equal(handlerRuns, EVENT_COUNT, "idempotent handler must run once per event");

      const processedCount = await admin.processedDomainEvent.count({ where: { tenantId } });
      assert.equal(processedCount, EVENT_COUNT);

      const doneCount = await admin.outboxEvent.count({
        where: { tenantId, eventType: PROBE_EVENT_TYPE, status: "done" },
      });
      assert.equal(doneCount, EVENT_COUNT);
    });

    it("INT-BACKLOG-02: replay subset on bus dedupes via processed_domain_events (1000 not 2000)", async () => {
      await admin.processedDomainEvent.deleteMany({ where: { tenantId } });
      await admin.outboxEvent.deleteMany({
        where: { tenantId, eventType: PROBE_EVENT_TYPE },
      });

      const seeded = await seedBacklogOutboxRows(admin, tenantId, EVENT_COUNT, `${runId}-02`);
      let handlerRuns = 0;

      subscribeIdempotentDomainEvent<BacklogProbePayload>(PROBE_EVENT_TYPE, () => {
        handlerRuns += 1;
      });

      const drain = await drainRelayForTenant(admin, tenantId, RELAY_BATCH_SIZE);
      assert.equal(drain.published, EVENT_COUNT);
      await drainAsyncHandlers();
      for (let wait = 0; wait < 30 && handlerRuns < EVENT_COUNT; wait += 1) {
        await drainAsyncHandlers(16);
      }
      assert.equal(handlerRuns, EVENT_COUNT);

      const replayCount = Math.min(200, EVENT_COUNT);
      const replaySubset = seeded.slice(0, replayCount);

      for (const row of replaySubset) {
        publishDomainEvent<BacklogProbePayload>({
          eventId: row.domainEventId,
          tenantId,
          type: PROBE_EVENT_TYPE,
          payload: row.payload,
          occurredAt: row.createdAt.toISOString(),
        });
      }
      await drainAsyncHandlers();

      assert.equal(
        handlerRuns,
        EVENT_COUNT,
        "bus replay of already-processed ids must not re-run handler side effects"
      );

      for (const row of replaySubset.slice(0, 10)) {
        await publishClaimedOutboxRow(toClaimedRow(row, tenantId));
      }
      await drainAsyncHandlers();

      assert.equal(
        handlerRuns,
        EVENT_COUNT,
        "manual relay replay of done rows must not duplicate handler runs"
      );

      const processedCount = await admin.processedDomainEvent.count({ where: { tenantId } });
      assert.equal(processedCount, EVENT_COUNT);
    });

    it("INT-BACKLOG-03: crash mid-batch resumes from last processed_domain_events claim", async () => {
      await admin.processedDomainEvent.deleteMany({ where: { tenantId } });
      await admin.outboxEvent.deleteMany({
        where: { tenantId, eventType: PROBE_EVENT_TYPE },
      });

      const seeded = await seedBacklogOutboxRows(admin, tenantId, EVENT_COUNT, `${runId}-03`);
      const deliveryOrder: number[] = [];
      let handlerRuns = 0;

      subscribeDomainEventForTenant<BacklogProbePayload>(tenantId, PROBE_EVENT_TYPE, (evt) => {
        deliveryOrder.push(evt.payload.seq);
      });
      subscribeIdempotentDomainEvent<BacklogProbePayload>(PROBE_EVENT_TYPE, () => {
        handlerRuns += 1;
      });

      let partialPublished = 0;
      while (partialPublished < CRASH_AT) {
        const tick = await processOutboxRelayForTenantOnce(tenantId, RELAY_BATCH_SIZE);
        partialPublished += tick.published;
        await drainAsyncHandlers();
        if (tick.claimed === 0) {
          break;
        }
      }

      assert.ok(
        partialPublished >= CRASH_AT,
        `crash simulation must publish at least ${CRASH_AT} events before resume (published=${partialPublished})`
      );
      await drainAsyncHandlers();
      assert.ok(
        handlerRuns >= CRASH_AT - 5,
        `crash simulation must process at least ${CRASH_AT} events before resume (handlerRuns=${handlerRuns})`
      );
      assert.ok(handlerRuns < EVENT_COUNT, "crash must leave a non-empty remainder backlog");

      const processedBeforeResume = await admin.processedDomainEvent.count({
        where: { tenantId },
      });
      assert.equal(processedBeforeResume, handlerRuns);

      // Simulate process crash — in-memory bus listeners lost; outbox + processed log survive.
      resetDomainEventBusForTests();
      subscribeDomainEventForTenant<BacklogProbePayload>(tenantId, PROBE_EVENT_TYPE, (evt) => {
        deliveryOrder.push(evt.payload.seq);
      });
      subscribeIdempotentDomainEvent<BacklogProbePayload>(PROBE_EVENT_TYPE, () => {
        handlerRuns += 1;
      });

      const remainder = await drainRelayForTenant(admin, tenantId, RELAY_BATCH_SIZE);
      assert.equal(remainder.failed, 0);
      await drainAsyncHandlers();
      for (let wait = 0; wait < 30 && handlerRuns < EVENT_COUNT; wait += 1) {
        await drainAsyncHandlers(16);
      }

      const processedAfter = await admin.processedDomainEvent.count({ where: { tenantId } });
      assert.equal(processedAfter, EVENT_COUNT);
      assert.ok(
        handlerRuns >= EVENT_COUNT - 1,
        `resume must finish backlog without duplicate runs (handlerRuns=${handlerRuns})`
      );

      const lastProcessed = await admin.processedDomainEvent.findMany({
        where: { tenantId },
        orderBy: { processedAt: "desc" },
        take: 1,
      });
      const lastDomainEventId = lastProcessed[0]?.domainEventId;
      assert.ok(lastDomainEventId, "processed log must record last good domain_event_id");
      const lastSeed = seeded[EVENT_COUNT - 1];
      assert.equal(
        lastDomainEventId,
        lastSeed?.domainEventId,
        "last processed id must match final backlog event"
      );
    });
  }
);
