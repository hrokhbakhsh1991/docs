/**
 * Phase 9.5 — Registration Command Center UI
 * Authority: docs/phase-9/appendices/BOOKINGS-OPS-UX.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { resolveBookingsPageBodyState } from "../src/features/bookings/bookings-command-center-gate";
import {
  bookingsAdvancedFiltersDirty,
  bookingsCommandCenterHasActiveFilters,
  buildBookingsApiQuery,
  buildBookingsCommandCenterHref,
  buildBookingLifecycleActionNotice,
  buildBookingsHistoryHref,
  buildBookingsDetailDeepLinkHref,
  buildRejectBookingRequestBody,
  capacitySnapshotFillPercent,
  clearBookingsCommandCenterFilters,
  filterBulkApprovableIds,
  findSelectedBooking,
  formatBookingDateTime,
  formatBookingDeparture,
  formatCapacitySnapshotLabel,
  isBookingCancellable,
  isBookingWaitlistable,
  isLeaderReviewAlias,
  isTourChipActive,
  listBulkApprovableIds,
  mergeBookingsListPages,
  parseBookingsCommandCenterQuery,
  parseBulkApproveBookingsResponse,
  readBookingIdFromCommandCenterParams,
  resolveBookingsKpiQueryPatch,
  resolveBookingsKpiStatusFilter,
  resolveInboxSelectionAfterKey,
  serializeBookingsCommandCenterQuery,
  sortBookingListItems,
  applyDepartureWindow,
  applyBookingsDepartureWindowChip,
  BOOKINGS_DEPARTURE_WINDOW_DAYS,
  BOOKINGS_INLINE_APPROVE_ARM_MS,
  BOOKINGS_INLINE_APPROVE_ENABLED,
  BOOKINGS_QUEUE_FRESHNESS_COOLDOWN_MS,
  canInlineApproveBooking,
  shouldShowInlineApprove,
  resolveInlineApproveClick,
  shouldRunBookingsQueueSoftRefresh,
  resolveBookingRowTransportLabel,
  truncateBookingRowTransportLabel,
  toggleBookingsUpcomingFacet,
  toggleBookingsTourChipScopeAll,
  buildBookingsSummaryApiQuery,
  toggleTourChipFilter,
  truncateBookingId,
  matchesBookingsMobileInspectionViewport,
  isBookingDepartureOverdue,
  isBookingsDepartureWindowChipActive,
  isBookingsUpcomingFacetActive,
  resolveBookingDepartureUrgency,
  resolveBookingPendingAgeDays,
  resolveBookingRowUrgencySlot,
  BOOKINGS_UPCOMING_FACET_DAYS,
  BOOKINGS_URGENCY_WINDOW_MS,
} from "../src/features/bookings/bookings-command-center-logic";
import {
  ensureActiveTourChipPresent,
  partitionBookingTourChips,
  resolveActiveTourChipFallbackTitle,
  truncateTourChipTitle,
} from "../src/features/bookings/bookings-tour-chip-bar-logic";
import {
  applyBookingsCommandCenterLayout,
  applyBookingsOpsPreset,
  groupBookingsByDepartureDay,
  groupBookingsByTour,
  resolveActiveBookingsOpsPreset,
} from "../src/features/bookings/bookings-ops-path-logic";
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
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.nextStepReceiptHint,
      "operator-bookings-next-step-receipt"
    );
    assert.equal(isAdminOrOwnerRole("owner"), true);
    assert.equal(isAdminOrOwnerRole("member"), false);

    const serialized = serializeBookingsCommandCenterQuery({
      ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
      search: "ali",
    });
    const parsed = parseBookingsCommandCenterQuery(new URLSearchParams(serialized));
    assert.equal(parsed.status, "actionable");
    assert.equal(parsed.search, "ali");
    assert.equal(serialized.includes("status="), false);

    const apiQuery = buildBookingsApiQuery(parsed);
    assert.match(apiQuery, /view=ops/);
    assert.match(apiQuery, /status=pending%2Cwaitlisted/);
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
    assert.deepEqual(
      filterBulkApprovableIds(
        [
          { ...items[0]!, id: "p1" },
          { ...items[0]!, id: "p2" },
          { ...items[0]!, id: "p3" },
        ],
        ["p1", "p2", "p3"],
        2
      ),
      ["p1", "p2"]
    );
    assert.deepEqual(filterBulkApprovableIds(items, ["b1"], 0), []);

    const paymentQuery = parseBookingsCommandCenterQuery(
      new URLSearchParams("paymentStatus=unpaid")
    );
    assert.equal(paymentQuery.paymentStatus, "unpaid");
    assert.equal(paymentQuery.status, "actionable");
    assert.match(buildBookingsApiQuery(paymentQuery), /paymentStatus=unpaid/);

    const bookingId = "00000000-0000-4000-8000-000000000501";
    assert.equal(
      buildBookingsDetailDeepLinkHref(bookingId),
      `/bookings?status=all&bookingId=${encodeURIComponent(bookingId)}`
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

  it("WEB-9.5-06 keyset load-more helpers + bookingId href (UX-BKG P0)", () => {
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.loadMoreButton, "operator-bookings-load-more");
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionError, "operator-bookings-action-error");
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.mobileActionBar,
      "operator-bookings-mobile-actions"
    );

    const withCursor = buildBookingsApiQuery(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY, {
      cursor: "cursor-2",
      limit: 50,
    });
    assert.match(withCursor, /cursor=cursor-2/);
    assert.match(withCursor, /limit=50/);
    assert.match(withCursor, /status=pending%2Cwaitlisted/);

    const page1 = {
      items: [
        {
          id: "b1",
          tourId: "t1",
          tourTitle: "North",
          guestLabel: "Ali",
          partySize: 1,
          status: "pending" as const,
          paymentStatus: "unpaid" as const,
          departureAt: "2026-07-01",
          submittedAt: "2026-06-01",
        },
      ],
      total: 2,
      nextCursor: "c2",
    };
    const page2 = {
      items: [
        {
          id: "b2",
          tourId: "t1",
          tourTitle: "North",
          guestLabel: "Sara",
          partySize: 2,
          status: "pending" as const,
          paymentStatus: "unpaid" as const,
          departureAt: "2026-07-02",
          submittedAt: "2026-06-02",
        },
        {
          id: "b1",
          tourId: "t1",
          tourTitle: "North",
          guestLabel: "Ali",
          partySize: 1,
          status: "pending" as const,
          paymentStatus: "unpaid" as const,
          departureAt: "2026-07-01",
          submittedAt: "2026-06-01",
        },
      ],
      total: 2,
      nextCursor: null,
    };
    const merged = mergeBookingsListPages(page1, page2, "append");
    assert.equal(merged.items.length, 2);
    assert.equal(merged.items[1]?.id, "b2");
    assert.equal(merged.nextCursor, null);
    assert.equal(merged.total, 2);

    const href = buildBookingsCommandCenterHref(
      "/bookings",
      DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
      "booking-9"
    );
    assert.equal(href.includes("status="), false);
    assert.match(href, /bookingId=booking-9/);

    const selected = findSelectedBooking(page1.items, "missing");
    assert.equal(selected?.id, "b1");
  });

  it("WEB-9.5-07 P1 ops queue defaults, KPI map, clear, bulk, lifecycle (UX-BKG)", () => {
    assert.equal(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.status, "actionable");
    assert.equal(parseBookingsCommandCenterQuery(new URLSearchParams()).status, "actionable");
    assert.equal(
      parseBookingsCommandCenterQuery(new URLSearchParams("status=pending")).status,
      "pending"
    );
    assert.equal(
      parseBookingsCommandCenterQuery(new URLSearchParams("status=pending,waitlisted")).status,
      "actionable"
    );
    assert.equal(parseBookingsCommandCenterQuery(new URLSearchParams("status=all")).status, "all");
    assert.match(
      serializeBookingsCommandCenterQuery({
        ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
        status: "all",
      }),
      /status=all/
    );

    assert.equal(resolveBookingsKpiStatusFilter("pending"), "pending");
    assert.equal(resolveBookingsKpiStatusFilter("waitlist"), "waitlisted");
    assert.equal(resolveBookingsKpiStatusFilter("approvedToday"), "approved");
    assert.deepEqual(resolveBookingsKpiQueryPatch("pending"), {
      status: "pending",
      departureWithinDays: "",
      approvedWithinDays: "",
    });
    assert.deepEqual(resolveBookingsKpiQueryPatch("approvedToday"), {
      status: "approved",
      departureWithinDays: "",
      approvedWithinDays: "1",
    });
    assert.match(
      buildBookingsApiQuery({
        ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
        status: "approved",
        approvedWithinDays: "1",
      }),
      /approvedWithinDays=1/
    );
    assert.match(
      serializeBookingsCommandCenterQuery({
        ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
        status: "approved",
        approvedWithinDays: "1",
      }),
      /approvedWithinDays=1/
    );

    assert.equal(
      bookingsCommandCenterHasActiveFilters(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY),
      false
    );
    assert.equal(
      bookingsCommandCenterHasActiveFilters({
        ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
        status: "all",
      }),
      true
    );
    assert.equal(
      bookingsCommandCenterHasActiveFilters({
        ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
        status: "pending",
      }),
      true
    );
    const cleared = clearBookingsCommandCenterFilters({
      ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
      status: "approved",
      tourId: "t1",
      search: "x",
      scope: "leader",
    });
    assert.equal(cleared.status, "actionable");
    assert.equal(cleared.tourId, "");
    assert.equal(cleared.search, "");
    assert.equal(cleared.scope, "leader");

    const items = [
      {
        id: "b1",
        tourId: "t1",
        tourTitle: "North",
        guestLabel: "Ali",
        partySize: 1,
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
    assert.deepEqual(listBulkApprovableIds(items), ["b1"]);
    assert.deepEqual(listBulkApprovableIds(items, 0), []);
    assert.deepEqual(
      listBulkApprovableIds(
        [
          { ...items[0]!, id: "x1" },
          { ...items[0]!, id: "x2" },
        ],
        1
      ),
      ["x1"]
    );
    assert.equal(isBookingWaitlistable(items[0]!), true);
    assert.equal(isBookingWaitlistable(items[1]!), false);
    assert.equal(isBookingCancellable(items[1]!), true);

    const bulk = parseBulkApproveBookingsResponse({
      approvedIds: ["a"],
      skippedIds: ["b", "c"],
    });
    assert.deepEqual(bulk.approvedIds, ["a"]);
    assert.deepEqual(bulk.skippedIds, ["b", "c"]);

    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.clearFiltersButton,
      "operator-bookings-clear-filters"
    );
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.waitlistButton, "operator-bookings-waitlist");
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelButton, "operator-bookings-cancel");
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.inlineApproveButton,
      "operator-bookings-inline-approve"
    );
    assert.equal(BOOKINGS_INLINE_APPROVE_ENABLED, true);
    assert.equal(canInlineApproveBooking({ status: "pending" }), true);
    assert.equal(canInlineApproveBooking({ status: "waitlisted" }), true);
    assert.equal(canInlineApproveBooking({ status: "approved" }), false);
    assert.equal(
      shouldShowInlineApprove({
        featureEnabled: true,
        canManageOps: true,
        item: { status: "pending" },
        selected: false,
        narrowViewport: false,
      }),
      true
    );
    assert.equal(
      shouldShowInlineApprove({
        featureEnabled: true,
        canManageOps: true,
        item: { status: "pending" },
        selected: false,
        narrowViewport: true,
      }),
      false
    );
    assert.equal(
      shouldShowInlineApprove({
        featureEnabled: true,
        canManageOps: true,
        item: { status: "pending" },
        selected: true,
        narrowViewport: true,
      }),
      true
    );
    assert.equal(
      shouldShowInlineApprove({
        featureEnabled: false,
        canManageOps: true,
        item: { status: "pending" },
        selected: true,
        narrowViewport: false,
      }),
      false
    );
    // UX-BKG-52 — first click arms; second confirms; different row re-arms.
    assert.equal(BOOKINGS_INLINE_APPROVE_ARM_MS, 3_000);
    assert.deepEqual(resolveInlineApproveClick({ armedBookingId: null, clickedBookingId: "b1" }), {
      kind: "arm",
      armedBookingId: "b1",
    });
    assert.deepEqual(resolveInlineApproveClick({ armedBookingId: "b1", clickedBookingId: "b1" }), {
      kind: "confirm",
      bookingId: "b1",
    });
    assert.deepEqual(resolveInlineApproveClick({ armedBookingId: "b1", clickedBookingId: "b2" }), {
      kind: "arm",
      armedBookingId: "b2",
    });
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelConfirmDialog,
      "operator-bookings-cancel-confirm"
    );
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.overbookConfirmDialog,
      "operator-bookings-overbook-confirm"
    );

    const approveEmbedded = buildBookingLifecycleActionNotice({
      action: "approve",
      guestLabel: "Jane Doe",
      paymentStatus: "unpaid",
      embedded: true,
      lockedTourId: "tour-1",
    });
    assert.equal(approveEmbedded.kind, "lifecycle");
    if (approveEmbedded.kind === "lifecycle") {
      assert.equal(approveEmbedded.action, "approve");
      assert.equal(approveEmbedded.embeddedTourId, "tour-1");
      assert.equal(approveEmbedded.showFinanceLink, true);
    }

    const approvePaid = buildBookingLifecycleActionNotice({
      action: "approve",
      guestLabel: "Jane Doe",
      paymentStatus: "paid",
      embedded: true,
      lockedTourId: "tour-1",
    });
    if (approvePaid.kind === "lifecycle") {
      assert.equal(approvePaid.showFinanceLink, false);
    }

    const rejectNotice = buildBookingLifecycleActionNotice({
      action: "reject",
      guestLabel: "Bob",
      embedded: true,
      lockedTourId: "tour-1",
    });
    if (rejectNotice.kind === "lifecycle") {
      assert.equal(rejectNotice.historyStatus, "rejected");
    }

    assert.equal(
      buildBookingsHistoryHref({ tourId: "tour-1", status: "rejected" }),
      "/bookings?tourId=tour-1&status=rejected&view=ops"
    );

    assert.equal(
      buildBookingLifecycleActionNotice({ action: "approve", guestLabel: "  " }).kind,
      "none"
    );

    const enSafety = JSON.parse(
      readFileSync(new URL("../messages/en/bookings.json", import.meta.url), "utf8")
    ) as {
      cancelDialogTitle: string;
      inlineApproveConfirm: string;
    };
    assert.match(enSafety.cancelDialogTitle, /Cancel/i);
    assert.equal(enSafety.inlineApproveConfirm, "Confirm? (2nd click)");

    assert.equal(BOOKINGS_QUEUE_FRESHNESS_COOLDOWN_MS, 45_000);
    assert.equal(
      shouldRunBookingsQueueSoftRefresh({
        visibilityState: "hidden",
        nowMs: 100_000,
        lastFetchSucceededAtMs: 0,
        actionBusy: false,
        loadingMore: false,
        dialogOpen: false,
      }),
      false
    );
    assert.equal(
      shouldRunBookingsQueueSoftRefresh({
        visibilityState: "visible",
        nowMs: 100_000,
        lastFetchSucceededAtMs: 90_000,
        cooldownMs: 45_000,
        actionBusy: false,
        loadingMore: false,
        dialogOpen: false,
      }),
      false
    );
    assert.equal(
      shouldRunBookingsQueueSoftRefresh({
        visibilityState: "visible",
        nowMs: 100_000,
        lastFetchSucceededAtMs: 50_000,
        cooldownMs: 45_000,
        actionBusy: false,
        loadingMore: false,
        dialogOpen: false,
      }),
      true
    );
    assert.equal(
      shouldRunBookingsQueueSoftRefresh({
        visibilityState: "visible",
        nowMs: 100_000,
        lastFetchSucceededAtMs: 0,
        actionBusy: true,
        loadingMore: false,
        dialogOpen: false,
      }),
      false
    );
    assert.equal(
      shouldRunBookingsQueueSoftRefresh({
        visibilityState: "visible",
        nowMs: 100_000,
        lastFetchSucceededAtMs: null,
        actionBusy: false,
        loadingMore: false,
        dialogOpen: true,
      }),
      false
    );

    const transportLabels = {
      primary: "Primary",
      personalCar: "Personal car",
      noCarDong: "Dong",
      noCarAcquaintance: "Acquaintance",
      occupants: (count: 1 | 2 | 3) => `${count} seats`,
    };
    // Deprecated row helpers retained for unit coverage; list no longer ships intake (UX-BKG-50 amend).
    assert.equal(resolveBookingRowTransportLabel(undefined, transportLabels), null);
    assert.equal(resolveBookingRowTransportLabel({ tourCapacityMax: 12 }, transportLabels), null);
    assert.equal(
      resolveBookingRowTransportLabel({ transport: { kind: "primary" } }, transportLabels),
      "Primary"
    );
    assert.equal(
      resolveBookingRowTransportLabel(
        { transport: { kind: "personal_car", personalCarOccupants: 2 } },
        transportLabels
      ),
      "Personal car · 2 seats"
    );
    assert.equal(truncateBookingRowTransportLabel("Short"), "Short");
    assert.equal(truncateBookingRowTransportLabel("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 10), "ABCDEFGHI…");
  });

  it("WEB-9.5-08 P2 display sort, departureWithinDays, datetime helpers", () => {
    assert.equal(resolveBookingsKpiQueryPatch("departures7d").departureWithinDays, "7");
    assert.equal(resolveBookingsKpiQueryPatch("departures7d").status, "all");

    const withDays = parseBookingsCommandCenterQuery(
      new URLSearchParams("status=all&departureWithinDays=7&sort=departureAt")
    );
    assert.equal(withDays.departureWithinDays, "7");
    assert.equal(withDays.sort, "departureAt");
    assert.match(buildBookingsApiQuery(withDays), /departureWithinDays=7/);
    assert.match(serializeBookingsCommandCenterQuery(withDays), /sort=departureAt/);

    const items = [
      {
        id: "b2",
        tourId: "t1",
        tourTitle: "North",
        guestLabel: "Sara",
        partySize: 1,
        status: "pending" as const,
        paymentStatus: "unpaid" as const,
        departureAt: "2026-08-10",
        submittedAt: "2026-06-02",
      },
      {
        id: "b1",
        tourId: "t1",
        tourTitle: "North",
        guestLabel: "Ali",
        partySize: 1,
        status: "pending" as const,
        paymentStatus: "unpaid" as const,
        departureAt: "2026-08-01",
        submittedAt: "2026-06-03",
      },
    ];
    assert.equal(sortBookingListItems(items, "departureAt")[0]?.id, "b1");
    assert.equal(sortBookingListItems(items, "submittedAt")[0]?.id, "b1");
    assert.equal(truncateBookingId("00000000-0000-4000-8000-000000000501"), "00000000…00000501");
    assert.match(formatBookingDateTime("2026-06-01T12:30:00.000Z", "en"), /2026/);
    assert.equal(findSelectedBooking(items, null), null);
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.copyBookingIdButton, "operator-bookings-copy-id");
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.mobileInspectionSheet,
      "operator-bookings-mobile-sheet"
    );
  });

  it("WEB-9.5-08b booking date labels do not depend on host timezone", () => {
    const previousTz = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const utcDeparture = formatBookingDeparture("2026-06-01T20:45:00.000Z", "en");
      const utcSubmitted = formatBookingDateTime("2026-06-01T20:45:00.000Z", "en");

      process.env.TZ = "America/Los_Angeles";
      assert.equal(formatBookingDeparture("2026-06-01T20:45:00.000Z", "en"), utcDeparture);
      assert.equal(formatBookingDateTime("2026-06-01T20:45:00.000Z", "en"), utcSubmitted);
    } finally {
      if (previousTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTz;
      }
    }
  });

  it("WEB-9.5-09 P3a capacity, reject body, empty vs filtered, keyboard", () => {
    assert.equal(formatCapacitySnapshotLabel(undefined, "en"), null);
    assert.equal(formatCapacitySnapshotLabel({ occupied: 7, max: 12 }, "en"), "7/12");
    assert.equal(formatCapacitySnapshotLabel({ occupied: 3, max: null }, "en"), "3");
    assert.equal(capacitySnapshotFillPercent({ occupied: 7, max: 12 }), 58);
    assert.equal(capacitySnapshotFillPercent({ occupied: 3, max: null }), null);

    assert.equal(buildRejectBookingRequestBody(""), "{}");
    assert.equal(buildRejectBookingRequestBody("  "), "{}");
    assert.equal(buildRejectBookingRequestBody(" full "), JSON.stringify({ reason: "full" }));

    assert.equal(
      resolveBookingsPageBodyState({
        canManageOps: true,
        view: "ops",
        loading: false,
        error: null,
        itemsLength: 0,
        hasActiveFilters: false,
      }).type,
      "empty"
    );
    assert.equal(
      resolveBookingsPageBodyState({
        canManageOps: true,
        view: "ops",
        loading: false,
        error: null,
        itemsLength: 0,
        hasActiveFilters: true,
      }).type,
      "emptyFiltered"
    );

    const items = [
      {
        id: "b1",
        tourId: "t1",
        tourTitle: "North",
        guestLabel: "Ali",
        partySize: 1,
        status: "pending" as const,
        paymentStatus: "unpaid" as const,
        departureAt: "2026-08-01",
        submittedAt: "2026-06-01",
      },
      {
        id: "b2",
        tourId: "t1",
        tourTitle: "North",
        guestLabel: "Sara",
        partySize: 1,
        status: "pending" as const,
        paymentStatus: "unpaid" as const,
        departureAt: "2026-08-02",
        submittedAt: "2026-06-02",
      },
    ];
    assert.equal(resolveInboxSelectionAfterKey(items, null, "ArrowDown"), "b1");
    assert.equal(resolveInboxSelectionAfterKey(items, "b1", "ArrowDown"), "b2");
    assert.equal(resolveInboxSelectionAfterKey(items, "b2", "ArrowDown"), "b2");
    assert.equal(resolveInboxSelectionAfterKey(items, "b2", "ArrowUp"), "b1");

    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectDialog, "operator-bookings-reject-dialog");
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.bulkConfirmDialog,
      "operator-bookings-bulk-confirm"
    );
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.capacityBar, "operator-bookings-capacity");
    assert.equal(
      matchesBookingsMobileInspectionViewport((q) => q.includes("1023")),
      true
    );
    assert.equal(
      matchesBookingsMobileInspectionViewport(() => false),
      false
    );
  });

  it("WEB-9.5-10 tour chip bar partition, truncate, ensure-active (P4a)", () => {
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.tourChipsMore,
      "operator-bookings-tour-chips-more"
    );
    assert.equal(truncateTourChipTitle("Short"), "Short");
    assert.equal(truncateTourChipTitle("ABCDEFGHIJKLMNOPQRSTUVWXYZ12", 10), "ABCDEFGHI…");
    assert.equal(truncateTourChipTitle("ExactTen!!", 10), "ExactTen!!");

    const chips = Array.from({ length: 9 }, (_, index) => ({
      tourId: `t${index}`,
      tourTitle: `Tour ${index}`,
      pendingCount: 9 - index,
      totalCount: 10,
    }));

    const defaultPartition = partitionBookingTourChips(chips, {
      activeTourId: "",
      maxVisible: 7,
    });
    assert.equal(defaultPartition.visible.length, 7);
    assert.equal(defaultPartition.overflow.length, 2);
    assert.equal(defaultPartition.visible[0]?.tourId, "t0");
    assert.equal(defaultPartition.overflow[0]?.tourId, "t7");

    const pinned = partitionBookingTourChips(chips, {
      activeTourId: "t8",
      maxVisible: 7,
    });
    assert.ok(pinned.visible.some((chip) => chip.tourId === "t8"));
    assert.ok(!pinned.overflow.some((chip) => chip.tourId === "t8"));
    assert.equal(pinned.visible.length, 7);
    assert.equal(pinned.overflow.length, 2);

    const withActive = ensureActiveTourChipPresent(chips.slice(0, 2), {
      tourId: "legacy",
      tourTitle: "Legacy Tour",
    });
    assert.equal(withActive[0]?.tourId, "legacy");
    assert.equal(withActive.length, 3);
    assert.equal(
      resolveActiveTourChipFallbackTitle([{ tourId: "legacy", tourTitle: "From List" }], "legacy"),
      "From List"
    );
  });

  it("WEB-9.5-11 overdue badge, upcoming facet preserves status, emptyUpcoming (P4b)", () => {
    assert.equal(BOOKINGS_UPCOMING_FACET_DAYS, "7");
    assert.deepEqual([...BOOKINGS_DEPARTURE_WINDOW_DAYS], [7, 14, 30]);
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.upcomingFacet,
      "operator-bookings-upcoming-facet"
    );
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.upcomingFacetDay(14),
      "operator-bookings-upcoming-14d"
    );
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.overdueBadge, "operator-bookings-overdue");
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.soonBadge, "operator-bookings-soon");
    assert.equal(BOOKINGS_URGENCY_WINDOW_MS, 48 * 60 * 60 * 1000);

    const now = new Date("2026-08-07T12:00:00.000Z");
    assert.equal(
      isBookingDepartureOverdue(
        { status: "pending", departureAt: "2026-08-01T00:00:00.000Z" },
        now
      ),
      true
    );
    assert.equal(
      isBookingDepartureOverdue(
        { status: "approved", departureAt: "2026-08-10T00:00:00.000Z" },
        now
      ),
      false
    );
    assert.equal(
      isBookingDepartureOverdue(
        { status: "rejected", departureAt: "2026-08-01T00:00:00.000Z" },
        now
      ),
      false
    );
    assert.equal(
      isBookingDepartureOverdue(
        { status: "cancelled", departureAt: "2026-08-01T00:00:00.000Z" },
        now
      ),
      false
    );

    // UX-BKG-47 — urgency slot: overdue ≻ soon ≻ aging; no sort coupling
    assert.equal(
      resolveBookingDepartureUrgency(
        { status: "pending", departureAt: "2026-08-08T00:00:00.000Z" },
        now
      ),
      "soon"
    );
    assert.equal(
      resolveBookingDepartureUrgency(
        { status: "pending", departureAt: "2026-08-10T00:00:00.000Z" },
        now
      ),
      "none"
    );
    assert.equal(
      resolveBookingPendingAgeDays(
        { status: "pending", submittedAt: "2026-08-04T12:00:00.000Z" },
        now
      ),
      3
    );
    assert.equal(
      resolveBookingPendingAgeDays(
        { status: "pending", submittedAt: "2026-08-07T00:00:00.000Z" },
        now
      ),
      null
    );
    assert.equal(
      resolveBookingPendingAgeDays(
        { status: "approved", submittedAt: "2026-07-01T00:00:00.000Z" },
        now
      ),
      null
    );
    assert.equal(
      resolveBookingRowUrgencySlot(
        {
          status: "pending",
          departureAt: "2026-08-01T00:00:00.000Z",
          submittedAt: "2026-07-01T00:00:00.000Z",
        },
        now
      ),
      "overdue"
    );
    assert.equal(
      resolveBookingRowUrgencySlot(
        {
          status: "waitlisted",
          departureAt: "2026-08-08T12:00:00.000Z",
          submittedAt: "2026-07-01T00:00:00.000Z",
        },
        now
      ),
      "soon"
    );
    assert.equal(
      resolveBookingRowUrgencySlot(
        {
          status: "pending",
          departureAt: "2026-09-01T00:00:00.000Z",
          submittedAt: "2026-08-01T00:00:00.000Z",
        },
        now
      ),
      "aging"
    );

    const pendingBase = {
      ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
      status: "pending" as const,
      layout: "board" as const,
      approvedWithinDays: "1",
    };
    const withUpcoming = toggleBookingsUpcomingFacet(pendingBase);
    assert.equal(withUpcoming.departureWithinDays, "7");
    assert.equal(withUpcoming.status, "pending");
    assert.equal(withUpcoming.layout, "board");
    assert.equal(withUpcoming.approvedWithinDays, "");
    assert.equal(isBookingsUpcomingFacetActive(withUpcoming), true);
    assert.equal(isBookingsDepartureWindowChipActive(withUpcoming, 7), true);
    assert.equal(isBookingsDepartureWindowChipActive(withUpcoming, 14), false);
    const cleared = toggleBookingsUpcomingFacet(withUpcoming);
    assert.equal(cleared.departureWithinDays, "");
    assert.equal(cleared.status, "pending");
    assert.equal(cleared.layout, "board");

    const with14 = applyBookingsDepartureWindowChip(pendingBase, 14);
    assert.equal(with14.departureWithinDays, "14");
    assert.equal(with14.status, "pending");
    assert.equal(isBookingsDepartureWindowChipActive(with14, 14), true);
    assert.equal(isBookingsDepartureWindowChipActive(with14, 7), false);
    assert.match(buildBookingsApiQuery(with14), /departureWithinDays=14/);
    const with30 = applyBookingsDepartureWindowChip(with14, 30);
    assert.equal(with30.departureWithinDays, "30");
    assert.equal(applyBookingsDepartureWindowChip(with30, 30).departureWithinDays, "");

    const parsed14 = parseBookingsCommandCenterQuery(new URLSearchParams("departureWithinDays=14"));
    assert.equal(parsed14.departureWithinDays, "14");
    assert.match(serializeBookingsCommandCenterQuery(parsed14), /departureWithinDays=14/);

    const portfolio = applyDepartureWindow(pendingBase, {
      days: 7,
      membership: "portfolio",
    });
    assert.equal(portfolio.status, "all");
    assert.equal(portfolio.departureWithinDays, "7");
    assert.equal(portfolio.layout, "board");

    const kpiPatch = resolveBookingsKpiQueryPatch("departures7d");
    assert.equal(kpiPatch.status, "all");
    assert.equal(kpiPatch.departureWithinDays, "7");

    assert.equal(
      resolveBookingsPageBodyState({
        canManageOps: true,
        view: "ops",
        loading: false,
        error: null,
        itemsLength: 0,
        hasActiveFilters: true,
        upcomingFacetActive: true,
      }).type,
      "emptyUpcoming"
    );
    assert.equal(
      resolveBookingsPageBodyState({
        canManageOps: true,
        view: "ops",
        loading: false,
        error: null,
        itemsLength: 0,
        hasActiveFilters: true,
        upcomingFacetActive: false,
      }).type,
      "emptyFiltered"
    );
  });

  it("WEB-9.5-12 tourChipScope all escape + summary query (P4c)", () => {
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.tourChipScopeAll,
      "operator-bookings-tour-chip-scope-all"
    );
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.historyHint, "operator-bookings-history-hint");

    const withAll = toggleBookingsTourChipScopeAll(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY);
    assert.equal(withAll.tourChipScope, "all");
    assert.equal(buildBookingsSummaryApiQuery(withAll), "tourChipScope=all");
    assert.match(serializeBookingsCommandCenterQuery(withAll), /tourChipScope=all/);
    assert.equal(
      parseBookingsCommandCenterQuery(new URLSearchParams("tourChipScope=all")).tourChipScope,
      "all"
    );
    assert.equal(buildBookingsSummaryApiQuery(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY), "");
    assert.equal(toggleBookingsTourChipScopeAll(withAll).tourChipScope, "");
    assert.equal(bookingsCommandCenterHasActiveFilters(withAll), true);
  });

  it("WEB-9.5-13 server sort query includes departureAt (P3b-a)", () => {
    const withDepartureSort = {
      ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
      sort: "departureAt" as const,
    };
    assert.match(buildBookingsApiQuery(withDepartureSort), /sort=departureAt/);
    assert.equal(
      buildBookingsApiQuery(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY).includes("sort="),
      false
    );
    const sorted = sortBookingListItems(
      [
        {
          id: "b2",
          tourId: "t",
          tourTitle: "T",
          guestLabel: "B",
          partySize: 1,
          status: "pending",
          paymentStatus: "unpaid",
          departureAt: "2026-08-10",
          submittedAt: "2026-08-01",
        },
        {
          id: "b1",
          tourId: "t",
          tourTitle: "T",
          guestLabel: "A",
          partySize: 1,
          status: "pending",
          paymentStatus: "unpaid",
          departureAt: "2026-08-02",
          submittedAt: "2026-08-02",
        },
      ],
      "departureAt"
    );
    assert.deepEqual(
      sorted.map((item) => item.id),
      ["b1", "b2"]
    );
  });

  it("WEB-9.5-14 ops presets, layout, grouping (P4d path complete)", () => {
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.opsPresets, "operator-bookings-ops-presets");
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.layoutSwitch, "operator-bookings-layout");

    const work = applyBookingsOpsPreset(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY, "workQueue");
    assert.equal(work.status, "actionable");
    assert.equal(work.departureWithinDays, "");
    assert.equal(resolveActiveBookingsOpsPreset(work), "workQueue");

    const upcoming = applyBookingsOpsPreset(work, "upcoming");
    assert.equal(upcoming.status, "actionable");
    assert.equal(upcoming.departureWithinDays, "7");
    assert.equal(upcoming.sort, "departureAt");
    assert.equal(upcoming.layout, "inbox");
    assert.equal(resolveActiveBookingsOpsPreset(upcoming), "upcoming");

    const boardThenUpcoming = applyBookingsOpsPreset({ ...work, layout: "board" }, "upcoming");
    assert.equal(boardThenUpcoming.layout, "board");
    assert.equal(boardThenUpcoming.status, "actionable");

    const facetActiveAsPreset = resolveActiveBookingsOpsPreset({
      ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
      status: "pending",
      departureWithinDays: "7",
      sort: "submittedAt",
    });
    assert.equal(facetActiveAsPreset, "upcoming");

    const history = applyBookingsOpsPreset(upcoming, "history");
    assert.equal(history.status, "all");
    assert.equal(history.layout, "inbox");
    assert.equal(resolveActiveBookingsOpsPreset(history), "history");

    const timeline = applyBookingsCommandCenterLayout(work, "timeline");
    assert.equal(timeline.layout, "timeline");
    assert.equal(timeline.sort, "departureAt");
    assert.match(serializeBookingsCommandCenterQuery(timeline), /layout=timeline/);

    const byTourLayout = applyBookingsCommandCenterLayout(
      { ...work, sort: "submittedAt" },
      "board"
    );
    assert.equal(byTourLayout.layout, "board");
    assert.equal(byTourLayout.sort, "submittedAt");
    assert.match(serializeBookingsCommandCenterQuery(byTourLayout), /layout=board/);

    // UX-BKG-44 / UX-BKG-53 — operator labels (wire token `board` stays; Inbox → List).
    const enLayout = JSON.parse(
      readFileSync(new URL("../messages/en/bookings.json", import.meta.url), "utf8")
    ).layout as { inbox: string; timeline: string; board: string };
    assert.equal(enLayout.inbox, "List");
    assert.equal(enLayout.timeline, "By departure");
    assert.equal(enLayout.board, "By tour");
    assert.equal(
      (enLayout as { timelineHint?: string }).timelineHint,
      "Groups rows by day — does not change the departure window"
    );
    const faLayout = JSON.parse(
      readFileSync(new URL("../messages/fa/bookings.json", import.meta.url), "utf8")
    ).layout as { inbox: string; timeline: string; board: string };
    assert.equal(faLayout.inbox, "فهرست");
    assert.equal(faLayout.timeline, "بر اساس حرکت");
    assert.equal(faLayout.board, "بر اساس تور");

    // UX-BKG-51 / UX-BKG-54 — departure window + first-time operator copy.
    const enBookings = JSON.parse(
      readFileSync(new URL("../messages/en/bookings.json", import.meta.url), "utf8")
    ) as {
      pageSubtitle: string;
      upcomingWindow: string;
      departureWindowActive: string;
      presetsLabel: string;
      presetsHint: string;
      presets: {
        upcoming: string;
        workQueueAria: string;
        historyAria: string;
      };
      kpi: {
        departures7d: string;
        departures7dAria: string;
        waitlist: string;
        pendingAria: string;
        waitlistAria: string;
      };
      status: { waitlisted: string };
      emptyInbox: string;
      emptyFiltered: string;
      emptyUpcoming: string;
      historyHint: string;
      inbox: string;
      inspection: string;
      selectRegistration: string;
      inspectionActionsHint: string;
      displayLabel: string;
      layoutLabel: string;
      advancedFiltersHeading: string;
      filtersToggle: string;
      waitlistActionAria: string;
    };
    assert.equal(enBookings.upcomingWindow, "Departure window");
    assert.equal(enBookings.kpi.departures7d, "Leaving in 7d");
    assert.match(enBookings.kpi.departures7dAria, /Shortcut/i);
    assert.equal(enBookings.presets.upcoming, "Leaving soon (7d)");
    assert.equal(enBookings.presetsLabel, "Queues");
    assert.match(enBookings.departureWindowActive, /\{days\}/);
    assert.equal(enBookings.displayLabel, "Display");
    assert.equal(enBookings.layoutLabel, "Display");
    assert.equal(enBookings.advancedFiltersHeading, "Advanced filters");
    assert.equal(enBookings.filtersToggle, "Filters");
    assert.match(enBookings.pageSubtitle, /pending and waitlisted/i);
    assert.match(enBookings.presetsHint, /pending \+ waitlist/i);
    assert.match(enBookings.presets.workQueueAria, /need a decision/i);
    assert.match(enBookings.presets.historyAria, /past and closed/i);
    assert.equal(enBookings.kpi.waitlist, "Waitlisted");
    assert.equal(enBookings.status.waitlisted, "Waitlisted");
    assert.match(enBookings.kpi.pendingAria, /not yet decided/i);
    assert.match(enBookings.kpi.waitlistAria, /held for a seat/i);
    assert.match(enBookings.emptyInbox, /caught up/i);
    assert.match(enBookings.emptyFiltered, /Clear filters/i);
    assert.match(enBookings.emptyUpcoming, /Widen to 14d/i);
    assert.match(enBookings.historyHint, /^History shows/i);
    assert.match(enBookings.inbox, /^Queue \(/);
    assert.equal(enBookings.inspection, "Decide");
    assert.match(enBookings.selectRegistration, /Approve, Waitlist, or Reject/i);
    assert.match(enBookings.inspectionActionsHint, /Waitlisted: Approve or Reject/i);
    assert.match(enBookings.waitlistActionAria, /hold for a seat/i);

    const faBookings = JSON.parse(
      readFileSync(new URL("../messages/fa/bookings.json", import.meta.url), "utf8")
    ) as {
      presetsHint: string;
      presets: { upcoming: string };
      inspection: string;
      emptyInbox: string;
    };
    assert.equal(faBookings.presets.upcoming, "به‌زودی (۷ر)");
    assert.equal(faBookings.inspection, "تصمیم");
    assert.match(faBookings.presetsHint, /صف کار/);
    assert.match(faBookings.emptyInbox, /کار تمام/);

    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.presetsHint, "operator-bookings-presets-hint");
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.inspectionActionsHint,
      "operator-bookings-inspection-actions-hint"
    );

    // UX-BKG-53 — chrome hierarchy test ids + advanced dirty helper.
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.primaryChrome,
      "operator-bookings-primary-chrome"
    );
    assert.equal(BOOKINGS_COMMAND_CENTER_TEST_IDS.displayMenu, "operator-bookings-display-menu");
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.advancedFiltersPanel,
      "operator-bookings-advanced-filters"
    );
    assert.equal(
      BOOKINGS_COMMAND_CENTER_TEST_IDS.filtersDirtyBadge,
      "operator-bookings-filters-dirty"
    );
    assert.equal(bookingsAdvancedFiltersDirty(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY), false);
    assert.equal(
      bookingsAdvancedFiltersDirty(
        applyBookingsOpsPreset(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY, "upcoming")
      ),
      false,
      "Focus preset must not dirty Filters badge"
    );
    assert.equal(
      bookingsAdvancedFiltersDirty({
        ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
        paymentStatus: "unpaid",
      }),
      true
    );
    assert.equal(
      bookingsAdvancedFiltersDirty({
        ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
        tourChipScope: "all",
      }),
      true
    );
    assert.equal(
      bookingsAdvancedFiltersDirty({
        ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
        status: "pending",
      }),
      true
    );
    assert.equal(
      bookingsAdvancedFiltersDirty(
        applyBookingsOpsPreset(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY, "history")
      ),
      false,
      "History (status=all) is Queues, not advanced dirty"
    );

    const pageSource = readFileSync(
      new URL("../src/features/bookings/bookings-command-center-shell.tsx", import.meta.url),
      "utf8"
    );
    assert.match(pageSource, /BookingsDisplayMenu/);
    assert.match(pageSource, /advancedFiltersOpen/);
    assert.match(pageSource, /showStatusFilter=\{lockedStatusFilter\.length === 0\}/);
    assert.match(pageSource, /showTourScope=\{!embedded && canManageOps\}/);
    assert.match(pageSource, /presetsHint/);
    assert.match(pageSource, /inspectionActionsHint/);
    assert.match(pageSource, /kpi\.pendingAria/);
    assert.match(pageSource, /kpi\.waitlistAria/);
    assert.match(pageSource, /data-queue-list="dense"/);
    assert.match(pageSource, /bulkSelectedIds\.length > 0 && bulkApprovableIds\.length > 0/);
    // Layout / show-all-tours demoted out of page primary imports (UX-BKG-53).
    assert.doesNotMatch(pageSource, /import \{ BookingsLayoutSwitch/);
    assert.doesNotMatch(pageSource, /import \{ BookingsTourChipScopeToggle/);
    assert.match(
      readFileSync(
        new URL("../src/features/bookings/bookings-filter-controls.tsx", import.meta.url),
        "utf8"
      ),
      /BookingsTourChipScopeToggle/
    );
    assert.match(
      readFileSync(
        new URL("../src/features/bookings/booking-action-buttons.tsx", import.meta.url),
        "utf8"
      ),
      /waitlistActionAria/
    );
    const rowSource = readFileSync(
      new URL("../src/features/bookings/booking-inbox-row.tsx", import.meta.url),
      "utf8"
    );
    assert.match(rowSource, /data-queue-row="dense"/);
    assert.match(rowSource, /border-b/);
    assert.doesNotMatch(rowSource, /rounded-lg border/);
    assert.doesNotMatch(rowSource, /BookingCapacityBar/);
    assert.match(rowSource, /intake\.registrantSelf/);

    const detailSource = readFileSync(
      new URL("../src/features/bookings/booking-inspection-details.tsx", import.meta.url),
      "utf8"
    );
    assert.ok(
      detailSource.indexOf("BookingActionButtons") < detailSource.indexOf("BookingFinancialStrip")
    );

    const timelineKeepsWindow = applyBookingsCommandCenterLayout(
      { ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY, departureWithinDays: "14" },
      "timeline"
    );
    assert.equal(timelineKeepsWindow.layout, "timeline");
    assert.equal(timelineKeepsWindow.departureWithinDays, "14");
    const chipPreservesStatus = applyBookingsDepartureWindowChip(
      { ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY, status: "actionable" },
      14
    );
    assert.equal(chipPreservesStatus.departureWithinDays, "14");
    assert.equal(chipPreservesStatus.status, "actionable");
    const kpiPortfolio = applyDepartureWindow(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY, {
      days: 7,
      membership: "portfolio",
    });
    assert.equal(kpiPortfolio.status, "all");
    assert.equal(kpiPortfolio.departureWithinDays, "7");

    const items = [
      {
        id: "1",
        tourId: "t-b",
        tourTitle: "Beta",
        guestLabel: "A",
        partySize: 1,
        status: "pending" as const,
        paymentStatus: "unpaid" as const,
        departureAt: "2026-08-10T12:00:00.000Z",
        submittedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "2",
        tourId: "t-a",
        tourTitle: "Alpha",
        guestLabel: "B",
        partySize: 1,
        status: "pending" as const,
        paymentStatus: "unpaid" as const,
        departureAt: "2026-08-09T12:00:00.000Z",
        submittedAt: "2026-08-02T00:00:00.000Z",
      },
      {
        id: "3",
        tourId: "t-a",
        tourTitle: "Alpha",
        guestLabel: "C",
        partySize: 1,
        status: "pending" as const,
        paymentStatus: "unpaid" as const,
        departureAt: "2026-08-09T18:00:00.000Z",
        submittedAt: "2026-08-03T00:00:00.000Z",
      },
    ];
    const byDay = groupBookingsByDepartureDay(items, "en");
    assert.equal(byDay.length, 2);
    assert.equal(byDay[0]?.items.length, 2);
    const byTour = groupBookingsByTour(items);
    assert.equal(byTour[0]?.tourTitle, "Alpha");
    assert.equal(byTour[0]?.items.length, 2);
  });
});
