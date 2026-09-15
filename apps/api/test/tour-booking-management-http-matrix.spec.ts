/**
 * HTTP-level booking management matrix.
 *
 * The pure matrices prove policy functions; this spec proves that the real
 * dispatcher, auth boundary, service, repository and response mapping agree
 * on every action/status pair.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app.ts";
import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "../src/bookings/create-bookings-repository.ts";
import { resetIdentityRepositoryForTests } from "../src/identity/create-identity-repository.ts";
import { installHttpTestClient } from "./http-test-client.ts";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers.ts";

installMemoryStorageDriverForDescribe();

const TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OWNER_ID = "00000000-0000-4000-8000-000000000101";
const MEMBER_ID = "00000000-0000-4000-8000-000000000103";
const TOUR_ID = "00000000-0000-4000-8000-000000000210";

const BOOKING_STATUSES = ["pending", "waitlisted", "approved", "rejected", "cancelled"] as const;
type BookingStatus = (typeof BOOKING_STATUSES)[number];
type Action = "approve" | "reject" | "waitlist" | "cancel";

const ACTION_TARGETS: Readonly<Record<Action, BookingStatus>> = {
  approve: "approved",
  reject: "rejected",
  waitlist: "waitlisted",
  cancel: "cancelled",
};

const ALLOWED_ACTIONS: Readonly<Record<BookingStatus, readonly Action[]>> = {
  pending: ["approve", "reject", "waitlist", "cancel"],
  waitlisted: ["approve", "reject", "cancel"],
  approved: ["cancel"],
  rejected: [],
  cancelled: [],
};

function authHeaders(userId = OWNER_ID, role: "owner" | "member" = "owner") {
  return {
    "x-tenant-id": TENANT_ID,
    "x-authenticated-tenant-id": TENANT_ID,
    "x-user-id": userId,
    "x-actor-role": role,
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-tour-management-http",
  };
}

function bookingId(index: number): string {
  return `00000000-0000-4000-8000-${String(1000 + index).padStart(12, "0")}`;
}

function seedBooking(id: string, status: BookingStatus): void {
  getBookingsRepository().seedBooking({
    id,
    tenantId: TENANT_ID,
    tourId: TOUR_ID,
    tourTitle: "HTTP Management Matrix",
    guestLabel: `Guest ${id.slice(-4)}`,
    guestEmail: null,
    guestPhone: "+15550001000",
    partySize: 1,
    status,
    paymentStatus: "unpaid",
    departureAt: "2031-06-01T10:00:00.000Z",
    submittedAt: "2031-05-01T10:00:00.000Z",
    submittedByUserId: MEMBER_ID,
    approvedAt: status === "approved" ? "2031-05-01T11:00:00.000Z" : null,
    registrationIntake: { tourCapacityMax: 100 },
  });
}

function actionPath(action: Action, id: string): string {
  return `/bookings/${id}/${action}`;
}

describe("tour-booking-management HTTP matrix", { concurrency: false }, () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    const identity = resetIdentityRepositoryForTests();
    identity.seedUser({ id: OWNER_ID, mobile: "+15550001001" });
    identity.seedUser({ id: MEMBER_ID, mobile: "+15550001003" });
    identity.seedMembership({
      userId: OWNER_ID,
      tenantId: TENANT_ID,
      role: "owner",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-tour-management-http",
    });
    identity.seedMembership({
      userId: MEMBER_ID,
      tenantId: TENANT_ID,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-tour-management-http",
    });
  });

  it("executes every action/status pair through the HTTP dispatcher", async () => {
    let index = 0;
    for (const from of BOOKING_STATUSES) {
      for (const action of ["approve", "reject", "waitlist", "cancel"] as const) {
        const id = bookingId(index++);
        seedBooking(id, from);
        const response = await client.requestJson("POST", actionPath(action, id), {
          headers: authHeaders(),
          ...(action === "reject" ? { body: { reason: `reject ${from}` } } : {}),
        });
        const allowed = ALLOWED_ACTIONS[from].includes(action);
        assert.equal(response.status === 200, allowed, `${from} -> ${action}`);

        const detail = await client.requestJson<{ status?: string }>("GET", `/bookings/${id}`, {
          headers: authHeaders(),
        });
        assert.equal(detail.status, 200, `detail ${from} -> ${action}`);
        assert.equal(
          detail.body.status,
          allowed ? ACTION_TARGETS[action] : from,
          `state ${from} -> ${action}`
        );
      }
    }
  });

  it("fails closed for member mutation attempts", async () => {
    const id = bookingId(90);
    seedBooking(id, "pending");
    for (const action of ["approve", "reject", "waitlist", "cancel"] as const) {
      const response = await client.requestJson("POST", actionPath(action, id), {
        headers: authHeaders(MEMBER_ID, "member"),
        ...(action === "reject" ? { body: { reason: "not allowed" } } : {}),
      });
      assert.equal(response.status, 403, `member ${action}`);
    }

    const list = await client.requestJson("GET", "/bookings?view=ops", {
      headers: authHeaders(MEMBER_ID, "member"),
    });
    assert.equal(list.status, 403, "member ops list");
  });

  it("returns approved and skipped IDs for bulk approval without hiding duplicates", async () => {
    const first = bookingId(91);
    const second = bookingId(92);
    const alreadyApproved = bookingId(93);
    seedBooking(first, "pending");
    seedBooking(second, "waitlisted");
    seedBooking(alreadyApproved, "approved");

    const response = await client.requestJson<{ approvedIds?: string[]; skippedIds?: string[] }>(
      "POST",
      "/bookings/bulk-approve",
      {
        headers: authHeaders(),
        body: { ids: [first, first, second, alreadyApproved, bookingId(94), ""] },
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.approvedIds, [first, second]);
    assert.deepEqual(response.body.skippedIds, [alreadyApproved, bookingId(94)]);
  });
});
