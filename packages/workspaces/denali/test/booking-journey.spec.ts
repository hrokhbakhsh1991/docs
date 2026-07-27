/**
 * Phase 1 Wave D — package journey simulation (no apps/web).
 * Guest create policy → pending → operator review → approve/reject → final.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_DENALI_CAPACITY_RULE,
  DENALI_BOOKING_OPS_ACTION_KEYS,
  DenaliBookingCapacityPolicyAdapter,
  DenaliBookingValidationPolicyAdapter,
  applyDenaliBookingOpsAction,
  buildDenaliBookingCreatePolicyContext,
  createDenaliBookingPendingSnapshot,
  denaliPartySizeFromParticipants,
  evaluateDenaliCreateCapacity,
} from "../src/booking/index.ts";
import { denaliRegistrationOpsManifest } from "../src/bookings/ops-manifest.ts";

describe("booking-journey.spec.ts — Denali Phase 1 exit path", () => {
  const validation = new DenaliBookingValidationPolicyAdapter();
  const capacity = new DenaliBookingCapacityPolicyAdapter();

  it("DN-B1-J01 guest create → operator approve → final approved", () => {
    const policyCtx = buildDenaliBookingCreatePolicyContext({
      tenantId: "ten-denali",
      tourId: "tour-1",
      tourTitle: "Damavand",
      guestLabel: "Guest One",
      partySize: 2,
      departureAt: "2026-08-01T06:00:00.000Z",
      occupiedApprovedPartySize: 4,
      tourCapacityMax: 10,
    });

    validation.assertCreateValid(policyCtx);
    capacity.assertCreateCapacity(policyCtx);
    assert.equal(evaluateDenaliCreateCapacity(policyCtx).decision, "accept");

    let booking = createDenaliBookingPendingSnapshot({
      id: "reg-1",
      tourId: policyCtx.tourId,
      partySize: policyCtx.partySize,
      actorId: "guest-1",
      at: "2026-07-26T10:00:00.000Z",
    });
    assert.equal(booking.status, "pending");

    booking = applyDenaliBookingOpsAction({
      action: "approve",
      booking,
      meta: { actorId: "op-1", at: "2026-07-26T11:00:00.000Z" },
      capacityCtx: policyCtx,
    });
    assert.equal(booking.status, "approved");
    assert.equal(booking.history.length, 2);
    assert.equal(booking.history[0]?.action, "create");
    assert.equal(booking.history[1]?.action, "approve");
  });

  it("DN-B1-J02 guest create → reject path terminal", () => {
    const policyCtx = buildDenaliBookingCreatePolicyContext({
      tenantId: "ten-denali",
      tourId: "tour-1",
      tourTitle: "Damavand",
      guestLabel: "Guest Two",
      partySize: 1,
      departureAt: "2026-08-01T06:00:00.000Z",
      occupiedApprovedPartySize: 0,
      tourCapacityMax: 10,
    });
    validation.assertCreateValid(policyCtx);
    capacity.assertCreateCapacity(policyCtx);

    let booking = createDenaliBookingPendingSnapshot({
      id: "reg-2",
      tourId: policyCtx.tourId,
      partySize: 1,
    });
    booking = applyDenaliBookingOpsAction({
      action: "reject",
      booking,
      meta: { reason: "incomplete docs" },
    });
    assert.equal(booking.status, "rejected");
    assert.throws(
      () =>
        applyDenaliBookingOpsAction({
          action: "approve",
          booking,
          capacityCtx: policyCtx,
        }),
      /TRANSITION_REJECTED/
    );
  });

  it("DN-B1-J03 capacity full denies create; waitlist→promote when seat frees", () => {
    const fullCtx = buildDenaliBookingCreatePolicyContext({
      tenantId: "ten-denali",
      tourId: "tour-1",
      tourTitle: "Damavand",
      guestLabel: "Late Guest",
      partySize: 2,
      departureAt: "2026-08-01T06:00:00.000Z",
      occupiedApprovedPartySize: 9,
      tourCapacityMax: 10,
    });
    assert.equal(evaluateDenaliCreateCapacity(fullCtx).decision, "deny");
    assert.throws(() => capacity.assertCreateCapacity(fullCtx), /BOOKING_CAPACITY_REJECTED/);

    let booking = createDenaliBookingPendingSnapshot({
      id: "reg-3",
      tourId: "tour-1",
      partySize: 1,
    });
    booking = applyDenaliBookingOpsAction({ action: "waitlist", booking });
    assert.equal(booking.status, "waitlisted");

    const freeCtx = buildDenaliBookingCreatePolicyContext({
      tenantId: "ten-denali",
      tourId: "tour-1",
      tourTitle: "Damavand",
      guestLabel: "Late Guest",
      partySize: 1,
      departureAt: "2026-08-01T06:00:00.000Z",
      occupiedApprovedPartySize: 9,
      tourCapacityMax: 10,
    });
    booking = applyDenaliBookingOpsAction({
      action: "promoteWaitlist",
      booking,
      capacityCtx: freeCtx,
    });
    assert.equal(booking.status, "approved");
    assert.equal(booking.history.at(-1)?.action, "promote_waitlist");
  });

  it("DN-B1-J04 exact capacity fill accepted; +1 denied", () => {
    const exact = buildDenaliBookingCreatePolicyContext({
      tenantId: "ten-denali",
      tourId: "tour-1",
      tourTitle: "Damavand",
      guestLabel: "Exact",
      partySize: 3,
      departureAt: "2026-08-01T06:00:00.000Z",
      occupiedApprovedPartySize: 7,
      tourCapacityMax: 10,
    });
    capacity.assertCreateCapacity(exact);

    const overflow = { ...exact, partySize: 4 };
    assert.throws(() => capacity.assertCreateCapacity(overflow), /BOOKING_CAPACITY_REJECTED/);
  });

  it("DN-B1-J05 ops action keys cover manifest actions + waitlist/cancel helpers", () => {
    const manifestKeys = Object.keys(denaliRegistrationOpsManifest.actions);
    for (const key of manifestKeys) {
      assert.ok(
        (DENALI_BOOKING_OPS_ACTION_KEYS as readonly string[]).includes(key),
        `missing ops mapping for ${key}`
      );
    }
    assert.ok((DENALI_BOOKING_OPS_ACTION_KEYS as readonly string[]).includes("waitlist"));
    assert.ok((DENALI_BOOKING_OPS_ACTION_KEYS as readonly string[]).includes("cancel"));
    assert.equal(DEFAULT_DENALI_CAPACITY_RULE.waitlistEnabled, true);
  });

  it("DN-B1-J06 participant seats sum to partySize", () => {
    assert.equal(
      denaliPartySizeFromParticipants([{ seats: 1 }, { seats: 2 }, { label: "child" }]),
      4
    );
    assert.throws(
      () => denaliPartySizeFromParticipants([{ seats: 0 }]),
      /seats must be an integer/
    );
  });

  it("DN-B1-J07 approve → cancel history is append-only", () => {
    const policyCtx = buildDenaliBookingCreatePolicyContext({
      tenantId: "ten-denali",
      tourId: "tour-1",
      tourTitle: "Damavand",
      guestLabel: "Cancel Guest",
      partySize: 1,
      departureAt: "2026-08-01T06:00:00.000Z",
      occupiedApprovedPartySize: 0,
      tourCapacityMax: 10,
    });
    validation.assertCreateValid(policyCtx);
    capacity.assertCreateCapacity(policyCtx);

    let booking = createDenaliBookingPendingSnapshot({
      id: "reg-cancel",
      tourId: "tour-1",
      partySize: 1,
    });
    booking = applyDenaliBookingOpsAction({
      action: "approve",
      booking,
      capacityCtx: policyCtx,
    });
    booking = applyDenaliBookingOpsAction({
      action: "cancel",
      booking,
      meta: { reason: "weather" },
    });
    assert.equal(booking.status, "cancelled");
    assert.equal(booking.history.length, 3);
    assert.deepEqual(
      booking.history.map((h) => h.action),
      ["create", "approve", "cancel"]
    );
    assert.equal(booking.history.at(-1)?.reason, "weather");
  });

  it("DN-B1-J08 overbookAllowed accepts otherwise-denied create", () => {
    const over = buildDenaliBookingCreatePolicyContext({
      tenantId: "ten-denali",
      tourId: "tour-1",
      tourTitle: "Damavand",
      guestLabel: "Overbook",
      partySize: 5,
      departureAt: "2026-08-01T06:00:00.000Z",
      occupiedApprovedPartySize: 9,
      tourCapacityMax: 10,
    });
    assert.equal(evaluateDenaliCreateCapacity(over).decision, "deny");
    assert.equal(
      evaluateDenaliCreateCapacity(over, {
        ...DEFAULT_DENALI_CAPACITY_RULE,
        overbookAllowed: true,
      }).decision,
      "accept"
    );
  });

  it("DN-B1-J09 bulkApprove is sequential approve; second may fail capacity", () => {
    const base = {
      tenantId: "ten-denali",
      tourId: "tour-1",
      tourTitle: "Damavand",
      departureAt: "2026-08-01T06:00:00.000Z",
      tourCapacityMax: 3,
    } as const;

    let bookingA = createDenaliBookingPendingSnapshot({
      id: "bulk-a",
      tourId: "tour-1",
      partySize: 2,
    });
    let bookingB = createDenaliBookingPendingSnapshot({
      id: "bulk-b",
      tourId: "tour-1",
      partySize: 2,
    });

    bookingA = applyDenaliBookingOpsAction({
      action: "bulkApprove",
      booking: bookingA,
      capacityCtx: buildDenaliBookingCreatePolicyContext({
        ...base,
        guestLabel: "A",
        partySize: 2,
        occupiedApprovedPartySize: 0,
      }),
    });
    assert.equal(bookingA.status, "approved");

    assert.throws(
      () =>
        applyDenaliBookingOpsAction({
          action: "bulkApprove",
          booking: bookingB,
          capacityCtx: buildDenaliBookingCreatePolicyContext({
            ...base,
            guestLabel: "B",
            partySize: 2,
            occupiedApprovedPartySize: 2,
          }),
        }),
      /BOOKING_CAPACITY_REJECTED/
    );
    assert.equal(bookingB.status, "pending");
  });

  it("DN-B1-J10 tourCapacityMax 0 denies create", () => {
    const zero = buildDenaliBookingCreatePolicyContext({
      tenantId: "ten-denali",
      tourId: "tour-1",
      tourTitle: "Damavand",
      guestLabel: "Zero Cap",
      partySize: 1,
      departureAt: "2026-08-01T06:00:00.000Z",
      occupiedApprovedPartySize: 0,
      tourCapacityMax: 0,
    });
    assert.equal(evaluateDenaliCreateCapacity(zero).decision, "deny");
    assert.throws(() => capacity.assertCreateCapacity(zero), /tourCapacityMax required/);
  });
});
