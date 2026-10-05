/**
 * DP-4 — member self-service cancellation API matrix.
 */
import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../../src/app.ts";
import { resetBookingsRepositoryForTests } from "../../src/bookings/create-bookings-repository.ts";
import { peekOutboxByAggregateForTests } from "../../src/bookings/in-memory-bookings.repository.ts";
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
    assert.equal(eligibility.status, 200);
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

    const replay = await client.requestJson<{ kind?: string }>(
      "POST",
      `/bookings/${bookingId}/member-cancellation`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(replay.status, 200);
    assert.equal(replay.body.kind, "cancelled");

    const booking = await client.requestJson<{ status?: string; cancelSource?: string }>(
      "GET",
      `/bookings/${bookingId}`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(booking.body.status, "cancelled");
    assert.equal(booking.body.cancelSource, "member");
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

    const result = await client.requestJson<{ kind?: string; requestId?: string }>(
      "POST",
      `/bookings/${bookingId}/member-cancellation`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.kind, "request_submitted");

    const replay = await client.requestJson<{ kind?: string; requestId?: string }>(
      "POST",
      `/bookings/${bookingId}/member-cancellation`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(replay.status, 200);
    assert.equal(replay.body.requestId, result.body.requestId);

    const pending = await client.requestJson<{
      mode?: string;
      request?: { status?: string };
    }>("GET", `/bookings/${bookingId}/member-cancellation`, {
      headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member"),
    });
    assert.equal(pending.status, 200);
    assert.equal(pending.body.mode, "request_pending");
    assert.equal(pending.body.request?.status, "pending");

    const workQueue = await client.requestJson<{ items?: Array<{ id?: string }> }>(
      "GET",
      "/bookings?view=ops&workQueue=true",
      { headers: operatorAuthHeaders() }
    );
    assert.equal(workQueue.status, 200);
    assert.equal(
      workQueue.body.items?.some((item) => item.id === bookingId),
      true,
      "paid member cancellation requests must appear in the operator work queue"
    );

    const memberApproval = await client.requestJson(
      "POST",
      `/bookings/${bookingId}/member-cancellation/approve`,
      { headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member") }
    );
    assert.equal(memberApproval.status, 403, "a member cannot approve their own request");

    const memberReject = await client.requestJson(
      "POST",
      `/bookings/${bookingId}/member-cancellation/reject`,
      {
        headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member"),
        body: { reasonNote: "self reject must be forbidden" },
      }
    );
    assert.equal(memberReject.status, 403, "a member cannot reject their own request");

    const unchanged = await repo.getById(bookingId, OPERATOR_SMOKE.tenantId);
    assert.equal(unchanged?.status, "approved");

    const missingReason = await client.requestJson<{ code?: string }>(
      "POST",
      `/bookings/${bookingId}/member-cancellation/reject`,
      { headers: operatorAuthHeaders(), body: {} }
    );
    assert.equal(missingReason.status, 400);
    assert.equal(missingReason.body.code, "MEMBER_CANCELLATION_REJECT_REASON_REQUIRED");
    assert.equal(
      (await repo.getById(bookingId, OPERATOR_SMOKE.tenantId))?.cancellationStatus,
      "request_pending",
      "invalid rejection must not consume the pending decision"
    );

    const rejected = await client.requestJson<{ kind?: string; status?: string }>(
      "POST",
      `/bookings/${bookingId}/member-cancellation/reject`,
      {
        headers: operatorAuthHeaders(),
        body: { reasonNote: "Refund policy exception" },
      }
    );
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.kind, "request_rejected");
    const rejectedBooking = await repo.getById(bookingId, OPERATOR_SMOKE.tenantId);
    assert.equal(rejectedBooking?.status, "approved");
    assert.equal(rejectedBooking?.cancellationStatus, "rejected");
    assert.equal(rejectedBooking?.cancellationReasonNote, "Refund policy exception");
    assert.equal(rejectedBooking?.cancellationRejectedByUserId, OPERATOR_SMOKE.ownerUserId);
    const rejectionEvents = peekOutboxByAggregateForTests({
      tenantId: OPERATOR_SMOKE.tenantId,
      aggregateId: bookingId,
    }).filter((event) => event.eventType === "registration.cancellation_request_rejected");
    assert.equal(rejectionEvents.length, 1);
    assert.equal(rejectionEvents[0]?.payload.guestUserId, OPERATOR_SMOKE.memberUserId);
    assert.equal(rejectionEvents[0]?.payload.reasonNote, "Refund policy exception");

    const rejectedReplay = await client.requestJson<{ kind?: string; status?: string }>(
      "POST",
      `/bookings/${bookingId}/member-cancellation/reject`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(rejectedReplay.status, 200);
    assert.equal(rejectedReplay.body.kind, "request_rejected");
    assert.equal(
      peekOutboxByAggregateForTests({
        tenantId: OPERATOR_SMOKE.tenantId,
        aggregateId: bookingId,
      }).filter((event) => event.eventType === "registration.cancellation_request_rejected").length,
      1,
      "replaying a rejection must not duplicate its member notification"
    );
  });

  it("approve/reject race commits exactly one member-cancellation decision", async () => {
    const bookingId = await createPendingRegistration();
    await client.requestJson("POST", `/bookings/${bookingId}/approve`, {
      headers: operatorAuthHeaders(),
    });
    const repo = (
      await import("../../src/bookings/create-bookings-repository.ts")
    ).getBookingsRepository();
    await repo.updatePaymentStatus?.({
      bookingId,
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentStatus: "paid",
    });
    const request = await client.requestJson("POST", `/bookings/${bookingId}/member-cancellation`, {
      headers: memberHeaders(OPERATOR_SMOKE.memberUserId, "ws-operator-smoke-member"),
    });
    assert.equal(request.status, 200);

    const [approve, reject] = await Promise.all([
      client.requestJson("POST", `/bookings/${bookingId}/member-cancellation/approve`, {
        headers: operatorAuthHeaders(),
      }),
      client.requestJson("POST", `/bookings/${bookingId}/member-cancellation/reject`, {
        headers: operatorAuthHeaders(),
        body: { reasonNote: "Concurrent operator decision" },
      }),
    ]);
    assert.equal(
      [approve.status, reject.status].filter((status) => status === 200).length,
      1,
      "only one competing decision may commit"
    );

    const final = await repo.getById(bookingId, OPERATOR_SMOKE.tenantId);
    assert.ok(final);
    if (approve.status === 200) {
      assert.equal(final.status, "cancelled");
      assert.notEqual(final.cancellationStatus, "rejected");
    } else {
      assert.equal(final.status, "approved");
      assert.equal(final.cancellationStatus, "rejected");
    }
    const events = peekOutboxByAggregateForTests({
      tenantId: OPERATOR_SMOKE.tenantId,
      aggregateId: bookingId,
    });
    assert.equal(
      events.filter(
        (event) =>
          event.eventType === "registration.cancelled" ||
          event.eventType === "registration.cancellation_request_rejected"
      ).length,
      1,
      "the outbox must reflect only the winning decision"
    );
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

    const affectedDriverRow = {
      ...row,
      aggregateId: "driver-reg-1",
      eventType: "registration.passenger_cancelled",
      payload: {
        guestUserId: OPERATOR_SMOKE.adminUserId,
        driverRegistrationId: "driver-reg-1",
        passengerRegistrationId: "reg-1",
      },
      domainEventId: "registration.cancelled:reg-1:driver:driver-reg-1",
    };
    await dispatchMemberNotificationFromOutbox(affectedDriverRow);
    await dispatchMemberNotificationFromOutbox(affectedDriverRow);
    assert.equal(memberNotificationInboxCountForTests(), 2);

    const affectedPassengerRow = {
      ...row,
      aggregateId: "passenger-reg-1",
      eventType: "registration.driver_cancelled",
      payload: {
        guestUserId: OPERATOR_SMOKE.memberUserId,
        driverRegistrationId: "driver-reg-1",
        passengerRegistrationId: "passenger-reg-1",
      },
      domainEventId: "registration.cancelled:driver-reg-1:passenger:passenger-reg-1",
    };
    await dispatchMemberNotificationFromOutbox(affectedPassengerRow);
    await dispatchMemberNotificationFromOutbox(affectedPassengerRow);
    assert.equal(memberNotificationInboxCountForTests(), 3);

    const rejectedCancellationRequestRow = {
      ...row,
      aggregateId: "reg-rejected-cancellation-1",
      eventType: "registration.cancellation_request_rejected",
      payload: {
        guestUserId: OPERATOR_SMOKE.memberUserId,
        registrationId: "reg-rejected-cancellation-1",
      },
      domainEventId: "registration.cancelled:reg-rejected-cancellation-1:request-rejected",
    };
    await dispatchMemberNotificationFromOutbox(rejectedCancellationRequestRow);
    await dispatchMemberNotificationFromOutbox(rejectedCancellationRequestRow);
    assert.equal(memberNotificationInboxCountForTests(), 4);
  });
});
