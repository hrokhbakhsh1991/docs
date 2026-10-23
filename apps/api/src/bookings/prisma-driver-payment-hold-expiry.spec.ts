/** Real-PostgreSQL proof for mixed-payment carpool driver-hold expiry. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma.ts";
import { resetTenantConnectionBudgetForTests } from "../db/tenant-connection-budget.ts";
import { PrismaBookingsRepository } from "./prisma-bookings.repository.ts";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const postgresSkip = hasDatabase
  ? false
  : "DRIVER_PAYMENT_HOLD_POSTGRES_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN";

describe(
  "Prisma mixed-payment driver payment-hold expiry",
  { concurrency: false, skip: postgresSkip },
  () => {
    const tenantId = randomUUID();
    const tourId = randomUUID();
    const driverId = randomUUID();
    const unpaidRiderId = randomUUID();
    const partialRiderId = randomUUID();
    const paidRiderId = randomUUID();
    const actorId = randomUUID();
    const holdIds = [driverId, unpaidRiderId, partialRiderId, paidRiderId].map(() => randomUUID());
    const dueAt = new Date(Date.now() - 60_000);
    const repository = new PrismaBookingsRepository();

    before(async () => {
      process.env.TENANT_MAX_CONCURRENT_DB_OPS = "16";
      resetTenantConnectionBudgetForTests();
      await disconnectPrisma();
      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `driver-expiry-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
      await admin.tour.create({
        data: { id: tourId, tenantId, title: "Driver expiry mixed-payment proof", canonical: {} },
      });
      await admin.operatorRegistration.createMany({
        data: [
          {
            id: driverId,
            tenantId,
            tourId,
            tourTitle: "Driver expiry mixed-payment proof",
            guestLabel: "QA driver unpaid",
            partySize: 1,
            status: "approved",
            paymentStatus: "unpaid",
            departureAt: new Date("2032-06-01T00:00:00.000Z"),
            submittedByUserId: actorId,
            approvedAt: new Date(),
            registrationIntake: {
              transport: { kind: "personal_car", personalCarOccupants: 3 },
              tourCapacityMax: 10,
            },
          },
          ...[
            { id: unpaidRiderId, label: "QA assigned rider unpaid", paymentStatus: "unpaid" },
            { id: partialRiderId, label: "QA assigned rider partial", paymentStatus: "partial" },
            { id: paidRiderId, label: "QA assigned rider paid", paymentStatus: "paid" },
          ].map((rider) => ({
            id: rider.id,
            tenantId,
            tourId,
            tourTitle: "Driver expiry mixed-payment proof",
            guestLabel: rider.label,
            partySize: 1,
            status: "approved",
            paymentStatus: rider.paymentStatus,
            departureAt: new Date("2032-06-01T00:00:00.000Z"),
            submittedByUserId: randomUUID(),
            approvedAt: new Date(),
            registrationIntake: { transport: { kind: "no_car_dong" }, tourCapacityMax: 10 },
          })),
        ],
      });
      await admin.financePaymentHold.createMany({
        data: [driverId, unpaidRiderId, partialRiderId, paidRiderId].map(
          (registrationId, index) => ({
            id: holdIds[index],
            tenantId,
            registrationId,
            status: "open",
            dueAt,
            policyHours: 24,
          })
        ),
      });
      await admin.transportAllocation.createMany({
        data: [unpaidRiderId, partialRiderId, paidRiderId].map((passengerRegistrationId) => ({
          tenantId,
          tourId,
          driverRegistrationId: driverId,
          passengerRegistrationId,
          createdByUserId: actorId,
        })),
      });
    });

    after(async () => {
      const admin = getPrismaAdmin();
      try {
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.transportAllocation.deleteMany({ where: { tenantId, tourId } });
        await admin.financePaymentHold.deleteMany({ where: { tenantId } });
        await admin.operatorRegistration.deleteMany({ where: { tenantId, tourId } });
        await admin.tour.deleteMany({ where: { tenantId, id: tourId } });
        // Cancellation audit events are append-only; keep this isolated QA
        // tenant until the disposable PostgreSQL database is stopped.
      } finally {
        await disconnectPrisma();
        resetTenantConnectionBudgetForTests();
        delete process.env.TENANT_MAX_CONCURRENT_DB_OPS;
      }
    });

    it("waitlists only the unpaid rider and defers expiry without disturbing paid dependencies", async () => {
      let capacityAssertionCalls = 0;
      const outcome = await repository.expireDriverHoldWithUnpaidPassengers({
        tenantId,
        tourId,
        driverBookingId: driverId,
        driverHoldId: holdIds[0]!,
        expectedDueAt: dueAt.toISOString(),
        assertCapacityAfterRemovalInTx: () => {
          capacityAssertionCalls += 1;
          throw new Error("capacity-after-removal must not run when driver expiry is deferred");
        },
      });

      assert.equal(outcome?.status, "deferred");
      assert.equal(capacityAssertionCalls, 0);
      const admin = getPrismaAdmin();
      const bookings = await admin.operatorRegistration.findMany({
        where: { tenantId, tourId },
        select: { id: true, status: true, paymentStatus: true },
      });
      const statusById = new Map(bookings.map((row) => [row.id, row]));
      assert.equal(statusById.get(driverId)?.status, "approved");
      assert.equal(statusById.get(unpaidRiderId)?.status, "waitlisted");
      assert.equal(statusById.get(partialRiderId)?.status, "approved");
      assert.equal(statusById.get(paidRiderId)?.status, "approved");

      const holds = await admin.financePaymentHold.findMany({
        where: { tenantId },
        select: { registrationId: true, status: true },
      });
      const holdStatusByRegistration = new Map(
        holds.map((row) => [row.registrationId, row.status])
      );
      assert.equal(holdStatusByRegistration.get(driverId), "open");
      assert.equal(holdStatusByRegistration.get(unpaidRiderId), "expired");
      assert.equal(holdStatusByRegistration.get(partialRiderId), "open");
      assert.equal(holdStatusByRegistration.get(paidRiderId), "open");

      const allocations = await admin.transportAllocation.findMany({
        where: { tenantId, tourId },
        select: { passengerRegistrationId: true },
      });
      assert.deepEqual(
        allocations.map((row) => row.passengerRegistrationId).sort(),
        [partialRiderId, paidRiderId].sort()
      );

      const events = await admin.outboxEvent.findMany({
        where: { tenantId },
        select: { aggregateId: true, eventType: true },
      });
      assert.equal(
        events.filter(
          (event) =>
            event.aggregateId === unpaidRiderId && event.eventType === "registration.waitlisted"
        ).length,
        1
      );
      assert.equal(
        events.filter(
          (event) =>
            event.aggregateId === unpaidRiderId && event.eventType === "payment.hold.expired"
        ).length,
        1
      );
      assert.equal(
        events.some(
          (event) =>
            event.aggregateId === driverId &&
            (event.eventType === "registration.cancelled" ||
              event.eventType === "payment.hold.expired")
        ),
        false
      );
      assert.equal(
        events.some(
          (event) =>
            (event.aggregateId === partialRiderId || event.aggregateId === paidRiderId) &&
            (event.eventType === "registration.waitlisted" ||
              event.eventType === "payment.hold.expired")
        ),
        false
      );

      const retry = await repository.expireDriverHoldWithUnpaidPassengers({
        tenantId,
        tourId,
        driverBookingId: driverId,
        driverHoldId: holdIds[0]!,
        expectedDueAt: dueAt.toISOString(),
      });
      assert.equal(retry?.status, "deferred");
      assert.equal(await admin.outboxEvent.count({ where: { tenantId } }), events.length);
    });

    it("expires the driver transaction when every assigned rider is strictly unpaid", async () => {
      const admin = getPrismaAdmin();
      const fullyUnpaidDriverId = randomUUID();
      const fullyUnpaidRiderId = randomUUID();
      const fullyUnpaidDriverHoldId = randomUUID();
      const fullyUnpaidRiderHoldId = randomUUID();
      const actor = randomUUID();
      const fullyUnpaidDueAt = new Date(Date.now() - 60_000);
      let capacityAssertionCalls = 0;
      await admin.operatorRegistration.createMany({
        data: [
          {
            id: fullyUnpaidDriverId,
            tenantId,
            tourId,
            tourTitle: "Driver expiry mixed-payment proof",
            guestLabel: "QA all-unpaid driver",
            partySize: 1,
            status: "approved",
            paymentStatus: "unpaid",
            departureAt: new Date("2032-06-01T00:00:00.000Z"),
            submittedByUserId: actor,
            approvedAt: new Date(),
            registrationIntake: {
              transport: { kind: "personal_car", personalCarOccupants: 1 },
              tourCapacityMax: 10,
            },
          },
          {
            id: fullyUnpaidRiderId,
            tenantId,
            tourId,
            tourTitle: "Driver expiry mixed-payment proof",
            guestLabel: "QA all-unpaid rider",
            partySize: 1,
            status: "approved",
            paymentStatus: "unpaid",
            departureAt: new Date("2032-06-01T00:00:00.000Z"),
            submittedByUserId: randomUUID(),
            approvedAt: new Date(),
            registrationIntake: { transport: { kind: "no_car_dong" }, tourCapacityMax: 10 },
          },
        ],
      });
      await admin.financePaymentHold.createMany({
        data: [
          { id: fullyUnpaidDriverHoldId, registrationId: fullyUnpaidDriverId },
          { id: fullyUnpaidRiderHoldId, registrationId: fullyUnpaidRiderId },
        ].map((hold) => ({
          ...hold,
          tenantId,
          status: "open",
          dueAt: fullyUnpaidDueAt,
          policyHours: 24,
        })),
      });
      await admin.transportAllocation.create({
        data: {
          tenantId,
          tourId,
          driverRegistrationId: fullyUnpaidDriverId,
          passengerRegistrationId: fullyUnpaidRiderId,
          createdByUserId: actor,
        },
      });

      const outcome = await repository.expireDriverHoldWithUnpaidPassengers({
        tenantId,
        tourId,
        driverBookingId: fullyUnpaidDriverId,
        driverHoldId: fullyUnpaidDriverHoldId,
        expectedDueAt: fullyUnpaidDueAt.toISOString(),
        assertCapacityAfterRemovalInTx: () => {
          capacityAssertionCalls += 1;
        },
      });

      assert.equal(outcome?.status, "expired");
      assert.equal(capacityAssertionCalls, 1);
      assert.equal(
        (await admin.operatorRegistration.findUniqueOrThrow({ where: { id: fullyUnpaidDriverId } }))
          .status,
        "cancelled"
      );
      assert.equal(
        (await admin.operatorRegistration.findUniqueOrThrow({ where: { id: fullyUnpaidRiderId } }))
          .status,
        "waitlisted"
      );
      const allUnpaidHolds = await admin.financePaymentHold.findMany({
        where: { tenantId, registrationId: { in: [fullyUnpaidDriverId, fullyUnpaidRiderId] } },
        select: { status: true },
      });
      assert.deepEqual(
        allUnpaidHolds.map((hold) => hold.status),
        ["expired", "expired"]
      );
      assert.equal(
        await admin.transportAllocation.count({
          where: {
            tenantId,
            tourId,
            driverRegistrationId: fullyUnpaidDriverId,
          },
        }),
        0
      );
      assert.equal(
        await admin.outboxEvent.count({
          where: {
            tenantId,
            aggregateId: fullyUnpaidDriverId,
            eventType: "registration.cancelled",
          },
        }),
        1
      );
      assert.equal(
        await admin.outboxEvent.count({
          where: {
            tenantId,
            aggregateId: fullyUnpaidRiderId,
            eventType: "registration.waitlisted",
          },
        }),
        1
      );
    });
  }
);
