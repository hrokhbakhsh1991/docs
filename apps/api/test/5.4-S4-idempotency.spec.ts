import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { Prisma } from "@prisma/client";
import { resetDomainEventBusForTests } from "@app-tour/platform-events";

import { subscribeIdempotentDomainEvent } from "../src/events/idempotent-domain-event-subscriber";
import {
  claimPendingOutboxBatchForTenant,
  processOutboxRelayForTenantOnce,
  publishClaimedOutboxRow,
  type ClaimedOutboxRow,
} from "../src/outbox/outbox-relay";
import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import {
  drainDomainEventHandlers,
  integrationTenantId,
  preparePostgresOutboxIsolation,
  quiesceStaleOutboxProcessing,
} from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/**
 * P5-4-S4 — UNIQUE (tenant_id, domain_event_id) on outbox; idempotent subscribers via processed log.
 */
describe(
  "5.4-S4 outbox idempotency (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const domainEventId = randomUUID();
    const tourId = randomUUID();
    let admin: ReturnType<typeof getPrismaAdmin>;

    beforeEach(async () => {
      resetDomainEventBusForTests();
      delete process.env.OUTBOX_PROCESSING_RECLAIM_MS;
      await preparePostgresOutboxIsolation();
    });

    before(async () => {
      await preparePostgresOutboxIsolation();
      admin = getPrismaAdmin();
      await admin.outboxEvent.deleteMany({
        where: { tenantId, status: { in: ["pending", "processing"] } },
      });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `idem-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    });

    after(async () => {
      await admin.processedDomainEvent.deleteMany({ where: { tenantId } });
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
      await disconnectPrisma();
    });

    it("rejects duplicate outbox insert for same tenant_id + domain_event_id", async () => {
      const base = {
        tenantId,
        aggregateType: "tour",
        aggregateId: tourId,
        eventType: "TourCreated",
        payload: { tenantId, tourId },
        status: "pending" as const,
        domainEventId,
      };

      await admin.outboxEvent.create({ data: base });

      await assert.rejects(
        () =>
          admin.outboxEvent.create({
            data: { ...base, aggregateId: randomUUID() },
          }),
        (error: unknown) => {
          return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        }
      );

      const count = await admin.outboxEvent.count({
        where: { tenantId, domainEventId },
      });
      assert.equal(count, 1);

      await admin.outboxEvent.deleteMany({ where: { tenantId, domainEventId } });
    });

    it("double relay delivery runs subscriber side-effect only once", async () => {
      resetDomainEventBusForTests();
      const relayDomainEventId = randomUUID();
      const relayTourId = randomUUID();
      const sideEffects: string[] = [];

      subscribeIdempotentDomainEvent("TourCreated", (evt) => {
        sideEffects.push(evt.eventId);
      });

      await admin.outboxEvent.deleteMany({
        where: { tenantId, status: { in: ["pending", "processing"] } },
      });
      await quiesceStaleOutboxProcessing(0);
      await admin.processedDomainEvent.deleteMany({ where: { tenantId } });

      await admin.tour.create({
        data: {
          id: relayTourId,
          tenantId,
          canonical: {
            schemaVersion: 1,
            roots: ["basics"],
            data: { basics: { title: "idem-relay" } },
          },
        },
      });

      const row = await admin.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "tour",
          aggregateId: relayTourId,
          eventType: "TourCreated",
          payload: { tenantId, tourId: relayTourId },
          status: "pending",
          domainEventId: relayDomainEventId,
        },
      });

      const firstTick = await processOutboxRelayForTenantOnce(tenantId, 1);
      assert.equal(firstTick.claimed, 1, "relay must claim the inserted pending row");
      assert.equal(firstTick.published, 1);
      assert.equal(firstTick.deferred, 0);
      await drainDomainEventHandlers();

      const doneRow = await admin.outboxEvent.findUnique({ where: { id: row.id } });
      assert.equal(doneRow?.status, "done", "relay must process the inserted row");
      assert.deepEqual(sideEffects, [relayDomainEventId]);

      const claimed: ClaimedOutboxRow = {
        id: row.id,
        tenantId: row.tenantId,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        eventType: row.eventType,
        payload: row.payload,
        domainEventId: row.domainEventId!,
        correlationId: row.correlationId,
        createdAt: row.createdAt,
      };

      await publishClaimedOutboxRow(claimed);
      await drainDomainEventHandlers();
      assert.deepEqual(
        sideEffects,
        [relayDomainEventId],
        "second relay publish must not re-run idempotent handler"
      );

      const processedCount = await admin.processedDomainEvent.count({
        where: { tenantId, domainEventId: relayDomainEventId },
      });
      assert.equal(processedCount, 1);

      const secondTick = await processOutboxRelayForTenantOnce(tenantId, 10);
      assert.equal(secondTick.claimed, 0, "done rows must not be claimed again");

      await admin.outboxEvent.deleteMany({ where: { id: row.id } });
      await admin.processedDomainEvent.deleteMany({
        where: { tenantId, domainEventId: relayDomainEventId },
      });
      await admin.tour.deleteMany({ where: { id: relayTourId } });
    });

    it("parallel claim + idempotent handler still yields one side-effect", async () => {
      resetDomainEventBusForTests();
      const parallelDomainEventId = randomUUID();
      const parallelTourId = randomUUID();
      const deliveries: string[] = [];

      subscribeIdempotentDomainEvent("TourCreated", (evt) => {
        deliveries.push(evt.eventId);
      });

      await admin.outboxEvent.deleteMany({
        where: { tenantId, status: { in: ["pending", "processing"] } },
      });
      await quiesceStaleOutboxProcessing(0);
      await admin.processedDomainEvent.deleteMany({ where: { tenantId } });

      await admin.tour.create({
        data: {
          id: parallelTourId,
          tenantId,
          canonical: {
            schemaVersion: 1,
            roots: ["basics"],
            data: { basics: { title: "idem-parallel" } },
          },
        },
      });

      const inserted = await admin.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "tour",
          aggregateId: parallelTourId,
          eventType: "TourCreated",
          payload: { tenantId, tourId: parallelTourId },
          status: "pending",
          domainEventId: parallelDomainEventId,
        },
      });

      const [batchA, batchB] = await Promise.all([
        claimPendingOutboxBatchForTenant(tenantId, 1),
        claimPendingOutboxBatchForTenant(tenantId, 1),
      ]);
      const claimed =
        batchA.find((row) => row.id === inserted.id) ??
        batchB.find((row) => row.id === inserted.id);
      assert.ok(claimed, "SKIP LOCKED must claim the inserted pending row");

      await Promise.all([publishClaimedOutboxRow(claimed), publishClaimedOutboxRow(claimed)]);
      await drainDomainEventHandlers();

      assert.deepEqual(deliveries, [parallelDomainEventId]);

      await admin.outboxEvent.deleteMany({
        where: { tenantId, domainEventId: parallelDomainEventId },
      });
      await admin.tour.deleteMany({ where: { id: parallelTourId } });
    });
  }
);
