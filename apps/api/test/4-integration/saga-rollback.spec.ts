/**
 * 4-integration — saga rollback / partial success after TourCreated delivery.
 *
 * Models canonical write success + outbox relay delivery + downstream read-model
 * projection failure. The canonical tour row and outbox `done` state are committed;
 * the idempotent handler claims `processed_domain_events` then throws — leaving an
 * inconsistency that must be surfaced for manual reconciliation (not silently retried).
 *
 * Retry policy under test:
 *   - Outbox relay marks rows `done` after bus publish; it does not re-claim `done` rows.
 *   - Publish-time failures (payload mismatch) mark `failed` — not infinite `pending`.
 *   - Idempotent subscribers skip re-execution on replay (`processed_domain_events` UNIQUE).
 *
 * Run (full Postgres path):
 *   cd apps/api && DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db \
 *     STORAGE_DRIVER=prisma NODE_ENV=test node --import tsx --test test/4-integration/saga-rollback.spec.ts
 *
 * Memory partial path runs without DATABASE_URL (bus-level projection failure only).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import type { DomainEventEnvelope } from "@app-tour/platform-events";
import { resetDomainEventBusForTests, subscribeDomainEvent } from "@app-tour/platform-events";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { PrismaClient } from "@prisma/client";

import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import type { TourCreatedEventPayload } from "../../src/events/tour-created-envelope-guard";
import { subscribeIdempotentDomainEvent } from "../../src/events/idempotent-domain-event-subscriber";
import {
  getProjectionInconsistencySignalsForTests,
  projectionInconsistencyFromEnvelope,
  recordProjectionInconsistency,
  resetProjectionInconsistencySignalsForTests,
} from "../../src/events/projection-reconciliation";
import { PROJECTION_HANDLER_FAILED } from "../../src/observability/log-safety";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import {
  processOutboxRelayForTenantOnce,
  publishClaimedOutboxRow,
  type ClaimedOutboxRow,
} from "../../src/outbox/outbox-relay";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { ToursService } from "../../src/tours/tours.service";
import {
  createTestToursService,
  drainDomainEventHandlers,
  integrationTenantId,
  preparePostgresOutboxIsolation,
  quiesceStaleOutboxProcessing,
} from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const PROJECTION_FAILURE = "READ_MODEL_PROJECTION_FAILED";

const VALID_TOUR_BODY = {
  data: { basics: { title: "saga-rollback-partial" }, details: { summary: "ok" } },
} as const;

function authForTenant(tenantId: string): TenantAuthContext {
  return {
    userId: "saga-rollback-user",
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-saga-rollback",
  };
}

function registerFailingReadModelHandler(): void {
  subscribeIdempotentDomainEvent<TourCreatedEventPayload>("TourCreated", async () => {
    throw new Error(PROJECTION_FAILURE);
  });
}

/** Memory path — non-idempotent bus subscriber (no processed log without Postgres). */
function registerFailingReadModelHandlerMemory(): void {
  subscribeDomainEvent<TourCreatedEventPayload>("TourCreated", async (evt) => {
    recordProjectionInconsistency(
      projectionInconsistencyFromEnvelope(evt, PROJECTION_HANDLER_FAILED, PROJECTION_FAILURE)
    );
  });
}

describe("4-integration — saga rollback / partial success (memory partial)", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  beforeEach(() => {
    resetDomainEventBusForTests();
    resetProjectionInconsistencySignalsForTests();
    process.env.STORAGE_DRIVER = "memory";
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
  });

  it("INT-SAGA-MEM-01: createTour succeeds while downstream projection failure is captured", async () => {
    const tenantId = integrationTenantId();
    const projectionMarkers: string[] = [];
    const capturedEvents: DomainEventEnvelope<TourCreatedEventPayload>[] = [];

    subscribeDomainEvent<TourCreatedEventPayload>("TourCreated", (evt) => {
      capturedEvents.push(evt);
    });
    registerFailingReadModelHandlerMemory();

    const service = createTestToursService();
    const record = await service.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY });

    await drainDomainEventHandlers();

    assert.equal(capturedEvents.length, 1, "TourCreated must publish after successful persist");
    assert.equal(capturedEvents[0]?.payload.tourId, record.id);
    const inconsistencySignals = getProjectionInconsistencySignalsForTests();
    assert.equal(
      inconsistencySignals.length,
      1,
      "downstream projection failure must emit reconciliation signal on the bus path"
    );
    assert.deepEqual(
      projectionMarkers,
      [],
      "read-model marker must not be set when projection throws"
    );
  });
});

describe(
  "4-integration — saga rollback / partial success (Postgres + outbox)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    let admin: PrismaClient;
    let service: ToursService;
    const projectionMarkers: string[] = [];
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    const priorAutoReconcile = process.env.PROJECTION_AUTO_RECONCILE_ENABLED;
    const priorRelay = process.env.OUTBOX_RELAY_ENABLED;

    before(async () => {
      await preparePostgresOutboxIsolation();
      process.env.STORAGE_DRIVER = "prisma";
      process.env.PROJECTION_AUTO_RECONCILE_ENABLED = "false";
      process.env.OUTBOX_RELAY_ENABLED = "false";
      await disconnectPrisma();
      admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `saga-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      service = new ToursService(
        new CanonicalTourService(
          new TourStorageDbAdapter(createTourStorageRepository()),
          new LegacyCanonicalAdapter()
        )
      );
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
      if (priorAutoReconcile === undefined) {
        delete process.env.PROJECTION_AUTO_RECONCILE_ENABLED;
      } else {
        process.env.PROJECTION_AUTO_RECONCILE_ENABLED = priorAutoReconcile;
      }
      if (priorRelay === undefined) {
        delete process.env.OUTBOX_RELAY_ENABLED;
      } else {
        process.env.OUTBOX_RELAY_ENABLED = priorRelay;
      }
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        await admin.processedDomainEvent.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.auditEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await disconnectPrisma();
    });

    describe("with failing projection handler", () => {
      beforeEach(async () => {
        resetDomainEventBusForTests();
        resetProjectionInconsistencySignalsForTests();
        projectionMarkers.length = 0;
        process.env.OUTBOX_RELAY_ENABLED = "false";
        await quiesceStaleOutboxProcessing(0);
        registerFailingReadModelHandler();
      });

      it("INT-SAGA-01: canonical persist succeeds; relay delivers; projection failure leaves partial success", async () => {
        const markerTitle = `saga-partial-${runId}`;
        const body = {
          data: { basics: { title: markerTitle }, details: { summary: "ok" } },
        } as const;

        const record = await service.createTour(authForTenant(tenantId), body);

        const tour = await admin.tour.findUnique({
          where: { tenantId_id: { tenantId, id: record.id } },
        });
        assert.ok(tour, "canonical tour row must exist after successful createTour");
        assert.equal(tour.title, markerTitle);

        const outbox = await admin.outboxEvent.findFirst({
          where: {
            tenantId,
            aggregateId: record.id,
            eventType: "TourCreated",
          },
        });
        assert.ok(outbox, "outbox row must be enqueued in the same atomic TX");
        assert.equal(outbox.status, "pending");
        assert.ok(outbox.domainEventId, "domain_event_id required for idempotent delivery");

        await quiesceStaleOutboxProcessing(0);
        const firstRelay = await processOutboxRelayForTenantOnce(tenantId, 10);
        assert.equal(firstRelay.claimed, 1);
        assert.equal(firstRelay.published, 1);
        assert.equal(firstRelay.failed, 0);

        await drainDomainEventHandlers(128);

        const relayed = await admin.outboxEvent.findUnique({ where: { id: outbox.id } });
        assert.equal(
          relayed?.status,
          "done",
          "relay marks outbox done after bus publish — not stuck pending/processing"
        );
        assert.ok(relayed?.processedAt, "done row must carry processedAt");

        const processedCount = await admin.processedDomainEvent.count({
          where: { tenantId, domainEventId: outbox.domainEventId! },
        });
        assert.equal(
          processedCount,
          1,
          "handler claimed processed log before throwing — partial success vs outbox done"
        );

        const inconsistencySignals = getProjectionInconsistencySignalsForTests();
        assert.equal(
          inconsistencySignals.length,
          1,
          "projection failure must emit reconciliation signal for manual ops"
        );
        assert.equal(inconsistencySignals[0]?.tenantId, tenantId);
        assert.equal(inconsistencySignals[0]?.domainEventId, outbox.domainEventId);
        assert.equal(inconsistencySignals[0]?.tourId, record.id);
        assert.equal(inconsistencySignals[0]?.reasonCode, PROJECTION_HANDLER_FAILED);
        assert.equal(inconsistencySignals[0]?.reason, PROJECTION_FAILURE);
        assert.deepEqual(projectionMarkers, [], "projection side-effect must not complete");

        for (let tick = 0; tick < 5; tick += 1) {
          const retry = await processOutboxRelayForTenantOnce(tenantId, 10);
          assert.equal(retry.claimed, 0, `relay tick ${tick + 1} must not re-claim done row`);
          assert.equal(retry.published, 0);
          assert.equal(retry.failed, 0);
        }

        const stuck = await admin.outboxEvent.count({
          where: {
            tenantId,
            id: outbox.id,
            status: { in: ["pending", "processing"] },
          },
        });
        assert.equal(stuck, 0, "outbox must not remain pending/processing after relay");
      });

      it("INT-SAGA-02: manual replay does not duplicate processed log or inconsistency signals", async () => {
        const record = await service.createTour(authForTenant(tenantId), {
          data: { basics: { title: `saga-replay-${runId}` }, details: { summary: "ok" } },
        });

        const outbox = await admin.outboxEvent.findFirstOrThrow({
          where: { tenantId, aggregateId: record.id, eventType: "TourCreated" },
        });

        await processOutboxRelayForTenantOnce(tenantId, 10);
        await drainDomainEventHandlers(64);

        let pending = await admin.outboxEvent.count({
          where: { tenantId, status: { in: ["pending", "processing"] } },
        });
        let safety = 0;
        while (pending > 0 && safety < 100) {
          safety += 1;
          await processOutboxRelayForTenantOnce(tenantId, 10);
          await drainDomainEventHandlers(64);
          pending = await admin.outboxEvent.count({
            where: { tenantId, status: { in: ["pending", "processing"] } },
          });
        }

        const relayedRow = await admin.outboxEvent.findUniqueOrThrow({ where: { id: outbox.id } });
        assert.equal(relayedRow.status, "done");

        const processedBeforeReplay = await admin.processedDomainEvent.count({
          where: { tenantId, domainEventId: outbox.domainEventId! },
        });
        assert.equal(processedBeforeReplay, 1);
        assert.equal(getProjectionInconsistencySignalsForTests().length, 1);

        const row = await admin.outboxEvent.findUniqueOrThrow({ where: { id: outbox.id } });
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

        const processedCount = await admin.processedDomainEvent.count({
          where: { tenantId, domainEventId: outbox.domainEventId! },
        });
        assert.equal(processedCount, 1, "idempotent claim must not duplicate on replay");
        assert.equal(
          getProjectionInconsistencySignalsForTests().length,
          1,
          "non-idempotent failed projection must not re-log on idempotent replay"
        );
      });
    });

    it("INT-SAGA-03: publish-time failure marks outbox failed — handler never claims processed log", async () => {
      resetDomainEventBusForTests();
      resetProjectionInconsistencySignalsForTests();
      const attackerTenant = integrationTenantId();
      await admin.tenant.create({
        data: {
          id: attackerTenant,
          subdomain: `saga-att-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      const tourId = randomUUID();
      const outboxRowId = randomUUID();
      const domainEventId = randomUUID();

      await admin.tour.create({
        data: {
          id: tourId,
          tenantId,
          canonical: {
            schemaVersion: 1,
            roots: ["basics"],
            data: { basics: { title: "saga-failed-outbox" } },
          },
        },
      });

      await admin.outboxEvent.create({
        data: {
          id: outboxRowId,
          tenantId,
          aggregateType: "tour",
          aggregateId: tourId,
          eventType: "TourCreated",
          payload: { tenantId: attackerTenant, tourId },
          status: "pending",
          domainEventId,
        },
      });

      const tick = await processOutboxRelayForTenantOnce(tenantId, 20);
      assert.ok(tick.failed >= 1, "payload mismatch must count as relay failure");

      const row = await admin.outboxEvent.findUnique({ where: { id: outboxRowId } });
      assert.equal(
        row?.status,
        "failed",
        "publish failure must land in failed — not infinite pending"
      );
      assert.ok(row?.processedAt, "failed row must carry processedAt for ops visibility");

      await drainDomainEventHandlers(128);

      const processedCount = await admin.processedDomainEvent.count({
        where: { tenantId, domainEventId },
      });
      assert.equal(
        processedCount,
        0,
        "handler must not claim processed log when TourCreated never delivered"
      );
      assert.equal(
        getProjectionInconsistencySignalsForTests().length,
        0,
        "no reconciliation signal when event was not emitted to bus"
      );

      for (let retry = 0; retry < 3; retry += 1) {
        const again = await processOutboxRelayForTenantOnce(tenantId, 20);
        assert.equal(again.claimed, 0, "failed rows must not be re-claimed by relay");
      }

      await admin.outboxEvent.deleteMany({ where: { id: outboxRowId } });
      await admin.tour.deleteMany({ where: { id: tourId } });
      await admin.tenant.delete({ where: { id: attackerTenant } });
    });
  }
);
