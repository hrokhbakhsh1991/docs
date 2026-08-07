/**
 * UX-BKG-46 — Phase 1 action chrome from RegistrationOpsManifest slice.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BookingOpsCapability } from "../src/features/bookings/booking-ops-capability-contract";
import {
  DEFAULT_BOOKINGS_OPS_ACTION_CHROME,
  resolveBookingsOpsActionChrome,
} from "../src/features/bookings/bookings-ops-action-chrome";

function fakeManifest(
  patch: Partial<{
    maxBatch: number;
    requiresReason: boolean | undefined;
  }>
): BookingOpsCapability {
  return {
    id: "test_ops",
    defaultView: "inbox_table",
    views: ["inbox_table"],
    statusPipeline: ["pending"],
    kpiCards: ["pending"],
    filters: ["status"],
    columns: {
      inbox_table: ["guest"],
      tour_board: { groupBy: "tourId", columns: ["pending"] },
    },
    actions: {
      approve: { ability: "operator.bookings.approve", outboxEvent: "registration.approved" },
      reject: {
        ability: "operator.bookings.approve",
        ...(patch.requiresReason !== undefined
          ? { requiresReason: patch.requiresReason }
          : {}),
      },
      promoteWaitlist: { ability: "operator.bookings.approve" },
      bulkApprove: {
        ability: "operator.bookings.approve",
        maxBatch: patch.maxBatch ?? 25,
      },
    },
    leaderReviewAlias: { enabled: false, path: "/leader/review", query: "" },
  };
}

describe("bookings-ops-action-chrome — UX-BKG-46", () => {
  it("null manifest → Denali-shaped defaults", () => {
    assert.deepEqual(resolveBookingsOpsActionChrome(null), DEFAULT_BOOKINGS_OPS_ACTION_CHROME);
    assert.deepEqual(resolveBookingsOpsActionChrome(undefined), DEFAULT_BOOKINGS_OPS_ACTION_CHROME);
    assert.equal(DEFAULT_BOOKINGS_OPS_ACTION_CHROME.bulkApproveMaxBatch, 25);
    assert.equal(DEFAULT_BOOKINGS_OPS_ACTION_CHROME.rejectRequiresReason, false);
  });

  it("reads maxBatch + requiresReason from manifest", () => {
    assert.deepEqual(resolveBookingsOpsActionChrome(fakeManifest({ maxBatch: 25 })), {
      bulkApproveMaxBatch: 25,
      rejectRequiresReason: false,
    });
    assert.deepEqual(
      resolveBookingsOpsActionChrome(fakeManifest({ maxBatch: 10, requiresReason: true })),
      {
        bulkApproveMaxBatch: 10,
        rejectRequiresReason: true,
      }
    );
  });

  it("invalid maxBatch falls back to default", () => {
    assert.equal(
      resolveBookingsOpsActionChrome(fakeManifest({ maxBatch: 0 })).bulkApproveMaxBatch,
      25
    );
    assert.equal(
      resolveBookingsOpsActionChrome(fakeManifest({ maxBatch: -3 })).bulkApproveMaxBatch,
      25
    );
  });
});
