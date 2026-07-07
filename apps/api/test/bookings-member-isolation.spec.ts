/**
 * MEM-04 — member isolation for `GET /bookings?view=mine`
 * Authority: docs/phase-19/platform-portal-member.mdoc
 *
 * A member requesting `view=mine` must only ever see rows whose
 * `submittedByUserId` matches their own session user id — never another
 * member's booking, even within the same tenant.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getBookingsRepository } from "../src/bookings/create-bookings-repository";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorBookingsFixture } from "./fixtures/operator-bookings-fixture";
import { seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

const MEMBER_A_USER_ID = OPERATOR_SMOKE.memberUserId;
const MEMBER_B_USER_ID = "00000000-0000-4000-8000-000000000104";
const MEMBER_A_BOOKING_ID = "00000000-0000-4000-8000-000000000340";
const MEMBER_B_BOOKING_ID = "00000000-0000-4000-8000-000000000341";

type BookingsListBody = { items?: Array<{ id: string; submittedByUserId?: string }> };

function memberHeaders(userId: string): Record<string, string> {
  return {
    "x-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-authenticated-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-user-id": userId,
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-operator-member",
  };
}

function seedMember(userId: string, mobile: string): void {
  const repo = getIdentityRepository();
  repo.seedUser({ id: userId, mobile });
  repo.seedMembership({
    userId,
    tenantId: OPERATOR_SMOKE.tenantId,
    role: "member",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: "ws-operator-member",
  });
}

function seedMemberBooking(input: { id: string; userId: string; guestLabel: string }): void {
  getBookingsRepository().seedBooking({
    id: input.id,
    tenantId: OPERATOR_SMOKE.tenantId,
    tourId: OPERATOR_SMOKE.seedTourId,
    tourTitle: "North Ridge Trek",
    guestLabel: input.guestLabel,
    guestEmail: null,
    guestPhone: null,
    partySize: 1,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    submittedAt: new Date().toISOString(),
    submittedByUserId: input.userId,
    approvedAt: null,
  });
}

describe("bookings-member-isolation.spec.ts — MEM-04", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  before(() => {
    seedOperatorIdentityFixture();
    seedOperatorBookingsFixture();
    seedMember(MEMBER_A_USER_ID, OPERATOR_SMOKE.memberMobile);
    seedMember(MEMBER_B_USER_ID, "+15550001004");
    seedMemberBooking({ id: MEMBER_A_BOOKING_ID, userId: MEMBER_A_USER_ID, guestLabel: "Member A" });
    seedMemberBooking({ id: MEMBER_B_BOOKING_ID, userId: MEMBER_B_USER_ID, guestLabel: "Member B" });
  });

  it("MEM-04-01 view=mine returns only the requesting member's own booking", async () => {
    const response = await client.requestJson<BookingsListBody>("GET", "/bookings?view=mine", {
      headers: memberHeaders(MEMBER_A_USER_ID),
    });
    assert.equal(response.status, 200);
    const ids = (response.body.items ?? []).map((item) => item.id);
    assert.ok(ids.includes(MEMBER_A_BOOKING_ID), "member A must see own booking");
    assert.ok(!ids.includes(MEMBER_B_BOOKING_ID), "member A must NOT see member B booking");
  });

  it("MEM-04-02 another member never sees the first member's booking", async () => {
    const response = await client.requestJson<BookingsListBody>("GET", "/bookings?view=mine", {
      headers: memberHeaders(MEMBER_B_USER_ID),
    });
    assert.equal(response.status, 200);
    const ids = (response.body.items ?? []).map((item) => item.id);
    assert.ok(ids.includes(MEMBER_B_BOOKING_ID), "member B must see own booking");
    assert.ok(!ids.includes(MEMBER_A_BOOKING_ID), "member B must NOT see member A booking");
  });
});
