/**
 * DP1-E — payment hold expiry (S4, S5, S7, S13).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { registrationOccupiesSeat } from "@app-tour/tour-core";
import type { FinanceActorContext } from "@app-tour/finance-core/ports";

import { peekOutboxByAggregateForTests } from "../../src/bookings/in-memory-bookings.repository.ts";
import {
  approveBooking,
  cancelBooking,
  createBooking,
  sumApprovedPartySizeByTourIds,
} from "../../src/bookings/create-bookings-service.ts";
import { getIdentityRepository } from "../../src/identity/create-identity-repository.ts";
import {
  resolveFinanceServiceForTenant,
  resetLazyFinanceServiceForTests,
} from "../../src/boot/lazy-finance-service.ts";
import { resetPaymentHoldRepositoryForTests } from "../../src/finance/payment-hold.repository.ts";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage.ts";
import { InMemoryTourRepository } from "../../src/storage/in-memory-tour.repository.ts";
import {
  DP1_TENANT_DENALI,
  DP1_TOUR_ID,
  dp1BookingBody,
  dp1CreateAndApprovePending,
  dp1GetBooking,
  dp1ListBookingsByStatus,
  dp1OpsAuth,
  requirePaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

async function expireHold(registrationId: string): Promise<void> {
  const mod = (await import("../../src/finance/payment-hold-expiry.ts")) as {
    expirePaymentHoldForRegistration(input: {
      tenantId: string;
      registrationId: string;
    }): Promise<void>;
  };
  assert.equal(typeof mod.expirePaymentHoldForRegistration, "function");
  await mod.expirePaymentHoldForRegistration({
    tenantId: DP1_TENANT_DENALI,
    registrationId,
  });
}

describe("DP1-E payment hold expiry", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("S4: expiry without payment → cancelled + hold expired", async () => {
    const { bookingId } = await dp1CreateAndApprovePending({ partySize: 2 });
    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, bookingId, "2030-01-01T00:00:00.000Z");
    await expireHold(bookingId);

    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, bookingId);
    assert.equal(hold?.status, "expired");

    const booking = await dp1GetBooking(bookingId);
    assert.equal(booking.status, "cancelled");
    assert.equal(booking.cancelSource, "payment_deadline");
    assert.equal(booking.paymentStatus, "unpaid");

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: DP1_TENANT_DENALI,
      aggregateId: bookingId,
    });
    const types = outbox.map((row) => row.eventType);
    assert.ok(types.includes("payment.hold.expired"));
    assert.ok(types.includes("registration.cancelled"));
  });

  it("S5: expiry releases approved-unpaid occupancy", async () => {
    const { bookingId } = await dp1CreateAndApprovePending({ partySize: 3, tourCapacityMax: 10 });
    const before = await sumApprovedPartySizeByTourIds(DP1_TENANT_DENALI, [DP1_TOUR_ID]);
    assert.equal(before[DP1_TOUR_ID], 3);
    assert.equal(registrationOccupiesSeat("booking", "approved"), true);

    await expireHold(bookingId);
    const after = await sumApprovedPartySizeByTourIds(DP1_TENANT_DENALI, [DP1_TOUR_ID]);
    assert.equal(after[DP1_TOUR_ID] ?? 0, 0);
  });

  it("S7: expiry without waitlist does not promote", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    await expireHold(bookingId);
    const waitlisted = await dp1ListBookingsByStatus("approved");
    assert.equal(waitlisted.length, 0);
  });

  it("does not expire a car driver's payment hold when cancellation would strand approved dong passengers", async () => {
    const driver = await createBooking(dp1OpsAuth(), {
      ...dp1BookingBody({ guestLabel: "Expiry protected driver", partySize: 1 }),
      registrationIntake: {
        tourCapacityMax: 10,
        transport: { kind: "personal_car", personalCarOccupants: 1 },
      },
    });
    await approveBooking(dp1OpsAuth(), driver.id);
    const dongGuest = await createBooking(dp1OpsAuth(), {
      ...dp1BookingBody({ guestLabel: "Expiry protected dong", partySize: 1 }),
      registrationIntake: {
        tourCapacityMax: 10,
        transport: { kind: "no_car_dong" },
      },
    });
    await approveBooking(dp1OpsAuth(), dongGuest.id);

    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, driver.id, "2030-01-01T00:00:00.000Z");
    await assert.rejects(() => expireHold(driver.id), /BOOKING_DONG_SEAT_REASSIGNMENT_REQUIRED/);

    assert.equal((await dp1GetBooking(driver.id)).status, "approved");
    assert.equal((await dp1GetBooking(dongGuest.id)).status, "approved");
    assert.equal(
      (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, driver.id))?.status,
      "extended"
    );
    assert.equal(
      (
        await peekOutboxByAggregateForTests({
          tenantId: DP1_TENANT_DENALI,
          aggregateId: driver.id,
        })
      ).some((row) => row.eventType === "payment.hold.expired"),
      false
    );
  });

  it("S13: operator cancel before payment closes hold without payment_deadline source", async () => {
    const { bookingId } = await dp1CreateAndApprovePending();
    await cancelBooking(dp1OpsAuth(), bookingId);
    const booking = await dp1GetBooking(bookingId);
    assert.equal(booking.status, "cancelled");
    assert.notEqual(booking.cancelSource, "payment_deadline");
    const holdPort = await requirePaymentHoldPort();
    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, bookingId);
    assert.ok(hold === null || hold.status !== "open");
  });

  it("characterizes expiry after a member submitted a receipt still awaiting Finance review", async () => {
    const originalHoldEnabled = process.env.PAYMENT_HOLD_ENABLED;
    const originalExpiryEnabled = process.env.PAYMENT_HOLD_EXPIRY_ENABLED;
    process.env.PAYMENT_HOLD_ENABLED = "true";
    process.env.PAYMENT_HOLD_EXPIRY_ENABLED = "true";
    resetLazyFinanceServiceForTests();
    resetPaymentHoldRepositoryForTests();

    try {
      const tourStore = createTourStorageRepository();
      assert.ok(tourStore instanceof InMemoryTourRepository);
      const seededTour = await tourStore.getById(DP1_TOUR_ID, DP1_TENANT_DENALI);
      assert.ok(seededTour, "independent receipt-expiry tour source must exist");
      const tourId = randomUUID();
      const title = `DP1 pending receipt expiry ${randomUUID().slice(0, 8)}`;
      const data = structuredClone(seededTour.canonical.data) as Record<string, unknown>;
      const pricing =
        data.pricing !== null && typeof data.pricing === "object" && !Array.isArray(data.pricing)
          ? (data.pricing as Record<string, unknown>)
          : {};
      data.title = title;
      data.basics = { title };
      data.capacityMax = 1;
      data.pricing = {
        ...pricing,
        paymentCollection: "offline",
        registrationApproval: "manual",
      };
      await tourStore.save({
        ...seededTour,
        id: tourId,
        createdAt: new Date().toISOString(),
        rowVersion: 1,
        canonical: { ...seededTour.canonical, data },
      });

      const guestSuffix = String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
      const { user, membership } = await getIdentityRepository().registerPublicGuest({
        tenantId: DP1_TENANT_DENALI,
        mobile: `+1555${guestSuffix}`,
        displayName: `DP1 pending receipt ${randomUUID().slice(0, 8)}`,
        email: `dp1-pending-receipt-${randomUUID()}@example.test`,
      });
      const memberId = user.id;
      const workspaceId = membership.workspaceId ?? "ws-dp1-pending-receipt";
      const admin = dp1OpsAuth();
      const booking = await createBooking(admin, {
        ...dp1BookingBody({
          guestLabel: `DP1 pending receipt ${randomUUID().slice(0, 8)}`,
          partySize: 1,
          tourCapacityMax: 1,
          tourId,
        }),
        memberUserId: memberId,
      });
      const approved = await approveBooking(admin, booking.id);
      assert.equal(approved.status, "approved");

      const finance = await resolveFinanceServiceForTenant(DP1_TENANT_DENALI);
      const memberAuth: FinanceActorContext = {
        tenantId: DP1_TENANT_DENALI,
        userId: memberId,
        role: "member",
        status: "ACTIVE",
        workspaceId,
      };
      const pendingReceipt = await finance.submitMemberReceiptForRegistration(memberAuth, {
        registrationId: booking.id,
        note: "timely test receipt awaiting review",
      });
      assert.equal(pendingReceipt.status, "Pending");

      const holdPort = await requirePaymentHoldPort();
      const dueAt = new Date(Date.now() - 1_000).toISOString();
      await holdPort.extend(DP1_TENANT_DENALI, booking.id, dueAt);
      const dueHolds = await holdPort.scanDueOpenHolds(new Date().toISOString());
      assert.ok(dueHolds.some((hold) => hold.registrationId === booking.id));

      await expireHold(booking.id);
      const afterExpiry = await dp1GetBooking(booking.id);
      assert.equal(afterExpiry.status, "cancelled");
      assert.equal(afterExpiry.cancelSource, "payment_deadline");
      assert.equal(afterExpiry.paymentStatus, "unpaid");
      assert.equal(
        (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, booking.id))?.status,
        "expired"
      );

      await assert.rejects(
        () =>
          finance.reviewReceipt(dp1FinanceOpsAuth(), pendingReceipt.id, {
            decision: "approve",
          }),
        /FINANCE_BOOKING_PAYMENT_SYNC_MISS/
      );
      const memberReceipt = await finance.getMemberReceiptStatusForRegistration(
        memberAuth,
        booking.id
      );
      assert.equal(memberReceipt.status, "pending");
      const remainingOccupancy = await sumApprovedPartySizeByTourIds(DP1_TENANT_DENALI, [tourId]);
      assert.equal(remainingOccupancy[tourId] ?? 0, 0);
      const afterReview = await dp1GetBooking(booking.id);
      assert.equal(afterReview.status, "cancelled");
      assert.equal(afterReview.paymentStatus, "unpaid");
    } finally {
      resetLazyFinanceServiceForTests();
      resetPaymentHoldRepositoryForTests();
      if (originalHoldEnabled === undefined) delete process.env.PAYMENT_HOLD_ENABLED;
      else process.env.PAYMENT_HOLD_ENABLED = originalHoldEnabled;
      if (originalExpiryEnabled === undefined) delete process.env.PAYMENT_HOLD_EXPIRY_ENABLED;
      else process.env.PAYMENT_HOLD_EXPIRY_ENABLED = originalExpiryEnabled;
    }
  });
});

function dp1FinanceOpsAuth(): FinanceActorContext {
  return {
    userId: "00000000-0000-4000-8000-000000000201",
    tenantId: DP1_TENANT_DENALI,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-dp1-finance",
  };
}
