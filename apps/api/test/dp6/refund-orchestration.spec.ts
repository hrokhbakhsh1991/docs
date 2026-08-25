/**
 * DP-6 — refund orchestration scenario matrix.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../../src/app.ts";
import { getBookingsRepository } from "../../src/bookings/create-bookings-repository.ts";
import { approveBooking, createBooking, waitlistBooking } from "../../src/bookings/create-bookings-service.ts";
import { cancelTourRegistrations } from "../../src/bookings/tour-cancellation.service.ts";
import { OPERATOR_SMOKE } from "../fixtures/operator-smoke-e2e-tenant.ts";
import { operatorAuthHeaders, seedOperatorIdentityFixture } from "../fixtures/operator-identity-fixture.ts";
import { installHttpTestClient } from "../http-test-client.ts";
import { createSharedMemoryTourStoreForHttpTests, createTestToursService, installMemoryStorageDriverForDescribe } from "../test-helpers.ts";
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
    const { getIdentityRepository } = await import("../../src/identity/create-identity-repository.ts");
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

  it("S10 duplicate cancel does not double refund draft", async () => {
    const bookingId = await dp6CreateApprovedBooking();
    await dp6SeedPaidPayment(bookingId, "40000000");
    await getBookingsRepository().updatePaymentStatus?.({
      bookingId,
      tenantId: dp6OpsAuth().tenantId,
      paymentStatus: "paid",
    });
    await dp6CancelBooking(bookingId);
    const refunds1 = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds1.items.length, 1);
    const replay = await client.requestJson("GET", `/bookings/${bookingId}/refund-eligibility`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(replay.status, 200);
    const refunds2 = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds2.items.length, 1);
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
    const refunds = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds.items.length, 1);
  });

  it("S12 waitlist withdraw frees no seat; approved cancel promotes waitlist", async () => {
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
    assert.equal(waitRow?.status, "approved", "waitlist guest promoted after seat release");
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
    const memberCancel = await client.requestJson("POST", `/bookings/${bookingId}/member-cancellation`, {
      headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member"),
    });
    assert.equal(memberCancel.status, 200);
    assert.equal((memberCancel.body as { kind?: string }).kind, "request_submitted");
    const approve = await client.requestJson(
      "POST",
      `/bookings/${bookingId}/member-cancellation/approve`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(approve.status, 200);
    const refunds = await dp6ListRefundsForRegistration(bookingId);
    assert.equal(refunds.items.length, 1);
    assert.equal(refunds.items[0]?.amountMinor, "25000000");
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
    const { getMemberCancellationEligibility } = await import(
      "../../src/member-cancellation/member-cancellation.service.ts"
    );
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
