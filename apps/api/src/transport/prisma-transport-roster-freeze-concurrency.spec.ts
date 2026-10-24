/** Real-PostgreSQL proof that transport replacement and roster freeze serialize. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma.ts";
import { resetTenantConnectionBudgetForTests } from "../db/tenant-connection-budget.ts";
import { PrismaBookingsRepository } from "../bookings/prisma-bookings.repository.ts";
import {
  freezePrismaTourRosterWithSnapshot,
  replacePrismaTransportAllocations,
} from "./prisma-transport-allocation.repository.ts";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const postgresSkip = hasDatabase
  ? false
  : "TRANSPORT_ROSTER_FREEZE_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN";

describe(
  "Prisma transport replacement versus roster freeze",
  {
    concurrency: false,
    skip: postgresSkip,
  },
  () => {
    const tenantId = randomUUID();
    const tourId = randomUUID();
    const actorUserId = randomUUID();
    const driverRegistrationId = randomUUID();
    const passengerRegistrationId = randomUUID();
    const pendingRegistrationId = randomUUID();
    const priorTenantMaxConcurrentDbOps = process.env.TENANT_MAX_CONCURRENT_DB_OPS;

    before(async () => {
      process.env.TENANT_MAX_CONCURRENT_DB_OPS = "16";
      resetTenantConnectionBudgetForTests();
      await disconnectPrisma();
      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `tr-freeze-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
      await admin.tour.create({
        data: {
          id: tourId,
          tenantId,
          title: "Transport freeze concurrency proof",
          canonical: { title: "Transport freeze concurrency proof" },
        },
      });
      const common = {
        tenantId,
        tourId,
        tourTitle: "Transport freeze concurrency proof",
        partySize: 1,
        paymentStatus: "unpaid",
        departureAt: new Date("2031-08-01T00:00:00.000Z"),
      };
      await admin.operatorRegistration.createMany({
        data: [
          {
            ...common,
            id: driverRegistrationId,
            guestLabel: "QA driver",
            status: "approved",
            submittedByUserId: randomUUID(),
            approvedAt: new Date(),
            registrationIntake: {
              transport: { kind: "personal_car", personalCarOccupants: 1 },
            },
          },
          {
            ...common,
            id: passengerRegistrationId,
            guestLabel: "QA dong passenger",
            status: "approved",
            submittedByUserId: randomUUID(),
            approvedAt: new Date(),
            registrationIntake: { transport: { kind: "no_car_dong" } },
          },
          {
            ...common,
            id: pendingRegistrationId,
            guestLabel: "QA pending approval",
            status: "pending",
            submittedByUserId: randomUUID(),
            approvedAt: null,
            registrationIntake: { transport: { kind: "no_car_dong" } },
          },
        ],
      });
    });

    after(async () => {
      const admin = getPrismaAdmin();
      try {
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.transportAllocation.deleteMany({ where: { tenantId, tourId } });
        await admin.transportRosterFreeze.deleteMany({ where: { tenantId, tourId } });
        await admin.operatorRegistration.deleteMany({ where: { tenantId, tourId } });
        await admin.tour.deleteMany({ where: { tenantId, id: tourId } });
        await admin.tenant.deleteMany({ where: { id: tenantId } });
      } finally {
        await disconnectPrisma();
        resetTenantConnectionBudgetForTests();
        if (priorTenantMaxConcurrentDbOps === undefined) {
          delete process.env.TENANT_MAX_CONCURRENT_DB_OPS;
        } else {
          process.env.TENANT_MAX_CONCURRENT_DB_OPS = priorTenantMaxConcurrentDbOps;
        }
      }
    });

    it("persists one serial outcome: allocation included in snapshot or rejected after freeze", async () => {
      const outcomes = await Promise.allSettled([
        replacePrismaTransportAllocations({
          tenantId,
          tourId,
          actorUserId,
          allocations: [{ driverRegistrationId, passengerRegistrationId }],
        }),
        freezePrismaTourRosterWithSnapshot({
          tenantId,
          tourId,
          actorUserId,
          driverCompensationPerSeatMinor: "100",
          currency: "IRR",
          nowIso: new Date().toISOString(),
        }),
        new PrismaBookingsRepository().approveWithOutbox({
          bookingId: pendingRegistrationId,
          tenantId,
          outboxEvent: "registration.approved",
        }),
      ]);

      const replacement = outcomes[0];
      const freeze = outcomes[1];
      const approval = outcomes[2];
      assert.ok(
        freeze?.status === "fulfilled",
        `roster freeze must complete: ${freeze?.status === "rejected" ? String(freeze.reason) : "missing outcome"}`
      );
      assert.ok(replacement !== undefined);

      const persistedAllocationCount = await getPrismaAdmin().transportAllocation.count({
        where: { tenantId, tourId },
      });
      const snapshotAllocationCount = freeze.value.snapshot.allocations.length;

      if (replacement.status === "fulfilled") {
        assert.equal(persistedAllocationCount, 1);
        assert.equal(snapshotAllocationCount, 1);
      } else {
        assert.equal((replacement.reason as { code?: string }).code, "TRANSPORT_ROSTER_FROZEN");
        assert.equal(persistedAllocationCount, 0);
        assert.equal(snapshotAllocationCount, 0);
      }
      assert.equal(persistedAllocationCount, snapshotAllocationCount);

      assert.ok(approval !== undefined);
      const frozenParticipantIds = new Set(
        freeze.value.snapshot.participants.map((participant) => participant.registrationId)
      );
      const storedPending = await getPrismaAdmin().operatorRegistration.findUniqueOrThrow({
        where: { id: pendingRegistrationId },
        select: { status: true },
      });
      if (approval.status === "fulfilled") {
        assert.equal(storedPending.status, "approved");
        assert.ok(
          frozenParticipantIds.has(pendingRegistrationId),
          "an approval serialized before freeze must be included in the immutable snapshot"
        );
      } else {
        assert.equal((approval.reason as { code?: string }).code, "BOOKING_ROSTER_FROZEN");
        assert.equal(storedPending.status, "pending");
        assert.equal(
          frozenParticipantIds.has(pendingRegistrationId),
          false,
          "an approval serialized after freeze must remain outside the roster and unapproved"
        );
      }
    });
  }
);
