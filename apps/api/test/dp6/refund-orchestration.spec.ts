/**
 * DP-6 — refund orchestration scenario matrix.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../../src/app.ts";
import { resolveFinanceServiceForTenant } from "../../src/boot/lazy-finance-service.ts";
import { getBookingsRepository } from "../../src/bookings/create-bookings-repository.ts";
import {
  approveBooking,
  createBooking,
  waitlistBooking,
} from "../../src/bookings/create-bookings-service.ts";
import { cancelTourRegistrations } from "../../src/bookings/tour-cancellation.service.ts";
import { OPERATOR_SMOKE } from "../fixtures/operator-smoke-e2e-tenant.ts";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "../fixtures/operator-identity-fixture.ts";
import { installHttpTestClient } from "../http-test-client.ts";
import {
  createSharedMemoryTourStoreForHttpTests,
  createTestToursService,
  installMemoryStorageDriverForDescribe,
} from "../test-helpers.ts";
import { dp1BookingBody } from "../dp1/dp1-test-harness.ts";
import {
  dp6CancelBooking,
  dp6CreateApprovedBooking,
  dp6ListRefundsForRegistration,
  dp6OpsAuth,
  dp6SeedPaidPayment,
  resetDp6Harness,
} from "./dp6-test-harness.ts";

installMemoryStorageDriverForDescribe();

function memberHeaders(userId: string, workspaceId: string): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-authenticated-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-user-id": userId,
    "x-workspace-id": workspaceId,
    "x-user-role": "member",
    "x-user-status": "ACTIVE",
  };
}

describe("DP6 refund orchestration", () => {
  const client = installHttpTestClient(() => {
    const repo = createSharedMemoryTourStoreForHttpTests();
    return createRequestListener({ toursService: createTestToursService(repo), tourStore: repo });
  });

  before(async () => {
    seedOperatorIdentityFixture();
    resetDp6Harness();
    const { getIdentityRepository } =
      await import("../../src/identity/create-identity-repository.ts");
    const idRepo = getIdentityRepository();
    idRepo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: OPERATOR_SMOKE.memberMobile });
    idRepo.seedMembership({
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-smoke-member",
    });
  });

  beforeEach(() => resetDp6Harness());

  after(() => resetDp6Harness());

  it("S1 unpaid operator cancel — no refund draft", async () => {
    const bookingId = await dp6CreateApprovedBooking();
    await dp6CancelBooking(bookingId);
    const refunds = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds.items.length, 0);
    const persisted = await getBookingsRepository().getById(bookingId, dp6OpsAuth().tenantId);
    assert.deepEqual(
      persisted?.cancellationWork === undefined || persisted.cancellationWork === null
        ? null
        : {
            paymentHold: persisted.cancellationWork.paymentHold,
            transportSettlement: persisted.cancellationWork.transportSettlement,
            refund: persisted.cancellationWork.refund,
            notification: persisted.cancellationWork.notification,
            waitlistReview: persisted.cancellationWork.waitlistReview,
          },
      {
        paymentHold: "completed",
        transportSettlement: "completed",
        refund: "not_required",
        notification: "completed",
        waitlistReview: "pending",
      }
    );
  });

  it("S3 fully-paid cancel drafts refund Requested", async () => {
    const bookingId = await dp6CreateApprovedBooking();
    await dp6SeedPaidPayment(bookingId, "50000000");
    await getBookingsRepository().updatePaymentStatus?.({
      bookingId,
      tenantId: dp6OpsAuth().tenantId,
      paymentStatus: "paid",
    });
    await dp6CancelBooking(bookingId);
    const refunds = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds.items.length, 1);
    assert.equal(refunds.items[0]?.status, "Requested");
    assert.equal(refunds.items[0]?.amountMinor, "50000000");
  });

  it("S3b fully-paid across multiple payments drafts one capped refund per source", async () => {
    const bookingId = await dp6CreateApprovedBooking();
    await dp6SeedPaidPayment(bookingId, "10000000");
    await dp6SeedPaidPayment(bookingId, "15000000");
    await getBookingsRepository().updatePaymentStatus?.({
      bookingId,
      tenantId: dp6OpsAuth().tenantId,
      paymentStatus: "paid",
    });

    const cancelled = await dp6CancelBooking(bookingId);
    assert.equal(cancelled.refundStatus, "pending_finance_approval");

    const refunds = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds.items.length, 2);
    assert.deepEqual(refunds.items.map((row) => row.amountMinor).sort(), ["10000000", "15000000"]);
    assert.ok(refunds.items.every((row) => row.status === "Requested"));
  });

  it("paid projection without a refundable source reports manual review, not a pending refund", async () => {
    const bookingId = await dp6CreateApprovedBooking();
    await getBookingsRepository().updatePaymentStatus?.({
      bookingId,
      tenantId: dp6OpsAuth().tenantId,
      paymentStatus: "paid",
    });

    const cancelled = await dp6CancelBooking(bookingId);
    assert.equal(cancelled.refundStatus, "manual_review");
    const refunds = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds.items.length, 0);
    const persisted = await getBookingsRepository().getById(bookingId, dp6OpsAuth().tenantId);
    assert.equal(persisted?.cancellationWork?.refund, "manual_review");
    assert.equal(persisted?.cancellationStatus, "manual_review");

    await dp6SeedPaidPayment(bookingId, "50000000");
    const replay = await dp6CancelBooking(bookingId);
    assert.equal(replay.refundStatus, "pending_finance_approval");
    const recovered = await getBookingsRepository().getById(bookingId, dp6OpsAuth().tenantId);
    assert.equal(recovered?.cancellationWork?.refund, "completed");
    assert.equal(recovered?.cancellationStatus, "applied");
  });

  it("S10 duplicate cancel does not double refund draft", async () => {
    const bookingId = await dp6CreateApprovedBooking();
    await dp6SeedPaidPayment(bookingId, "40000000");
    await getBookingsRepository().updatePaymentStatus?.({
      bookingId,
      tenantId: dp6OpsAuth().tenantId,
      paymentStatus: "paid",
    });
    const first = await dp6CancelBooking(bookingId);
    assert.equal(first.refundStatus, "pending_finance_approval");
    const refunds1 = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds1.items.length, 1);

    const replay = await dp6CancelBooking(bookingId);
    assert.equal(replay.refundStatus, "pending_finance_approval");
    const refunds2 = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds2.items.length, 1);

    const finance = await resolveFinanceServiceForTenant(dp6OpsAuth().tenantId);
    const financeAuth = {
      tenantId: dp6OpsAuth().tenantId,
      userId: dp6OpsAuth().userId,
      role: "admin" as const,
      status: "ACTIVE" as const,
    };
    await finance.approveRefund(financeAuth, refunds2.items[0]!.id);
    await finance.completeRefund(financeAuth, refunds2.items[0]!.id);

    const completedReplay = await dp6CancelBooking(bookingId);
    assert.equal(completedReplay.refundStatus, "completed");
    const refundsAfterCompletion = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refundsAfterCompletion.items.length, 1);
  });

  it("S4 partial-paid cancel drafts partial refund", async () => {
    const bookingId = await dp6CreateApprovedBooking();
    await dp6SeedPaidPayment(bookingId, "15000000");
    await getBookingsRepository().updatePaymentStatus?.({
      bookingId,
      tenantId: dp6OpsAuth().tenantId,
      paymentStatus: "partial",
    });
    await dp6CancelBooking(bookingId);
    const refunds = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds.items.length, 1);
    assert.equal(refunds.items[0]?.amountMinor, "15000000");
  });

  it("S5 tour cancel drafts refunds for paid registrations", async () => {
    const bookingId = await dp6CreateApprovedBooking();
    await dp6SeedPaidPayment(bookingId, "30000000");
    const tourId = dp1BookingBody().tourId;
    const result = await cancelTourRegistrations(dp6OpsAuth(), tourId);
    assert.ok(result.cancelledRegistrationIds.includes(bookingId));
    assert.ok(result.refundDraftCount >= 1);
    assert.deepEqual(result.manualReviewRegistrationIds, []);
    assert.deepEqual(result.failures, []);
    const refunds = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds.items.length, 1);

    const replay = await cancelTourRegistrations(dp6OpsAuth(), tourId);
    assert.ok(replay.cancelledRegistrationIds.includes(bookingId));
    assert.deepEqual(replay.failures, []);
    const refundsAfterReplay = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(
      refundsAfterReplay.items.length,
      1,
      "tour cancellation retry must not duplicate refunds"
    );
  });

  it("S12 waitlist withdraw frees no seat; approved cancel leaves waitlist for operator promotion", async () => {
    const tourId = dp1BookingBody({ tourCapacityMax: 2 }).tourId;
    const approvedId = (
      await createBooking(dp6OpsAuth(), dp1BookingBody({ tourId, guestLabel: "Approved Guest" }))
    ).id;
    await approveBooking(dp6OpsAuth(), approvedId);
    const waitId = (
      await createBooking(dp6OpsAuth(), dp1BookingBody({ tourId, guestLabel: "Wait Guest" }))
    ).id;
    await waitlistBooking(dp6OpsAuth(), waitId);
    await dp6CancelBooking(approvedId);
    const waitRow = await getBookingsRepository().getById(waitId, dp6OpsAuth().tenantId);
    assert.equal(waitRow?.status, "waitlisted", "waitlist promotion requires operator approval");
  });

  it("S5 paid member cancellation request then operator approve drafts refund", async () => {
    const stamp = Date.now();
    const reg = await client.requestJson<{ data?: { id?: string } }>(
      "POST",
      "/denali/registrations",
      {
        headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member"),
        body: {
          tourId: dp1BookingBody().tourId,
          contact: { email: `dp6-${stamp}@denali-smoke.local`, fullName: "DP6 Guest" },
          partySize: 1,
        },
      }
    );
    assert.equal(reg.status, 201);
    const bookingId = reg.body.data?.id ?? "";
    assert.ok(bookingId.length > 0);
    await client.requestJson("POST", `/bookings/${bookingId}/approve`, {
      headers: operatorAuthHeaders(),
    });
    await dp6SeedPaidPayment(bookingId, "25000000");
    await getBookingsRepository().updatePaymentStatus?.({
      bookingId,
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentStatus: "paid",
    });
    const memberCancel = await client.requestJson(
      "POST",
      `/bookings/${bookingId}/member-cancellation`,
      {
        headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member"),
      }
    );
    assert.equal(memberCancel.status, 200);
    assert.equal((memberCancel.body as { kind?: string }).kind, "request_submitted");
    const approve = await client.requestJson<{
      cancellationStatus?: string;
      refundStatus?: string;
      settlementStatus?: string;
      notificationStatus?: string;
    }>("POST", `/bookings/${bookingId}/member-cancellation/approve`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(approve.status, 200);
    assert.equal(approve.body.refundStatus, "pending_finance_approval");
    assert.equal(approve.body.settlementStatus, "not_affected");
    assert.equal(approve.body.notificationStatus, "queued");
    assert.notEqual(approve.body.cancellationStatus, "manual_review");
    const approveReplay = await client.requestJson<{ refundStatus?: string }>(
      "POST",
      `/bookings/${bookingId}/member-cancellation/approve`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(approveReplay.status, 200, "operator approval must recover idempotently");
    assert.equal(approveReplay.body.refundStatus, "pending_finance_approval");
    const refunds = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds.items.length, 1);
    assert.equal(refunds.items[0]?.amountMinor, "25000000");
  });

  it("member cancellation approval reports manual review when the paid projection has no source", async () => {
    const stamp = Date.now();
    const reg = await client.requestJson<{ data?: { id?: string } }>(
      "POST",
      "/denali/registrations",
      {
        headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member"),
        body: {
          tourId: dp1BookingBody().tourId,
          contact: { email: `dp6-manual-${stamp}@denali-smoke.local`, fullName: "DP6 Manual" },
          partySize: 1,
        },
      }
    );
    assert.equal(reg.status, 201);
    const bookingId = reg.body.data?.id ?? "";
    assert.ok(bookingId.length > 0);
    await client.requestJson("POST", `/bookings/${bookingId}/approve`, {
      headers: operatorAuthHeaders(),
    });
    await getBookingsRepository().updatePaymentStatus?.({
      bookingId,
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentStatus: "paid",
    });
    const request = await client.requestJson("POST", `/bookings/${bookingId}/member-cancellation`, {
      headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member"),
    });
    assert.equal(request.status, 200);

    const approve = await client.requestJson<{
      cancellationStatus?: string;
      refundStatus?: string;
    }>("POST", `/bookings/${bookingId}/member-cancellation/approve`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(approve.status, 200);
    assert.equal(approve.body.refundStatus, "manual_review");
    assert.equal(approve.body.cancellationStatus, "manual_review");
  });

  it("GET refund-eligibility returns server snapshot", async () => {
    const bookingId = await dp6CreateApprovedBooking();
    await dp6SeedPaidPayment(bookingId, "10000000");
    const res = await client.requestJson<{ eligibleRefundMinor?: string }>(
      "GET",
      `/bookings/${bookingId}/refund-eligibility`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.eligibleRefundMinor, "10000000");
  });
});

describe("DP6 member cancellation eligibility includes refund preview", () => {
  before(() => {
    seedOperatorIdentityFixture();
    resetDp6Harness();
  });

  it("paid registration exposes refund block on eligibility GET", async () => {
    resetDp6Harness();
    const bookingId = await dp6CreateApprovedBooking();
    await dp6SeedPaidPayment(bookingId, "12000000");
    await getBookingsRepository().updatePaymentStatus?.({
      bookingId,
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentStatus: "paid",
    });
    const repo = getBookingsRepository();
    const row = await repo.getById(bookingId, OPERATOR_SMOKE.tenantId);
    assert.ok(row);
    const { getMemberCancellationEligibility } =
      await import("../../src/member-cancellation/member-cancellation.service.ts");
    const result = await getMemberCancellationEligibility(
      {
        tenantId: OPERATOR_SMOKE.tenantId,
        userId: row.submittedByUserId ?? OPERATOR_SMOKE.memberUserId,
        role: "member",
        status: "ACTIVE",
      },
      bookingId
    );
    assert.equal(result.mode, "request");
    assert.ok(result.refund !== undefined);
    assert.equal(result.refund?.eligibleRefundMinor, "12000000");
  });
});
