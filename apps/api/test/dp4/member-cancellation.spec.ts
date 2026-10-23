/**
 * DP-4 — member self-service cancellation API matrix.
 */
import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../../src/app.ts";
import { resetBookingsRepositoryForTests } from "../../src/bookings/create-bookings-repository.ts";
import {
  findPendingMemberCancellationRequest,
  resetMemberCancellationRequestsForTests,
} from "../../src/bookings/member-cancellation-request.repository.ts";
import {
  approveMemberCancellationRequestForBooking,
  submitMemberCancellation,
} from "../../src/member-cancellation/member-cancellation.service.ts";
import { resetMemberNotificationInboxForTests } from "../../src/notifications/member-notification-inbox.repository.ts";
import { resetPaymentHoldRepositoryForTests } from "../../src/finance/payment-hold.repository.ts";
import { getIdentityRepository } from "../../src/identity/create-identity-repository.ts";
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
import { resetBookingsServiceCompositionForTests } from "../../src/bookings/create-bookings-service.ts";

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

describe("DP4 member cancellation API", () => {
  const client = installHttpTestClient(() => {
    const repo = createSharedMemoryTourStoreForHttpTests();
    return createRequestListener({ toursService: createTestToursService(repo), tourStore: repo });
  });

  before(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
    resetPaymentHoldRepositoryForTests();
    resetMemberCancellationRequestsForTests();
    resetMemberNotificationInboxForTests();
    seedOperatorIdentityFixture();
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
    process.env.PAYMENT_HOLD_ENABLED = "true";
    process.env.PAYMENT_HOLD_EXPIRY_ENABLED = "true";
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetPaymentHoldRepositoryForTests();
    resetMemberCancellationRequestsForTests();
  });

  async function createPendingRegistration(): Promise<string> {
    const stamp = Date.now();
    const reg = await client.requestJson<{ data?: { id?: string } }>(
      "POST",
      "/denali/registrations",
      {
        headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member"),
        body: {
          tourId: OPERATOR_SMOKE.seedTourId,
          contact: { email: `dp4-${stamp}@denali-smoke.local`, fullName: "DP4 Guest" },
          partySize: 1,
        },
      }
    );
    assert.equal(reg.status, 201);
    const bookingId = reg.body.data?.id ?? "";
    assert.ok(bookingId.length > 0);
    return bookingId;
  }

  it("S1 pending withdraw via member-cancellation", async () => {
    const bookingId = await createPendingRegistration();
    const eligibility = await client.requestJson<{ eligible?: boolean; mode?: string }>(
      "GET",
      `/bookings/${bookingId}/member-cancellation`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(eligibility.status, 200, JSON.stringify(eligibility.body));
    assert.equal(eligibility.body.eligible, true);
    assert.equal(eligibility.body.mode, "withdraw");

    const cancelled = await client.requestJson<{ kind?: string; status?: string }>(
      "POST",
      `/bookings/${bookingId}/member-cancellation`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.kind, "cancelled");
    assert.equal(cancelled.body.status, "cancelled");
  });

  it("S3 approved unpaid self-cancel releases seat", async () => {
    const bookingId = await createPendingRegistration();
    await client.requestJson("POST", `/bookings/${bookingId}/approve`, {
      headers: operatorAuthHeaders(),
    });

    const cancelled = await client.requestJson<{ kind?: string }>(
      "POST",
      `/bookings/${bookingId}/member-cancellation`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.kind, "cancelled");

    const booking = await client.requestJson<{ status?: string; cancelSource?: string }>(
      "GET",
      `/bookings/${bookingId}`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(booking.body.status, "cancelled");
    assert.equal(booking.body.cancelSource, "member");
  });

  it("rejects member cancellation of a driver that would strand an approved dong rider", async () => {
    const driverId = await createPendingRegistration();
    const repo = (
      await import("../../src/bookings/create-bookings-repository.ts")
    ).getBookingsRepository();
    await repo.mergeRegistrationIntake({
      bookingId: driverId,
      tenantId: OPERATOR_SMOKE.tenantId,
      patch: { transport: { kind: "personal_car", personalCarOccupants: 1 } },
    });
    await client.requestJson("POST", `/bookings/${driverId}/approve`, {
      headers: operatorAuthHeaders(),
    });
    repo.seedBooking({
      id: "00000000-0000-4000-8000-000000000913",
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourTitle: "Member cancellation carpool guard",
      guestLabel: "Approved Dong Rider",
      guestEmail: null,
      guestPhone: "+15550009913",
      partySize: 1,
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      submittedAt: new Date().toISOString(),
      submittedByUserId: "member-dong-rider",
      approvedAt: new Date().toISOString(),
      registrationIntake: { tourCapacityMax: 12, transport: { kind: "no_car_dong" } },
    });

    const cancellation = await client.requestJson<{ code?: string }>(
      "POST",
      `/bookings/${driverId}/member-cancellation`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(cancellation.status, 409);
    assert.match(cancellation.body.code ?? "", /BOOKING_TRANSPORT_CAPACITY_REJECTED/);
    assert.equal((await repo.getById(driverId, OPERATOR_SMOKE.tenantId))?.status, "approved");
    assert.equal(
      (await repo.getById("00000000-0000-4000-8000-000000000913", OPERATOR_SMOKE.tenantId))?.status,
      "approved"
    );
  });

  it("S5 paid registration → request only", async () => {
    const bookingId = await createPendingRegistration();
    await client.requestJson("POST", `/bookings/${bookingId}/approve`, {
      headers: operatorAuthHeaders(),
    });
    const repo = (
      await import("../../src/bookings/create-bookings-repository.ts")
    ).getBookingsRepository();
    const row = await repo.getById(bookingId, OPERATOR_SMOKE.tenantId);
    assert.ok(row);
    await repo.updatePaymentStatus?.({
      bookingId,
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentStatus: "paid",
    });

    const result = await client.requestJson<{ kind?: string }>(
      "POST",
      `/bookings/${bookingId}/member-cancellation`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.kind, "request_submitted");
  });

  it("keeps a paid driver's cancellation request pending when approval would strand dong riders", async () => {
    const driverId = await createPendingRegistration();
    const repo = (
      await import("../../src/bookings/create-bookings-repository.ts")
    ).getBookingsRepository();
    await repo.mergeRegistrationIntake({
      bookingId: driverId,
      tenantId: OPERATOR_SMOKE.tenantId,
      patch: { transport: { kind: "personal_car", personalCarOccupants: 1 } },
    });
    await client.requestJson("POST", `/bookings/${driverId}/approve`, {
      headers: operatorAuthHeaders(),
    });
    await repo.updatePaymentStatus({
      bookingId: driverId,
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentStatus: "paid",
    });
    const memberAuth = {
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member" as const,
      status: "ACTIVE" as const,
      workspaceId: "ws-operator-smoke-member",
    };
    const requested = await submitMemberCancellation(memberAuth, driverId);
    assert.equal(requested.kind, "request_submitted");

    repo.seedBooking({
      id: "00000000-0000-4000-8000-000000000914",
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourTitle: "Cancellation approval carpool guard",
      guestLabel: "Approved Dong Rider",
      guestEmail: null,
      guestPhone: "+15550009914",
      partySize: 1,
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      submittedAt: new Date().toISOString(),
      submittedByUserId: "member-dong-rider-approval",
      approvedAt: new Date().toISOString(),
      registrationIntake: { tourCapacityMax: 12, transport: { kind: "no_car_dong" } },
    });

    await assert.rejects(
      approveMemberCancellationRequestForBooking(
        {
          userId: OPERATOR_SMOKE.ownerUserId,
          tenantId: OPERATOR_SMOKE.tenantId,
          role: "owner",
          status: "ACTIVE",
        },
        driverId
      ),
      /BOOKING_TRANSPORT_CAPACITY_REJECTED/
    );
    assert.equal(
      findPendingMemberCancellationRequest(OPERATOR_SMOKE.tenantId, driverId)?.status,
      "pending"
    );
    assert.equal((await repo.getById(driverId, OPERATOR_SMOKE.tenantId))?.status, "approved");
  });
});

describe("DP4 member notification inbox", () => {
  it("S8 dispatch writes inbox row idempotently", async () => {
    const { dispatchMemberNotificationFromOutbox } =
      await import("../../src/notifications/dispatch-member-notification-from-outbox.ts");
    const { memberNotificationInboxCountForTests } =
      await import("../../src/notifications/member-notification-inbox.repository.ts");
    resetMemberNotificationInboxForTests();

    const row = {
      tenantId: OPERATOR_SMOKE.tenantId,
      aggregateType: "registration",
      aggregateId: "reg-1",
      eventType: "registration.approved",
      payload: { guestUserId: OPERATOR_SMOKE.memberUserId, bookingId: "reg-1" },
      domainEventId: "registration.approved:reg-1:t1",
      correlationId: null,
      createdAt: new Date(),
    };

    await dispatchMemberNotificationFromOutbox(row);
    await dispatchMemberNotificationFromOutbox(row);
    assert.equal(memberNotificationInboxCountForTests(), 1);
  });
});
