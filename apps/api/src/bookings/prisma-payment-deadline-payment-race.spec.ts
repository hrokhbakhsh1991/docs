/** Real-PostgreSQL proof for payment capture racing payment-deadline cancellation. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma.ts";
import { resetTenantConnectionBudgetForTests } from "../db/tenant-connection-budget.ts";
import { PaymentDeadlinePaymentAlreadySettledError } from "./bookings.errors.ts";
import { PrismaBookingsRepository } from "./prisma-bookings.repository.ts";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const postgresSkip = hasDatabase
  ? false
  : "PAYMENT_DEADLINE_POSTGRES_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN";

describe(
  "Prisma payment capture versus payment-deadline cancellation",
  {
    concurrency: false,
    skip: postgresSkip,
  },
  () => {
    const tenantId = randomUUID();
    const tourId = randomUUID();
    const paidWinsRegistrationId = randomUUID();
    const expiryWinsRegistrationId = randomUUID();
    const repository = new PrismaBookingsRepository();

    before(async () => {
      process.env.TENANT_MAX_CONCURRENT_DB_OPS = "16";
      resetTenantConnectionBudgetForTests();
      await disconnectPrisma();
      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `pay-race-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
      await admin.tour.create({
        data: { id: tourId, tenantId, title: "Payment expiry race proof", canonical: {} },
      });
      await admin.operatorRegistration.createMany({
        data: [paidWinsRegistrationId, expiryWinsRegistrationId].map((id) => ({
          id,
          tenantId,
          tourId,
          tourTitle: "Payment expiry race proof",
          guestLabel: `QA payment race ${id.slice(0, 8)}`,
          partySize: 1,
          status: "approved",
          paymentStatus: "unpaid",
          departureAt: new Date("2032-06-01T00:00:00.000Z"),
          submittedByUserId: randomUUID(),
          approvedAt: new Date(),
          registrationIntake: { tourCapacityMax: 10 },
        })),
      });
    });

    after(async () => {
      const admin = getPrismaAdmin();
      try {
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.operatorRegistration.deleteMany({ where: { tenantId, tourId } });
        await admin.tour.deleteMany({ where: { tenantId, id: tourId } });
        // Cancellation audit events are append-only; their isolated QA tenant is
        // intentionally retained until the disposable PostgreSQL database exits.
      } finally {
        await disconnectPrisma();
        resetTenantConnectionBudgetForTests();
        delete process.env.TENANT_MAX_CONCURRENT_DB_OPS;
      }
    });

    it("keeps a paid approved registration when expiry acts on stale unpaid state", async () => {
      const paid = await repository.updatePaymentStatus({
        bookingId: paidWinsRegistrationId,
        tenantId,
        paymentStatus: "paid",
      });
      assert.equal(paid?.paymentStatus, "paid");

      await assert.rejects(
        repository.cancelBooking({
          bookingId: paidWinsRegistrationId,
          tenantId,
          outboxEvent: "registration.cancelled",
          cancelSource: "payment_deadline",
        }),
        PaymentDeadlinePaymentAlreadySettledError
      );

      const persisted = await repository.getById(paidWinsRegistrationId, tenantId);
      assert.equal(persisted?.status, "approved");
      assert.equal(persisted?.paymentStatus, "paid");
    });

    it("rejects a late capture after expiry has already cancelled the registration", async () => {
      const cancelled = await repository.cancelBooking({
        bookingId: expiryWinsRegistrationId,
        tenantId,
        outboxEvent: "registration.cancelled",
        cancelSource: "payment_deadline",
      });
      assert.equal(cancelled.status, "cancelled");

      const latePayment = await repository.updatePaymentStatus({
        bookingId: expiryWinsRegistrationId,
        tenantId,
        paymentStatus: "paid",
      });
      assert.equal(latePayment, null);

      const persisted = await repository.getById(expiryWinsRegistrationId, tenantId);
      assert.equal(persisted?.status, "cancelled");
      assert.equal(persisted?.paymentStatus, "unpaid");
    });
  }
);
