/**
 * UX-BKG-46 — Phase 1 action chrome from RegistrationOpsManifest slice.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
        ...(patch.requiresReason !== undefined ? { requiresReason: patch.requiresReason } : {}),
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
  it("null manifest → platform-safe neutral defaults", () => {
    assert.deepEqual(resolveBookingsOpsActionChrome(null), DEFAULT_BOOKINGS_OPS_ACTION_CHROME);
    assert.deepEqual(resolveBookingsOpsActionChrome(undefined), DEFAULT_BOOKINGS_OPS_ACTION_CHROME);
    assert.equal(DEFAULT_BOOKINGS_OPS_ACTION_CHROME.bulkApproveMaxBatch, 0);
    assert.equal(DEFAULT_BOOKINGS_OPS_ACTION_CHROME.rejectRequiresReason, true);
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

  it("invalid maxBatch falls back to neutral bulk-off default", () => {
    assert.equal(
      resolveBookingsOpsActionChrome(fakeManifest({ maxBatch: 0 })).bulkApproveMaxBatch,
      0
    );
    assert.equal(
      resolveBookingsOpsActionChrome(fakeManifest({ maxBatch: -3 })).bulkApproveMaxBatch,
      0
    );
  });

  it("does not preserve Denali-shaped null manifest defaults in source", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/bookings/bookings-ops-action-chrome.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /Denali-shaped command affordances/);
    assert.doesNotMatch(source, /Denali-shaped hardcode defaults/);
    assert.doesNotMatch(source, /bulkApproveMaxBatch:\s*BULK_APPROVE_MAX_BATCH/);
  });
});
