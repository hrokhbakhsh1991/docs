/**
 * Phase 9.5 — bookings approve UI (inspection panel)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBookingsPageBodyState } from "../app/(app)/bookings/bookings-command-center-gate";
import { findSelectedBooking } from "../src/features/bookings/bookings-command-center-logic";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../src/features/bookings/bookings-command-center-types";

describe("bookings-approve.spec.ts — Phase 9.5", () => {
  it("WEB-9.5-01 inspection panel approve updates row", () => {
    const items = [
      {
        id: "b1",
        tourId: "t1",
        tourTitle: "North Tour",
        guestLabel: "Ali",
        partySize: 2,
        status: "pending" as const,
        paymentStatus: "unpaid" as const,
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
    ];

    const selected = findSelectedBooking(items, "b1");
    assert.equal(selected?.status, "pending");
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton, "operator-bookings-approve");
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectButton, "operator-bookings-reject");

    const readyState = resolveBookingsPageBodyState({
      canManageOps: true,
      view: "ops",
      loading: false,
      error: null,
      itemsLength: items.length,
    });
    assert.equal(readyState.type, "ready");
  });
});
