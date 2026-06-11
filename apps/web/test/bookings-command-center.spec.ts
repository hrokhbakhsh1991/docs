/**
 * Phase 9.5 — Registration Command Center UI
 * Authority: docs/phase-9/appendices/BOOKINGS-OPS-UX.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBookingsPageBodyState } from "../app/(app)/bookings/bookings-command-center-gate";
import {
  buildBookingsApiQuery,
  buildBookingsDetailDeepLinkHref,
  filterBulkApprovableIds,
  isLeaderReviewAlias,
  isTourChipActive,
  parseBookingsCommandCenterQuery,
  readBookingIdFromCommandCenterParams,
  serializeBookingsCommandCenterQuery,
  toggleTourChipFilter,
} from "../src/features/bookings/bookings-command-center-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
  isAdminOrOwnerRole,
} from "../src/features/bookings/bookings-command-center-types";

describe("bookings-command-center.spec.ts — Phase 9.5 Web", () => {
  it("WEB-9.5-02 inbox table renders KPI strip and tour chips", () => {
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.page, "operator-bookings-page");
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.kpiStrip, "operator-bookings-kpi");
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox, "operator-bookings-inbox");
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection, "operator-bookings-inspection");
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton, "operator-bookings-approve");
    assert.equal(isAdminOrOwnerRole("owner"), true);
    assert.equal(isAdminOrOwnerRole("member"), false);

    const serialized = serializeBookingsCommandCenterQuery({
      ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
      status: "pending",
      search: "ali",
    });
    const parsed = parseBookingsCommandCenterQuery(new URLSearchParams(serialized));
    assert.equal(parsed.status, "pending");
    assert.equal(parsed.search, "ali");

    const apiQuery = buildBookingsApiQuery(parsed);
    assert.match(apiQuery, /view=ops/);
    assert.match(apiQuery, /status=pending/);
    assert.match(apiQuery, /q=ali/);
  });

  it("WEB-9.5-04 tour chips and bulk approve helpers (S9.5-R3)", () => {
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.tourChips, "operator-bookings-tour-chips");
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.bulkApproveButton,
      "operator-bookings-bulk-approve"
    );

    const withTour = toggleTourChipFilter(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY, "tour-1");
    assert.equal(withTour.tourId, "tour-1");
    assert.equal(isTourChipActive(withTour, "tour-1"), true);
    const cleared = toggleTourChipFilter(withTour, "tour-1");
    assert.equal(cleared.tourId, "");

    const items = [
      {
        id: "b1",
        tourId: "t1",
        tourTitle: "North",
        guestLabel: "Ali",
        partySize: 2,
        status: "pending" as const,
        paymentStatus: "unpaid" as const,
        departureAt: "2026-07-01",
        submittedAt: "2026-06-01",
      },
      {
        id: "b2",
        tourId: "t1",
        tourTitle: "North",
        guestLabel: "Sara",
        partySize: 1,
        status: "approved" as const,
        paymentStatus: "paid" as const,
        departureAt: "2026-07-02",
        submittedAt: "2026-06-02",
      },
    ];
    const bulkIds = filterBulkApprovableIds(items, ["b1", "b2"]);
    assert.deepEqual(bulkIds, ["b1"]);

    const paymentQuery = parseBookingsCommandCenterQuery(
      new URLSearchParams("paymentStatus=unpaid")
    );
    assert.equal(paymentQuery.paymentStatus, "unpaid");
    assert.match(buildBookingsApiQuery(paymentQuery), /paymentStatus=unpaid/);

    const bookingId = "00000000-0000-4000-8000-000000000501";
    assert.equal(
      buildBookingsDetailDeepLinkHref(bookingId),
      `/bookings?bookingId=${encodeURIComponent(bookingId)}`
    );
    assert.equal(
      readBookingIdFromCommandCenterParams(new URLSearchParams(`bookingId=${bookingId}`)),
      bookingId
    );
  });

  it("WEB-9.5-03 leader/review alias renders shared shell", () => {
    assert.equal(isLeaderReviewAlias("leader"), true);
    assert.equal(isLeaderReviewAlias(""), false);
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.leaderAlias, "operator-leader-review-alias");

    const state = resolveBookingsPageBodyState({
      canManageOps: true,
      view: "ops",
      loading: false,
      error: null,
      itemsLength: 2,
    });
    assert.equal(state.type, "ready");
  });
});
