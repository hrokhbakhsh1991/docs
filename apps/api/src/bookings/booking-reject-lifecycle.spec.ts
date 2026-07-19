/**
 * Booking reject lifecycle — decision B: intentionally silent + persist rejectReason.
 *
 * Covers: reject / list / detail / history / reason retrieval / outbox silence.
 * No decorative BOOKING_REJECT_OUTBOX_* / notification-ownership tables.
 *
 * @see docs/phase-20/p7/appendices/BOOKING_REJECT_LIFECYCLE_OWNERSHIP.md
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
} from "@app-tour/booking-http-contracts";

import { getBookingsRepository, resetBookingsRepositoryForTests } from "./create-bookings-repository.ts";
import { peekOutboxByAggregateForTests } from "./in-memory-bookings.repository.ts";
import {
  approveBooking,
  cancelBooking,
  createBooking,
  listBookings,
  rejectBooking,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";

const TENANT_DENALI = "00000000-0000-4000-8000-000000000014";
const TOUR_DENALI = "00000000-0000-4000-8000-000000000892";

function opsAuth(): BookingActorContext {
  return {
    tenantId: TENANT_DENALI,
    userId: "00000000-0000-4000-8000-000000000201",
    role: "admin",
    status: "ACTIVE",
  };
}

function body(guestLabel: string) {
  return {
    tourId: TOUR_DENALI,
    tourTitle: "Reject Lifecycle Tour",
    guestLabel,
    guestEmail: `${guestLabel.replace(/\s+/g, "-").toLowerCase()}@example.com`,
    partySize: 1,
    departureAt: "2031-07-01T10:00:00.000Z",
    registrationIntake: { tourCapacityMax: 20 },
  };
}

async function outboxTypes(bookingId: string): Promise<string[]> {
  const rows = await peekOutboxByAggregateForTests({
    tenantId: TENANT_DENALI,
    aggregateId: bookingId,
  });
  return rows.map((row) => row.eventType);
}

describe("booking reject lifecycle (intentionally silent)", { concurrency: false }, () => {
  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  after(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("approve: emits registration.approved outbox row", async () => {
    const created = await createBooking(opsAuth(), body("Approve Outbox Guest"));
    const approved = await approveBooking(opsAuth(), created.id);
    assert.equal(approved.status, "approved");

    const types = await outboxTypes(created.id);
    assert.equal(types.length, 1);
    assert.equal(types[0], BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
  });

  it("reject: persists status + reason and leaves zero outbox rows", async () => {
    const created = await createBooking(opsAuth(), body("Reject Silent Guest"));
    const rejected = await rejectBooking(opsAuth(), created.id, {
      reason: "  capacity exceeded  ",
    });
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectReason, "capacity exceeded");

    const types = await outboxTypes(created.id);
    assert.equal(types.length, 0);
  });

  it("reject without reason remains valid (backward compatible)", async () => {
    const created = await createBooking(opsAuth(), body("Reject No Reason"));
    const rejected = await rejectBooking(opsAuth(), created.id, {});
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectReason, undefined);
  });

  it("detail: getById returns persisted rejectReason", async () => {
    const created = await createBooking(opsAuth(), body("Reject Detail Guest"));
    await rejectBooking(opsAuth(), created.id, { reason: "docs incomplete" });

    const detail = await getBookingsRepository().getById(created.id, TENANT_DENALI);
    assert.ok(detail);
    assert.equal(detail.status, "rejected");
    assert.equal(detail.rejectReason, "docs incomplete");
  });

  it("list: status=rejected history exposes rejectReason", async () => {
    const a = await createBooking(opsAuth(), body("Reject History A"));
    const b = await createBooking(opsAuth(), body("Reject History B"));
    await rejectBooking(opsAuth(), a.id, { reason: "fraud" });
    await rejectBooking(opsAuth(), b.id, { reason: "duplicate" });

    const listed = await listBookings(opsAuth(), {
      view: "ops",
      status: "rejected",
      limit: 50,
    });
    const byId = new Map(listed.items.map((item) => [item.id, item]));
    assert.equal(byId.get(a.id)?.rejectReason, "fraud");
    assert.equal(byId.get(b.id)?.rejectReason, "duplicate");
    assert.equal(byId.get(a.id)?.status, "rejected");
    assert.equal(byId.get(b.id)?.status, "rejected");
  });

  it("reason retrieval: repository + list + reject response agree", async () => {
    const created = await createBooking(opsAuth(), body("Reject Reason Sync"));
    const reason = "waitlist preferred";
    const rejected = await rejectBooking(opsAuth(), created.id, { reason });

    const detail = await getBookingsRepository().getById(created.id, TENANT_DENALI);
    const listed = await listBookings(opsAuth(), {
      view: "ops",
      status: "rejected",
      limit: 50,
    });
    const listItem = listed.items.find((item) => item.id === created.id);

    assert.equal(rejected.rejectReason, reason);
    assert.equal(detail?.rejectReason, reason);
    assert.equal(listItem?.rejectReason, reason);
  });

  it("cancel: emits registration.cancelled outbox row", async () => {
    const created = await createBooking(opsAuth(), body("Cancel Outbox Guest"));
    const cancelled = await cancelBooking(opsAuth(), created.id);
    assert.equal(cancelled.status, "cancelled");

    const types = await outboxTypes(created.id);
    assert.equal(types.length, 1);
    assert.equal(types[0], BOOKING_CANCEL_OUTBOX_EVENT_TYPE);
  });

  it("compare outbox: approve observable, reject silent, cancel observable", async () => {
    const approveId = (await createBooking(opsAuth(), body("Compare Approve"))).id;
    await approveBooking(opsAuth(), approveId);

    const rejectId = (await createBooking(opsAuth(), body("Compare Reject"))).id;
    await rejectBooking(opsAuth(), rejectId, { reason: "silent" });

    const cancelId = (await createBooking(opsAuth(), body("Compare Cancel"))).id;
    await cancelBooking(opsAuth(), cancelId);

    const approveTypes = await outboxTypes(approveId);
    const rejectTypes = await outboxTypes(rejectId);
    const cancelTypes = await outboxTypes(cancelId);

    assert.deepEqual(approveTypes, [BOOKING_APPROVE_OUTBOX_EVENT_TYPE]);
    assert.deepEqual(rejectTypes, []);
    assert.deepEqual(cancelTypes, [BOOKING_CANCEL_OUTBOX_EVENT_TYPE]);

    // Explicit asymmetry: silent reject ≠ observable cancel
    assert.notEqual(rejectTypes.length, cancelTypes.length);
  });
});
