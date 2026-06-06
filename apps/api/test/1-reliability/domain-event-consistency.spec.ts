/**
 * Reliability / security pentest — TourCreated tenant consistency on the in-process bus
 * and outbox relay.
 *
 * Attack model: publish TourCreated where `payload.tenantId` disagrees with envelope
 * `tenantId`, or `tourId` belongs to another tenant (aggregate ownership violation).
 *
 * Expected: rejection before idempotent claim / read-model side effects.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";
import { publishDomainEvent, resetDomainEventBusForTests } from "@app-tour/platform-events";

import {
  SecurityViolation,
  assertTourCreatedEnvelopeTenantParity,
} from "../../src/events/tour-created-envelope-guard";
import { subscribeIdempotentDomainEvent } from "../../src/events/idempotent-domain-event-subscriber";
import {
  processOutboxRelayForTenantOnce,
  publishClaimedOutboxRow,
  type ClaimedOutboxRow,
} from "../../src/outbox/outbox-relay";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

async function drainAsyncHandlers(rounds = 24): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function isSecurityViolation(error: unknown): boolean {
  return error instanceof SecurityViolation || (error as Error)?.name === "SecurityViolation";
}

describe("1-reliability — domain event tenant consistency (pentest)", () => {
  beforeEach(() => {
    resetDomainEventBusForTests();
  });

  it("PENTEST-EVT-01: malicious bus publish (payload tenant ≠ envelope) throws SecurityViolation", () => {
    const ownerTenant = "tenant-owner";
    const attackerTenant = "tenant-attacker";
    const tourId = randomUUID();
    const projectionWrites: string[] = [];

    assert.throws(
      () =>
        assertTourCreatedEnvelopeTenantParity(
          publishDomainEvent({
            tenantId: ownerTenant,
            type: "TourCreated",
            payload: { tourId, tenantId: attackerTenant },
          })
        ),
      (error: unknown) => isSecurityViolation(error)
    );

    assert.deepEqual(projectionWrites, []);
  });

  it("PENTEST-EVT-02: idempotent subscriber rejects bus publish before processed log / side effects", async () => {
    const ownerTenant = integrationTenantId();
    const attackerTenant = integrationTenantId();
    const tourId = randomUUID();
    const domainEventId = randomUUID();
    const readModelWrites: string[] = [];

    subscribeIdempotentDomainEvent("TourCreated", () => {
      readModelWrites.push(tourId);
    });

    publishDomainEvent({
      eventId: domainEventId,
      tenantId: ownerTenant,
      type: "TourCreated",
      payload: { tourId, tenantId: attackerTenant },
    });

    await drainAsyncHandlers();

    if (hasDatabase) {
      const admin = getPrismaAdmin();
      const processedCount = await admin.processedDomainEvent.count({
        where: { tenantId: ownerTenant, domainEventId },
      });
      assert.equal(processedCount, 0, "malicious delivery must not claim processed_domain_events");
      await admin.processedDomainEvent.deleteMany({
        where: { tenantId: ownerTenant, domainEventId },
      });
      await disconnectPrisma();
    }

    assert.deepEqual(readModelWrites, [], "read-model handler must not run");
  });
});

describe(
  "1-reliability — domain event consistency (Postgres aggregate ownership)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const ownerTenant = integrationTenantId();
    const attackerTenant = integrationTenantId();
    const tourId = randomUUID();
    const domainEventId = randomUUID();
    const outboxRowId = randomUUID();
    let admin: PrismaClient;

    before(async () => {
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      for (const [tenantId, label] of [
        [ownerTenant, "owner"],
        [attackerTenant, "attacker"],
      ] as const) {
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `evt-${label}-${tenantId.slice(0, 8)}`,
            workspaceType: "starter",
            theme: {},
          },
        });
      }

      await admin.tour.create({
        data: {
          id: tourId,
          tenantId: ownerTenant,
          canonical: {
            schemaVersion: 1,
            roots: ["basics"],
            data: { basics: { title: "owned-by-owner" } },
          },
        },
      });
    });

    after(async () => {
      await admin.processedDomainEvent.deleteMany({
        where: { tenantId: { in: [ownerTenant, attackerTenant] } },
      });
      await admin.outboxEvent.deleteMany({
        where: { tenantId: { in: [ownerTenant, attackerTenant] } },
      });
      await admin.tour.deleteMany({
        where: { tenantId: { in: [ownerTenant, attackerTenant] } },
      });
      await admin.tenant.deleteMany({
        where: { id: { in: [ownerTenant, attackerTenant] } },
      });
      await admin.$disconnect();
      await disconnectPrisma();
    });

    beforeEach(() => {
      resetDomainEventBusForTests();
    });

    it("PENTEST-EVT-03: bus publish with foreign envelope tenant vs tour owner → SecurityViolation", async () => {
      const readModelWrites: string[] = [];

      subscribeIdempotentDomainEvent("TourCreated", () => {
        readModelWrites.push(tourId);
      });

      publishDomainEvent({
        eventId: domainEventId,
        tenantId: attackerTenant,
        type: "TourCreated",
        payload: { tourId, tenantId: attackerTenant },
      });

      await drainAsyncHandlers();

      const processedCount = await admin.processedDomainEvent.count({
        where: { tenantId: attackerTenant, domainEventId },
      });
      assert.equal(processedCount, 0);
      assert.deepEqual(readModelWrites, []);
    });

    it("PENTEST-EVT-04: relay rejects outbox row when payload.tenantId ≠ row tenant_id", async () => {
      const createdAt = new Date();
      await admin.outboxEvent.create({
        data: {
          id: outboxRowId,
          tenantId: ownerTenant,
          aggregateType: "tour",
          aggregateId: tourId,
          eventType: "TourCreated",
          payload: { tenantId: attackerTenant, tourId },
          status: "pending",
          domainEventId: randomUUID(),
        },
      });

      const row = await admin.outboxEvent.findUniqueOrThrow({ where: { id: outboxRowId } });
      const claimed: ClaimedOutboxRow = {
        id: row.id,
        tenantId: row.tenantId,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        eventType: row.eventType,
        payload: row.payload,
        domainEventId: row.domainEventId!,
        correlationId: row.correlationId,
        createdAt: row.createdAt ?? createdAt,
      };

      await assert.rejects(
        () => publishClaimedOutboxRow(claimed),
        /OUTBOX_TENANT_PAYLOAD_MISMATCH/
      );

      const stillPending = await admin.outboxEvent.findUnique({ where: { id: outboxRowId } });
      assert.equal(
        stillPending?.status,
        "pending",
        "direct publishClaimedOutboxRow must not mutate row status"
      );

      await admin.outboxEvent.update({
        where: { id: outboxRowId },
        data: { status: "pending" },
      });

      const tick = await processOutboxRelayForTenantOnce(ownerTenant, 20);
      assert.ok(tick.failed >= 1, "relay batch must count mismatched payload as failed");

      const afterRelay = await admin.outboxEvent.findUnique({ where: { id: outboxRowId } });
      assert.equal(afterRelay?.status, "failed", "relay batch must mark mismatched row failed");
    });
  }
);
