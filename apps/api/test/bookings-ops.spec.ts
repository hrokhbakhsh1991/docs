/**
 * Phase 9.5 — bookings ops API
 * Authority: docs/phase-9/appendices/bookings-api-dispatch-addendum.md
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  getBookingsRepository,
} from "../src/bookings/create-bookings-repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorBookingsFixture } from "./fixtures/operator-bookings-fixture";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type BookingsApiResponse = Record<string, unknown>;

function createBookingsTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("bookings-ops.spec.ts — Phase 9.5 API", () => {
  const client = installHttpTestClient(createBookingsTestListener);

  before(() => {
    seedOperatorIdentityFixture();
    seedOperatorBookingsFixture();
    const repo = getIdentityRepository();
    repo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: "+15550001003" });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-member",
    });
  });

  it("API-9.5-01 approve booking writes outbox in transaction", async () => {
    const response = await client.requestJson<BookingsApiResponse>(
      "POST",
      `/bookings/${OPERATOR_SMOKE.pendingBookingId}/approve`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "approved");
    assert.equal(typeof response.body.approvedAt, "string");

    const bookingsRepo = getBookingsRepository();
    const outboxRows = await bookingsRepo.listOutboxByAggregate(OPERATOR_SMOKE.pendingBookingId);
    assert.equal(outboxRows.length, 1);
    assert.equal(outboxRows[0]?.eventType, "registration.approved");
    assert.equal(outboxRows[0]?.aggregateType, "registration");
  });

  it("API-9.5-02 GET /bookings/summary returns KPI counts", async () => {
    const response = await client.requestJson<BookingsApiResponse>("GET", "/bookings/summary", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 200);
    assert.equal(typeof response.body.pending, "number");
    assert.equal(typeof response.body.approvedToday, "number");
    assert.equal(typeof response.body.departures7d, "number");
    assert.equal(typeof response.body.waitlist, "number");
    assert.ok((response.body.pending as number) >= 0);
    assert.ok((response.body.approvedToday as number) >= 1);
    assert.ok((response.body.waitlist as number) >= 1);
    const tourChips = response.body.tourChips as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(tourChips));
    assert.ok(tourChips.length >= 1);
    assert.equal(typeof tourChips[0]?.tourId, "string");
    assert.equal(typeof tourChips[0]?.pendingCount, "number");
  });

  it("API-9.5-03 member view=ops returns 403", async () => {
    const response = await client.requestJson<BookingsApiResponse>("GET", "/bookings?view=ops", {
      headers: {
        ...operatorAuthHeaders(),
        "x-user-id": OPERATOR_SMOKE.memberUserId,
        "x-actor-role": "member",
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "BOOKINGS_OPS_FORBIDDEN");
  });

  it("API-9.5-05 bulk approve writes outbox rows in one transaction", async () => {
    seedOperatorBookingsFixture();
    const bookingsRepo = getBookingsRepository();
    const pendingId = "00000000-0000-4000-8000-000000000320";
    bookingsRepo.seedBooking({
      id: pendingId,
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourTitle: "Bulk Tour",
      guestLabel: "Bulk Guest",
      guestEmail: null,
      guestPhone: null,
      partySize: 1,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      submittedAt: new Date().toISOString(),
      submittedByUserId: OPERATOR_SMOKE.memberUserId,
      approvedAt: null,
    });

    const response = await client.requestJson<BookingsApiResponse>("POST", "/bookings/bulk-approve", {
      headers: operatorAuthHeaders(),
      body: {
        ids: [OPERATOR_SMOKE.pendingBookingId, pendingId],
      },
    });
    assert.equal(response.status, 200);
    const approvedIds = response.body.approvedIds as string[];
    assert.equal(approvedIds.length, 2);

    for (const id of approvedIds) {
      const outboxRows = await bookingsRepo.listOutboxByAggregate(id);
      assert.equal(outboxRows.length, 1);
      assert.equal(outboxRows[0]?.eventType, "registration.approved");
    }
  });
});
