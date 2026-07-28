/**
 * Phase 1 — Denali booking capacity / validation / operator decisions.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BookingCreatePolicyContext } from "@app-tour/booking-http-contracts";

import {
  DEFAULT_DENALI_CAPACITY_RULE,
  DenaliBookingCapacityPolicyAdapter,
  DenaliBookingValidationPolicyAdapter,
  assertDenaliCreateCapacity,
  assertDenaliCreateValid,
  computeDenaliAvailability,
  createDenaliBookingPendingSnapshot,
  decideDenaliApprove,
  decideDenaliCancel,
  decideDenaliPromoteWaitlist,
  decideDenaliReject,
  decideDenaliWaitlist,
  evaluateDenaliCreateCapacity,
} from "../src/booking/index.ts";

function ctx(
  overrides: Partial<BookingCreatePolicyContext> = {}
): BookingCreatePolicyContext {
  return {
    tenantId: "ten-1",
    tourId: "tour-1",
    tourTitle: "Damavand",
    guestLabel: "Guest",
    partySize: 2,
    departureAt: "2026-08-01T06:00:00.000Z",
    occupiedApprovedPartySize: 0,
    tourCapacityMax: 10,
    ...overrides,
  };
}

describe("booking-capacity-policy.spec.ts — Denali Phase 1", () => {
  it("DN-B1-C01 availability remaining seats", () => {
    const availability = computeDenaliAvailability(3, 10);
    assert.ok(availability !== null);
    assert.equal(availability.remaining, 7);
    assert.equal(computeDenaliAvailability(0, null), null);
  });

  it("DN-B1-C02 evaluate accept vs deny", () => {
    assert.equal(evaluateDenaliCreateCapacity(ctx()).decision, "accept");
    assert.equal(
      evaluateDenaliCreateCapacity(ctx({ occupiedApprovedPartySize: 9, partySize: 2 })).decision,
      "deny"
    );
  });

  it("DN-B1-C03 adapter capacity rejects overfill with contract message", () => {
    const adapter = new DenaliBookingCapacityPolicyAdapter();
    assert.throws(
      () => adapter.assertCreateCapacity(ctx({ occupiedApprovedPartySize: 9, partySize: 2 })),
      /BOOKING_CAPACITY_REJECTED/
    );
    adapter.assertCreateCapacity(ctx({ occupiedApprovedPartySize: 8, partySize: 2 }));
  });

  it("DN-B1-C04 validation enforces maxPartySize and departureAt", () => {
    const adapter = new DenaliBookingValidationPolicyAdapter();
    adapter.assertCreateValid(ctx());
    assert.throws(
      () => assertDenaliCreateValid(ctx({ partySize: DEFAULT_DENALI_CAPACITY_RULE.maxPartySize + 1 })),
      /partySize must be <=/
    );
    assert.throws(
      () => assertDenaliCreateValid(ctx({ departureAt: "   " })),
      /departureAt is required/
    );
    assert.throws(
      () => assertDenaliCreateValid(ctx({ partySize: 1.5 })),
      /integer/
    );
  });

  it("DN-B1-C05 missing capacity max still rejected", () => {
    assert.throws(
      () => assertDenaliCreateCapacity(ctx({ tourCapacityMax: null })),
      /tourCapacityMax required/
    );
  });
});

describe("booking-operator-decisions.spec.ts — Denali Phase 1", () => {
  it("DN-B1-O01 approve pending with capacity", () => {
    const pending = createDenaliBookingPendingSnapshot({
      id: "b1",
      tourId: "tour-1",
      partySize: 2,
    });
    const approved = decideDenaliApprove(pending, { actorId: "op" }, ctx());
    assert.equal(approved.status, "approved");
    assert.equal(approved.history.at(-1)?.action, "approve");
  });

  it("DN-B1-O02 approve denied when capacity full", () => {
    const pending = createDenaliBookingPendingSnapshot({
      id: "b2",
      tourId: "tour-1",
      partySize: 2,
    });
    assert.throws(
      () =>
        decideDenaliApprove(
          pending,
          {},
          ctx({ occupiedApprovedPartySize: 9, partySize: 2 })
        ),
      /BOOKING_CAPACITY_REJECTED/
    );
  });

  it("DN-B1-O03 waitlist → promote → cancel path", () => {
    const pending = createDenaliBookingPendingSnapshot({
      id: "b3",
      tourId: "tour-1",
      partySize: 1,
    });
    const waitlisted = decideDenaliWaitlist(pending, { actorId: "op" });
    assert.equal(waitlisted.status, "waitlisted");
    const promoted = decideDenaliPromoteWaitlist(waitlisted, { actorId: "op" }, ctx());
    assert.equal(promoted.status, "approved");
    assert.equal(promoted.history.at(-1)?.action, "promote_waitlist");
    const cancelled = decideDenaliCancel(promoted, { reason: "guest request" });
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.history.length, 4);
  });

  it("DN-B1-O04 reject from pending", () => {
    const pending = createDenaliBookingPendingSnapshot({
      id: "b4",
      tourId: "tour-1",
      partySize: 1,
    });
    const rejected = decideDenaliReject(pending, { reason: "incomplete" });
    assert.equal(rejected.status, "rejected");
    assert.throws(() => decideDenaliApprove(rejected), /TRANSITION_REJECTED/);
  });

  it("DN-B1-O05 waitlist disabled fails closed", () => {
    const pending = createDenaliBookingPendingSnapshot({
      id: "b5",
      tourId: "tour-1",
      partySize: 1,
    });
    assert.throws(
      () =>
        decideDenaliWaitlist(pending, {}, { ...DEFAULT_DENALI_CAPACITY_RULE, waitlistEnabled: false }),
      /WAITLIST_DISABLED/
    );
  });
});
