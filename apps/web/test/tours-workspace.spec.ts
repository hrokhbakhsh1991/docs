/**
 * Phase 9.3 — tour workspace shell (R3)
 * Authority: docs/phase-9/appendices/TOURS-WORKSPACE-UX.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TOUR_EDIT_TEST_IDS } from "../src/features/tours/operator-tour-detail-types";
import { TOURS_LIST_TEST_IDS } from "../src/features/tours/query-model";
import {
  buildWorkspaceTabReplacePath,
  hrefForWorkspaceTab,
  listTourWorkspaceSubnavTabs,
  parseWorkspaceFocusRegistrationId,
  parseWorkspaceTabParam,
  resolveWorkspaceSubnavTab,
  workspaceBasePath,
  WORKSPACE_FOCUS_REGISTRATION_QUERY_KEY,
  WORKSPACE_TAB_QUERY_KEY,
} from "../src/features/tours/tour-workspace-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../src/features/tours/tour-workspace-types";
import {
  buildTourWaitlistBookingsQuery,
  buildTourWaitlistCommandCenterHref,
  isTourCapacityFull,
  sortWaitlistRows,
  TOUR_WORKSPACE_WAITLIST_TEST_IDS,
} from "../src/features/tours/tour-workspace-waitlist-logic";
import {
  buildTourTransportBookingsQuery,
  buildTourTransportCommandCenterHref,
  countTransportRosterByIntakeKind,
  extractTransportModesFromTourPayload,
  formatTransportModeLabel,
  sortTransportRosterRows,
  TOUR_WORKSPACE_TRANSPORT_TEST_IDS,
} from "../src/features/tours/tour-workspace-transport-logic";
import {
  buildTourWorkspaceBookingsHref,
  buildTourWorkspaceFinanceHref,
  buildTourWorkspaceHistoryHref,
  buildTourWorkspaceOpsCountsQuery,
  hrefForWorkspaceMoneyKpi,
  hrefForWorkspaceOpsKpi,
  resolveTourWorkspaceOpsCountsFromListPayloads,
} from "../src/features/tours/tour-workspace-header-logic";
import {
  buildTourFinanceHubHref,
  buildTourFinanceMoneyInbox,
  filterTourFinanceGuestRows,
  filterTourOutstandingRows,
  findTourFinanceGuestRow,
  formatCountMaybeMore,
  pickTourCollectionRollup,
  readPendingReceiptsKpi,
  resolveSelectedWorkspacePaymentAction,
  resolveSelectedWorkspaceReviewResult,
  shouldShowTourFinanceGuestTools,
  sumOutstandingRemainingMinor,
  TOUR_WORKSPACE_FINANCE_TEST_IDS,
} from "../src/features/tours/tour-workspace-finance-logic";
import { withFinanceTourQuery } from "../src/finance/finance-registration-context";
import {
  DEFAULT_BOOKINGS_OPS_ACTION_CHROME,
  resolveBookingsOpsActionChrome,
} from "../src/features/bookings/bookings-ops-action-chrome";
import {
  buildTourRegistrationsBookingsQuery,
  buildTourRegistrationsCommandCenterHref,
  sortRegistrationRows,
  TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS,
} from "../src/features/tours/tour-workspace-registrations-logic";

const TOUR_ID = "00000000-0000-4000-8000-000000000099";

describe("tours-workspace.spec.ts — Phase 9.3 Web", () => {
  it("WEB-9.3-W01 workspace exposes page landmarks (CP-9.3-W01)", () => {
    assert.equal(TOUR_WORKSPACE_TEST_IDS.page, "operator-tour-workspace-page");
    assert.equal(TOUR_WORKSPACE_TEST_IDS.subnav, "operator-tour-workspace-subnav");
    assert.equal(
      TOUR_WORKSPACE_TEST_IDS.registrationsPanel,
      "operator-tour-workspace-registrations-panel"
    );
  });

  it("WEB-9.3-W02 subnav resolver highlights active tab (CP-9.3-W02)", () => {
    const base = workspaceBasePath(TOUR_ID);
    assert.equal(resolveWorkspaceSubnavTab(base, TOUR_ID), "registrations");
    assert.equal(resolveWorkspaceSubnavTab(base, TOUR_ID, "waitlist"), "waitlist");
    assert.equal(resolveWorkspaceSubnavTab(base, TOUR_ID, "transport"), "transport");
    assert.equal(resolveWorkspaceSubnavTab(base, TOUR_ID, "finance"), "finance");
    assert.equal(parseWorkspaceTabParam(null), "registrations");
    assert.equal(WORKSPACE_TAB_QUERY_KEY, "tab");
    assert.equal(resolveWorkspaceSubnavTab(`${base}/waitlist`, TOUR_ID), "waitlist");
    assert.equal(resolveWorkspaceSubnavTab(`${base}/transport`, TOUR_ID), "transport");
    assert.equal(resolveWorkspaceSubnavTab(`${base}/finance`, TOUR_ID), "finance");
    assert.equal(hrefForWorkspaceTab(TOUR_ID, "waitlist"), `${base}?tab=waitlist`);
    assert.equal(hrefForWorkspaceTab(TOUR_ID, "finance"), `${base}?tab=finance`);
    assert.equal(hrefForWorkspaceTab(TOUR_ID, "registrations"), base);
    assert.equal(buildWorkspaceTabReplacePath(base, "waitlist"), `${base}?tab=waitlist`);
    assert.equal(buildWorkspaceTabReplacePath(base, "registrations"), base);
    assert.equal(
      buildWorkspaceTabReplacePath(base, "transport", "tab=finance&foo=1"),
      `${base}?tab=transport&foo=1`
    );
    assert.equal(
      buildWorkspaceTabReplacePath(base, "registrations", new URLSearchParams("tab=waitlist")),
      base
    );
  });

  it("WEB-9.3-W03 list and edit link ids for workspace (CP-9.3-W03)", () => {
    assert.equal(TOURS_LIST_TEST_IDS.workspace, "operator-tours-workspace");
    assert.equal(TOUR_EDIT_TEST_IDS.workspace, "operator-tour-edit-workspace");
    assert.equal(workspaceBasePath(TOUR_ID), `/tours/${TOUR_ID}/workspace`);
  });

  it("WEB-9.3-W04 waitlist query scopes bookings API to tour + waitlisted (CP-9.3-W05)", () => {
    const query = buildTourWaitlistBookingsQuery(TOUR_ID);
    const params = new URLSearchParams(query);
    assert.equal(params.get("status"), "waitlisted");
    assert.equal(params.get("tourId"), TOUR_ID);
    assert.equal(params.get("view"), "ops");
    assert.equal(buildTourWaitlistCommandCenterHref(TOUR_ID), `/bookings?${query}`);
    assert.equal(TOUR_WORKSPACE_WAITLIST_TEST_IDS.table, "operator-tour-workspace-waitlist-table");
    assert.equal(TOUR_WORKSPACE_WAITLIST_TEST_IDS.empty, "operator-tour-workspace-waitlist-empty");
  });

  it("WEB-9.3-W05 waitlist rows sort by submittedAt ascending", () => {
    const sorted = sortWaitlistRows([
      {
        id: "b-2",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "Later",
        partySize: 1,
        status: "waitlisted",
        paymentStatus: "unpaid",
        transportKind: null,
        personalCarOccupants: null,
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-02T00:00:00.000Z",
      },
      {
        id: "b-1",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "First",
        partySize: 2,
        status: "waitlisted",
        paymentStatus: "unpaid",
        transportKind: null,
        personalCarOccupants: null,
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    assert.equal(sorted[0]?.id, "b-1");
    assert.equal(sorted[1]?.id, "b-2");
  });

  it("WEB-9.3-W06 transport query scopes approved bookings + canonical modes (CP-9.3-W06)", () => {
    const query = buildTourTransportBookingsQuery(TOUR_ID);
    const params = new URLSearchParams(query);
    assert.equal(params.get("status"), "approved");
    assert.equal(params.get("tourId"), TOUR_ID);
    assert.equal(params.get("view"), "ops");
    assert.equal(buildTourTransportCommandCenterHref(TOUR_ID), `/bookings?${query}`);
    assert.equal(
      TOUR_WORKSPACE_TRANSPORT_TEST_IDS.table,
      "operator-tour-workspace-transport-table"
    );
    assert.equal(
      TOUR_WORKSPACE_TRANSPORT_TEST_IDS.empty,
      "operator-tour-workspace-transport-empty"
    );

    const modes = extractTransportModesFromTourPayload({
      canonical: {
        data: {
          details: {
            tripDetails: {
              transportModes: ["van", "private_car"],
            },
          },
        },
      },
    });
    assert.deepEqual(modes, ["private_car", "van"]);
    assert.equal(formatTransportModeLabel("shuttle_bus"), "Shuttle Bus");
  });

  it("WEB-9.3-W07 transport roster sorts by guest then departure", () => {
    const sorted = sortTransportRosterRows([
      {
        id: "b-2",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "Zara",
        partySize: 1,
        status: "approved",
        paymentStatus: "unpaid",
        transportKind: null,
        personalCarOccupants: null,
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-02T00:00:00.000Z",
      },
      {
        id: "b-1",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "Ali",
        partySize: 2,
        status: "approved",
        paymentStatus: "paid",
        transportKind: null,
        personalCarOccupants: null,
        departureAt: "2026-07-02T00:00:00.000Z",
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    assert.equal(sorted[0]?.id, "b-1");
    assert.equal(sorted[1]?.id, "b-2");
  });

  it("WEB-9.3-R04 registrations query scopes bookings to tour (CP-9.3-R04 / TW-C-01)", () => {
    const query = buildTourRegistrationsBookingsQuery(TOUR_ID);
    const params = new URLSearchParams(query);
    assert.equal(params.get("status"), null);
    assert.equal(params.get("tourId"), TOUR_ID);
    assert.equal(params.get("view"), "ops");
    assert.equal(buildTourRegistrationsCommandCenterHref(TOUR_ID), `/bookings?${query}`);
    assert.equal(
      TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS.registerLink,
      "operator-tour-workspace-registrations-register"
    );
    const sorted = sortRegistrationRows([
      {
        id: "b-2",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "Later",
        partySize: 1,
        status: "pending",
        paymentStatus: "unpaid",
        transportKind: null,
        personalCarOccupants: null,
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-02T00:00:00.000Z",
      },
      {
        id: "b-1",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "First",
        partySize: 2,
        status: "pending",
        paymentStatus: "unpaid",
        transportKind: null,
        personalCarOccupants: null,
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    assert.equal(sorted[0]?.id, "b-1");
    assert.equal(sorted[1]?.id, "b-2");
  });

  it("TW-C complete — finance tab in subnav when enabled + deep links", () => {
    const withFinance = listTourWorkspaceSubnavTabs({ includeFinance: true });
    assert.equal(
      withFinance.some((row) => row.tab === "finance"),
      true
    );
    assert.equal(
      listTourWorkspaceSubnavTabs().some((row) => row.tab === "finance"),
      false
    );
    assert.equal(buildTourWorkspaceBookingsHref(TOUR_ID), `/bookings?tourId=${TOUR_ID}&view=ops`);
    assert.equal(buildTourWorkspaceFinanceHref(TOUR_ID), `/finance?tourId=${TOUR_ID}`);
    // TW-C-05 — financeNav resolved on RSC layout, not via client plugin load (ALLOW_* invisible in browser).
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const root = join(__dirname, "..");
    const layout = readFileSync(join(root, "app/(app)/tours/[id]/workspace/layout.tsx"), "utf8");
    const client = readFileSync(
      join(root, "app/(app)/tours/[id]/workspace/tour-workspace-layout-client.tsx"),
      "utf8"
    );
    assert.match(layout, /ensureFinanceNavSupported/);
    assert.match(layout, /includeFinance=\{includeFinance\}/);
    assert.match(client, /readonly includeFinance: boolean/);
    assert.doesNotMatch(client, /finance-nav-enablement/);
    assert.doesNotMatch(client, /void ensureFinanceNavSupported/);
    assert.equal(
      pickTourCollectionRollup(
        [
          {
            tourId: TOUR_ID,
            tourTitle: "Trek",
            registrationsCount: 2,
            invoiceTotalMinor: "1000",
            collectedMinor: "400",
            remainingMinor: "600",
            currency: "IRR",
          },
        ],
        TOUR_ID
      )?.remainingMinor,
      "600"
    );
    assert.equal(
      filterTourOutstandingRows(
        [
          {
            registrationId: "r1",
            identity: { memberDisplayName: "A", tourTitle: "Trek", tourId: TOUR_ID },
            invoice: {
              totalMinor: "100",
              paidMinor: "0",
              remainingMinor: "100",
              currency: "IRR",
            },
            bookingPaymentStatus: "unpaid",
            occurredAt: "2026-08-01T00:00:00.000Z",
          },
          {
            registrationId: "r2",
            identity: { memberDisplayName: "B", tourTitle: "Other", tourId: "other" },
            invoice: {
              totalMinor: "100",
              paidMinor: "0",
              remainingMinor: "100",
              currency: "IRR",
            },
            bookingPaymentStatus: "unpaid",
            occurredAt: "2026-08-01T00:00:00.000Z",
          },
        ],
        TOUR_ID
      ).length,
      1
    );
  });

  it("H1 hardening — ops counts from list totals; fail closed; clickable hrefs", () => {
    assert.match(buildTourWorkspaceOpsCountsQuery(TOUR_ID, "pending"), /status=pending/);
    const ok = resolveTourWorkspaceOpsCountsFromListPayloads({
      pendingPayload: { total: 2 },
      waitlistedPayload: { total: 1 },
      approvedPayload: { total: 4 },
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.deepEqual(ok.counts, { pending: 2, waitlisted: 1, approved: 4 });
    }
    const bad = resolveTourWorkspaceOpsCountsFromListPayloads({
      pendingPayload: {},
      waitlistedPayload: { total: 1 },
      approvedPayload: { total: 4 },
    });
    assert.equal(bad.ok, false);
    assert.equal(hrefForWorkspaceOpsKpi(TOUR_ID, "pending"), workspaceBasePath(TOUR_ID));
    assert.equal(
      hrefForWorkspaceOpsKpi(TOUR_ID, "waitlisted"),
      `${workspaceBasePath(TOUR_ID)}?tab=waitlist`
    );
    assert.equal(
      hrefForWorkspaceOpsKpi(TOUR_ID, "approved"),
      `${workspaceBasePath(TOUR_ID)}?tab=transport`
    );
    assert.equal(hrefForWorkspaceMoneyKpi(TOUR_ID), `${workspaceBasePath(TOUR_ID)}?tab=finance`);
    assert.equal(
      buildTourWorkspaceHistoryHref(TOUR_ID, "rejected"),
      `/bookings?tourId=${encodeURIComponent(TOUR_ID)}&status=rejected&view=ops`
    );
  });

  it("H2/H3 hardening — capacity full + receipts N+", () => {
    assert.equal(isTourCapacityFull({ acceptedCount: 10, totalCapacity: 10 }), true);
    assert.equal(isTourCapacityFull({ acceptedCount: 9, totalCapacity: 10 }), false);
    assert.equal(isTourCapacityFull({ acceptedCount: 3, totalCapacity: null }), false);
    assert.equal(formatCountMaybeMore(50, true), "50+");
    assert.equal(formatCountMaybeMore(3, false), "3");
    assert.equal(readPendingReceiptsKpi({ itemCount: 50, hasMore: true }).label, "50+");
  });

  it("H-10 Money Inbox — partition by actionability + remaining sum", () => {
    const outstanding = [
      {
        registrationId: "r-unpaid",
        identity: { memberDisplayName: "Unpaid Guest", tourTitle: null, tourId: TOUR_ID },
        invoice: {
          remainingMinor: "1000",
          currency: "EUR",
          totalMinor: "1000",
          paidMinor: "0",
        },
        bookingPaymentStatus: "unpaid" as const,
        occurredAt: "2026-08-12T00:00:00.000Z",
      },
      {
        registrationId: "r-partial",
        identity: { memberDisplayName: "Partial Guest", tourTitle: null, tourId: TOUR_ID },
        invoice: {
          remainingMinor: "350",
          currency: "EUR",
          totalMinor: "1000",
          paidMinor: "650",
        },
        bookingPaymentStatus: "partial" as const,
        occurredAt: "2026-08-12T00:00:00.000Z",
      },
    ];
    const withReceipts = buildTourFinanceMoneyInbox({
      outstanding,
      pendingReceipts: [
        {
          id: "rcpt-1",
          paymentId: "pay-1",
          fileKey: "k",
          status: "pending",
          note: null,
          createdAt: "2026-08-12T00:00:00.000Z",
          payment: {
            id: "pay-1",
            registrationId: "r-receipt",
            amount: "1200",
            currency: "EUR",
            method: "transfer",
            status: "pending",
          },
          registrationContext: {
            registrationId: "r-receipt",
            tourId: TOUR_ID,
            tourTitle: "Trek",
            memberDisplayName: "Receipt Guest",
          },
        },
      ],
    });
    assert.equal(withReceipts.leadSection, "awaiting_payment");
    assert.equal(withReceipts.awaitingGuestCount, 1);
    assert.equal(withReceipts.partialOutstanding[0]?.registrationId, "r-partial");
    assert.equal(withReceipts.awaitingPayment[0]?.registrationId, "r-unpaid");
    assert.equal(sumOutstandingRemainingMinor(withReceipts.awaitingPayment), "1000");
    assert.equal(withReceipts.guestRows[0]?.registrationId, "r-receipt");
    assert.equal(
      withReceipts.guestRows.some((row) => row.kind === "partial"),
      true
    );
    assert.equal(
      withReceipts.guestRows.some((row) => row.kind === "unpaid"),
      true
    );

    const onlyUnpaid = buildTourFinanceMoneyInbox({
      outstanding: outstanding.filter((row) => row.bookingPaymentStatus === "unpaid"),
      pendingReceipts: [],
    });
    assert.equal(onlyUnpaid.leadSection, "awaiting_payment");

    const settled = buildTourFinanceMoneyInbox({ outstanding: [], pendingReceipts: [] });
    assert.equal(settled.leadSection, "settled");
    assert.equal(TOUR_WORKSPACE_FINANCE_TEST_IDS.awaitingPayment.length > 0, true);

    const receiptOnly = buildTourFinanceMoneyInbox({
      outstanding: [],
      pendingReceipts: [
        {
          id: "rcpt-only",
          paymentId: "pay-only",
          fileKey: "receipt-only.jpg",
          status: "pending",
          note: null,
          createdAt: "2026-08-12T00:00:00.000Z",
          payment: {
            id: "pay-only",
            registrationId: "r-only",
            amount: "900",
            currency: "EUR",
            method: "Manual",
            status: "Pending",
          },
          registrationContext: {
            registrationId: "r-only",
            tourId: TOUR_ID,
            tourTitle: "Trek",
            memberDisplayName: "Receipt Only",
          },
        },
      ],
    });
    assert.equal(receiptOnly.leadSection, "awaiting_payment");
    assert.equal(receiptOnly.guestRows.length, 1);
    assert.equal(receiptOnly.guestRows[0]?.registrationId, "r-only");
  });

  it("PAY-FIN-02 Money Inbox — approved unpaid with no receipts still awaits payment", () => {
    const inbox = buildTourFinanceMoneyInbox({
      outstanding: [
        {
          registrationId: "r-approved-unpaid",
          identity: { memberDisplayName: "Mina", tourTitle: null, tourId: TOUR_ID },
          invoice: {
            remainingMinor: "2500000",
            currency: "IRR",
            totalMinor: "2500000",
            paidMinor: "0",
          },
          bookingPaymentStatus: "unpaid",
          occurredAt: "2026-08-12T00:00:00.000Z",
        },
      ],
      pendingReceipts: [],
    });
    assert.equal(inbox.leadSection, "awaiting_payment");
    assert.equal(inbox.awaitingGuestCount, 1);
    assert.equal(inbox.guestRows[0]?.registrationId, "r-approved-unpaid");
    assert.equal(inbox.guestRows[0]?.kind, "unpaid");
  });

  it("H-11 Tour Money Inbox — filters, hub href, focus parse", () => {
    const inbox = buildTourFinanceMoneyInbox({
      outstanding: [
        {
          registrationId: "r-unpaid",
          identity: { memberDisplayName: "Ali", tourTitle: null, tourId: TOUR_ID },
          invoice: {
            remainingMinor: "500",
            currency: "EUR",
            totalMinor: "500",
            paidMinor: "0",
          },
          bookingPaymentStatus: "unpaid",
          occurredAt: "2026-08-12T00:00:00.000Z",
        },
        {
          registrationId: "r-partial",
          identity: { memberDisplayName: "Sara", tourTitle: null, tourId: TOUR_ID },
          invoice: {
            remainingMinor: "200",
            currency: "EUR",
            totalMinor: "500",
            paidMinor: "300",
          },
          bookingPaymentStatus: "partial",
          occurredAt: "2026-08-12T00:00:00.000Z",
        },
      ],
      pendingReceipts: [],
    });
    assert.equal(filterTourFinanceGuestRows(inbox.guestRows, "unpaid", "").length, 1);
    assert.equal(filterTourFinanceGuestRows(inbox.guestRows, "partial", "").length, 1);
    assert.equal(filterTourFinanceGuestRows(inbox.guestRows, "all", "sar").length, 1);
    assert.equal(findTourFinanceGuestRow(inbox.guestRows, "r-unpaid")?.displayName, "Ali");
    assert.equal(
      buildTourFinanceHubHref(TOUR_ID, "receipts", "r-1"),
      `/finance?tourId=${TOUR_ID}&tab=receipts&registrationId=r-1`
    );
    assert.equal(parseWorkspaceFocusRegistrationId("  abc  "), "abc");
    assert.equal(parseWorkspaceFocusRegistrationId(""), null);
    assert.equal(parseWorkspaceFocusRegistrationId("x".repeat(129)), null);
    assert.equal(
      hrefForWorkspaceTab(TOUR_ID, "finance", { focusRegistrationId: "r-9" }),
      `${workspaceBasePath(TOUR_ID)}?tab=finance&${WORKSPACE_FOCUS_REGISTRATION_QUERY_KEY}=r-9`
    );
    assert.equal(
      buildWorkspaceTabReplacePath(
        workspaceBasePath(TOUR_ID),
        "transport",
        "tab=finance&focusRegistrationId=r-9"
      ),
      `${workspaceBasePath(TOUR_ID)}?tab=transport`
    );
    assert.equal(findTourFinanceGuestRow(inbox.guestRows, null), null);
    assert.equal(shouldShowTourFinanceGuestTools(inbox), true);
    assert.equal(
      shouldShowTourFinanceGuestTools(
        buildTourFinanceMoneyInbox({ outstanding: [], pendingReceipts: [] })
      ),
      false
    );
  });

  it("H-11b review feedback stays scoped to the selected workspace row", () => {
    const selectedRow = {
      key: "partial:r-1",
      kind: "partial" as const,
      registrationId: "r-1",
      displayName: "Guest One",
      amountMinor: "200",
      currency: "EUR",
    };
    const receiptRow = {
      key: "receipt:rcpt-1",
      kind: "receipt_pending" as const,
      registrationId: "r-2",
      displayName: "Guest Two",
      amountMinor: "300",
      currency: "EUR",
    };
    const result = {
      decision: "approve" as const,
      bookingPaymentStatus: "partial" as const,
      remainingMinor: "200",
      currency: "EUR",
      registrationId: "r-1",
      paymentId: "pay-1",
    };
    assert.deepEqual(
      resolveSelectedWorkspaceReviewResult({
        lastReviewResult: result,
        selectedRow,
        selectedReceiptId: null,
      }),
      result
    );
    assert.equal(
      resolveSelectedWorkspaceReviewResult({
        lastReviewResult: result,
        selectedRow: receiptRow,
        selectedReceiptId: "rcpt-1",
      }),
      null
    );
    const receiptResult = {
      decision: "reject" as const,
      remainingMinor: null,
      currency: "EUR",
    };
    assert.deepEqual(
      resolveSelectedWorkspaceReviewResult({
        lastReviewResult: receiptResult,
        selectedRow: receiptRow,
        selectedReceiptId: "rcpt-1",
      }),
      receiptResult
    );
  });

  it("H-11b2 payment action feedback stays scoped to the selected workspace row", () => {
    const selectedRow = {
      key: "partial:r-1",
      kind: "partial" as const,
      registrationId: "r-1",
      displayName: "Guest One",
      amountMinor: "200",
      currency: "EUR",
    };
    const receiptRow = {
      key: "receipt:rcpt-1",
      kind: "receipt_pending" as const,
      registrationId: "r-1",
      displayName: "Guest One",
      amountMinor: "300",
      currency: "EUR",
    };
    const recordedPaymentEvent = {
      kind: "prepayment_recorded" as const,
      registrationId: "r-1",
      amountMinor: "200",
      currency: "EUR",
    };
    assert.deepEqual(
      resolveSelectedWorkspacePaymentAction({
        lastPaymentAction: recordedPaymentEvent,
        selectedRow,
        selectedReceiptId: null,
      }),
      recordedPaymentEvent
    );
    const receiptEvent = {
      kind: "receipt_submitted" as const,
      registrationId: "r-1",
      paymentId: "pay-1",
      receiptId: "rcpt-1",
    };
    assert.deepEqual(
      resolveSelectedWorkspacePaymentAction({
        lastPaymentAction: receiptEvent,
        selectedRow: receiptRow,
        selectedReceiptId: "rcpt-1",
      }),
      receiptEvent
    );
    assert.equal(
      resolveSelectedWorkspacePaymentAction({
        lastPaymentAction: {
          kind: "prepayment_recorded",
          registrationId: "r-2",
          amountMinor: "200",
          currency: "EUR",
        },
        selectedRow,
        selectedReceiptId: null,
      }),
      null
    );
  });

  it("H-11c workspace finance uses validation-first error localization", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const client = readFileSync(
      join(process.cwd(), "src/features/tours/tour-workspace-finance-client.tsx"),
      "utf8"
    );
    assert.match(client, /localizeFinanceMessage\(tValidation,\s*tErrors,\s*error\)/);
    assert.match(client, /const refreshWorkspaceFinanceView = useCallback/);
    assert.match(client, /onClick=\{refreshWorkspaceFinanceView\}/);
  });

  it("H-11d workspace finance shows a scoped degraded-data hint when only some reads fail", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const client = readFileSync(
      join(process.cwd(), "src/features/tours/tour-workspace-finance-client.tsx"),
      "utf8"
    );
    const messages = readFileSync(join(process.cwd(), "messages/en/tours.json"), "utf8");
    assert.match(client, /TOUR_WORKSPACE_FINANCE_TEST_IDS\.degraded/);
    assert.match(client, /degradedSections\.length > 0/);
    assert.match(client, /degradedSectionLabel/);
    assert.match(messages, /"degradedTitle": "Some tour finance data is temporarily incomplete\./);
    assert.match(messages, /"degradedReceipts": "receipt queue"/);
  });

  it("H4b hardening — waitlist command center stays waitlisted+tour scoped", () => {
    const href = buildTourWaitlistCommandCenterHref(TOUR_ID);
    assert.match(href, /status=waitlisted/);
    assert.match(href, new RegExp(`tourId=${TOUR_ID}`));
  });

  it("H5 hardening — transport intake kind counts from list scalars", () => {
    const counts = countTransportRosterByIntakeKind([
      {
        id: "b-1",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "A",
        partySize: 1,
        status: "approved",
        paymentStatus: "paid",
        transportKind: "personal_car",
        personalCarOccupants: 2,
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "b-2",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "B",
        partySize: 1,
        status: "approved",
        paymentStatus: "unpaid",
        transportKind: null,
        personalCarOccupants: null,
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "b-3",
        tourId: TOUR_ID,
        tourTitle: "Trek",
        guestLabel: "C",
        partySize: 1,
        status: "approved",
        paymentStatus: "paid",
        transportKind: "personal_car",
        personalCarOccupants: 1,
        departureAt: "2026-07-01T00:00:00.000Z",
        submittedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    assert.deepEqual(counts, [
      { kind: "personal_car", count: 2 },
      { kind: "unknown", count: 1 },
    ]);
  });

  it("H5-T4 — transport client uses list scalars (no N+1 hydrate)", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const client = readFileSync(
      join(
        process.cwd(),
        "app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx"
      ),
      "utf8"
    );
    assert.doesNotMatch(client, /hydrateTransportRosterIntake/);
    assert.match(client, /H5-T3/);
    const logic = readFileSync(
      join(process.cwd(), "src/features/tours/tour-workspace-transport-logic.ts"),
      "utf8"
    );
    assert.doesNotMatch(logic, /hydrateTransportRosterIntake/);
    const adapter = readFileSync(
      join(process.cwd(), "src/features/tours/tour-canonical-transport-modes.ts"),
      "utf8"
    );
    assert.match(adapter, /I-06/);
    assert.match(adapter, /details.*tripDetails/);
  });

  it("TW-C remediations — finance tourId query + opsActions defaults + register test id", () => {
    assert.match(
      withFinanceTourQuery("/api/finance/reports/outstanding-balances?limit=50", TOUR_ID),
      new RegExp(`tourId=${TOUR_ID}`)
    );
    assert.match(
      withFinanceTourQuery("/api/finance/reports/tour-collections?limit=50", TOUR_ID),
      new RegExp(`tourId=${TOUR_ID}`)
    );
    assert.deepEqual(resolveBookingsOpsActionChrome(null), DEFAULT_BOOKINGS_OPS_ACTION_CHROME);
    assert.equal(
      TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS.registerLink,
      "operator-tour-workspace-registrations-register"
    );
  });

  it("I-07/I-08 — workspace embeds import CC shell from features (not app/bookings)", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const root = process.cwd();
    const registrations = readFileSync(
      join(root, "app/(app)/tours/[id]/workspace/tour-workspace-registrations-client.tsx"),
      "utf8"
    );
    const waitlist = readFileSync(
      join(root, "app/(app)/tours/[id]/workspace/waitlist/tour-workspace-waitlist-client.tsx"),
      "utf8"
    );
    const entry = readFileSync(join(root, "app/(app)/bookings/bookings-page-client.tsx"), "utf8");
    assert.match(registrations, /@\/features\/bookings\/bookings-command-center-shell/);
    assert.match(waitlist, /@\/features\/bookings\/bookings-command-center-shell/);
    assert.doesNotMatch(registrations, /from ["']\.\.\/.*bookings\/bookings-page-client/);
    assert.doesNotMatch(waitlist, /from ["']\.\.\/.*bookings\/bookings-page-client/);
    assert.match(entry, /bookings-command-center-shell/);
  });

  it("shared finance fetch cache — TTL + invalidate for header/tab reuse", () => {
    const {
      clearTourWorkspaceFinanceCache,
      invalidateTourWorkspaceFinanceCache,
      readTourWorkspaceFinanceCache,
      writeTourWorkspaceFinanceCache,
      TOUR_WORKSPACE_FINANCE_CACHE_NS,
    } =
      require("../src/features/tours/tour-workspace-finance-fetch-cache") as typeof import("../src/features/tours/tour-workspace-finance-fetch-cache");
    clearTourWorkspaceFinanceCache();
    writeTourWorkspaceFinanceCache(TOUR_WORKSPACE_FINANCE_CACHE_NS.collections, TOUR_ID, {
      items: [{ tourId: TOUR_ID }],
      nextCursor: null,
      hasMore: false,
    });
    writeTourWorkspaceFinanceCache(TOUR_WORKSPACE_FINANCE_CACHE_NS.outstanding, TOUR_ID, {
      items: [{ registrationId: TOUR_ID }],
      nextCursor: null,
      hasMore: false,
    });
    assert.deepEqual(
      readTourWorkspaceFinanceCache(TOUR_WORKSPACE_FINANCE_CACHE_NS.collections, TOUR_ID),
      { items: [{ tourId: TOUR_ID }], nextCursor: null, hasMore: false }
    );
    assert.deepEqual(
      readTourWorkspaceFinanceCache(TOUR_WORKSPACE_FINANCE_CACHE_NS.outstanding, TOUR_ID),
      { items: [{ registrationId: TOUR_ID }], nextCursor: null, hasMore: false }
    );
    invalidateTourWorkspaceFinanceCache(TOUR_ID);
    assert.equal(
      readTourWorkspaceFinanceCache(TOUR_WORKSPACE_FINANCE_CACHE_NS.collections, TOUR_ID),
      null
    );
    assert.equal(
      readTourWorkspaceFinanceCache(TOUR_WORKSPACE_FINANCE_CACHE_NS.outstanding, TOUR_ID),
      null
    );
    const layout = require("node:fs").readFileSync(
      require("node:path").join(
        process.cwd(),
        "app/(app)/tours/[id]/workspace/tour-workspace-layout-client.tsx"
      ),
      "utf8"
    );
    const finance = require("node:fs").readFileSync(
      require("node:path").join(
        process.cwd(),
        "src/features/tours/tour-workspace-finance-client.tsx"
      ),
      "utf8"
    );
    const financeData = require("node:fs").readFileSync(
      require("node:path").join(
        process.cwd(),
        "src/features/tours/use-tour-workspace-finance-data.ts"
      ),
      "utf8"
    );
    assert.match(layout, /loadTourWorkspaceCollectionsPage/);
    assert.match(finance, /useTourWorkspaceFinanceData/);
    assert.match(finance, /resolveTextDirection/);
    assert.match(financeData, /loadTourWorkspacePendingReceiptsPage/);
    assert.match(financeData, /loadTourWorkspaceOutstandingBalancesPage/);
    clearTourWorkspaceFinanceCache();
  });

  it("finance workspace master-detail stays feature-owned with app re-export", () => {
    assert.equal(
      TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel,
      "operator-tour-workspace-finance-detail-panel"
    );
    assert.equal(
      TOUR_WORKSPACE_FINANCE_TEST_IDS.detailEmpty,
      "operator-tour-workspace-finance-detail-empty"
    );
    assert.equal(
      TOUR_WORKSPACE_FINANCE_TEST_IDS.paymentActionResult,
      "operator-tour-workspace-finance-payment-action-result"
    );

    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const root = process.cwd();

    const featureClient = readFileSync(
      join(root, "src/features/tours/tour-workspace-finance-client.tsx"),
      "utf8"
    );
    const receiptReview = readFileSync(
      join(root, "src/finance/finance-receipt-review-content.tsx"),
      "utf8"
    );
    const tabPanels = readFileSync(
      join(root, "app/(app)/tours/[id]/workspace/tour-workspace-tab-panels.tsx"),
      "utf8"
    );
    const appReexport = readFileSync(
      join(root, "app/(app)/tours/[id]/workspace/finance/tour-workspace-finance-client.tsx"),
      "utf8"
    );

    assert.match(featureClient, /detailPanel/);
    assert.match(featureClient, /WorkspaceMasterDetailLayout/);
    assert.match(featureClient, /WorkspaceStickyDetailCard/);
    assert.match(featureClient, /TourWorkspaceFinanceDetailHero/);
    assert.match(featureClient, /TourWorkspaceFinanceDetailHistory/);
    assert.match(featureClient, /TourWorkspacePaymentActionsSection/);
    assert.match(featureClient, /resolveTourWorkspaceDetailActionMode/);
    assert.match(featureClient, /handleReceiptReviewed/);
    assert.match(featureClient, /pendingReceiptsForSelected/);
    assert.match(featureClient, /workspaceExitNotice/);
    assert.match(featureClient, /aria-pressed=\{selected\}/);
    assert.match(featureClient, /kindAccentClass/);
    assert.match(featureClient, /guestListItemRemainingLabel/);
    assert.match(featureClient, /guestRowsHasMore/);
    assert.match(featureClient, /loadingMore/);
    assert.match(featureClient, /onClick=\{loadMore\}/);
    assert.match(featureClient, /detailExitNoticeNoPayment/);
    assert.match(featureClient, /detailExitNoticeBalanceUpdated/);
    assert.match(featureClient, /handleRegistrationPaymentChanged/);
    assert.match(featureClient, /setFinanceMutationRefreshKey\(\(current\) => current \+ 1\)/);
    assert.match(featureClient, /setPendingFocusId\(event\.registrationId\)/);
    assert.match(featureClient, /selectedRow\?\.registrationId === event\.registrationId/);
    assert.match(featureClient, /detailData\.refresh\(\)/);
    assert.match(featureClient, /resolveSelectedWorkspacePaymentAction/);
    assert.match(featureClient, /reloadWorkspaceChrome/);
    assert.doesNotMatch(featureClient, /router\.refresh\(\)/);
    const paymentActions = readFileSync(
      join(root, "src/finance/finance-registration-payment-actions.tsx"),
      "utf8"
    );
    assert.match(paymentActions, /receiptSubmittedTitle/);
    assert.match(paymentActions, /finance-registration-receipt-submit-result/);
    assert.match(receiptReview, /ReceiptProofPreview/);
    assert.match(receiptReview, /\/api\/finance\/receipts\/\$\{receipt\.id\}\/review/);
    assert.match(
      tabPanels,
      /<TourWorkspaceFinanceClient session=\{session\} tourId=\{tourId\} \/>/
    );
    assert.match(appReexport, /export \{ TourWorkspaceFinanceClient \}/);
    assert.match(appReexport, /@\/features\/tours\/tour-workspace-finance-client/);
    const masterDetailLayout = readFileSync(
      join(root, "src/features/workspace-resource-panel/workspace-master-detail-layout.tsx"),
      "utf8"
    );
    const overrideActions = readFileSync(
      join(root, "src/features/tours/tour-workspace-payment-override-actions.tsx"),
      "utf8"
    );
    const advancedReceiptCard = readFileSync(
      join(root, "src/features/tours/tour-workspace-advanced-receipt-card.tsx"),
      "utf8"
    );
    const actionsSection = readFileSync(
      join(root, "src/features/tours/tour-workspace-payment-actions-section.tsx"),
      "utf8"
    );
    const evidenceList = readFileSync(
      join(root, "src/features/tours/tour-workspace-payment-evidence-list.tsx"),
      "utf8"
    );
    assert.match(actionsSection, /BookingFinancialStrip/);
    assert.match(actionsSection, /TourWorkspaceAdminPaymentCard/);
    assert.match(actionsSection, /TourWorkspaceAdvancedReceiptCard/);
    assert.match(actionsSection, /TourWorkspacePaymentOverrideActions/);
    assert.match(actionsSection, /TourWorkspaceInlineReceiptReview/);
    assert.match(actionsSection, /detailPrimaryPaymentTitle/);
    assert.match(actionsSection, /detailSecondaryActionTitle/);
    assert.match(actionsSection, /detailAdvancedToggle/);
    assert.match(actionsSection, /detailActionStateReadOnlyTitle/);
    assert.match(actionsSection, /refreshKey=\{refreshKey\}/);
    assert.match(masterDetailLayout, /lg:h-\[calc\(100vh-8rem\)\]/);
    assert.match(masterDetailLayout, /lg:overflow-y-auto/);
    assert.ok(
      actionsSection.indexOf("<TourWorkspaceAdminPaymentCard") <
        actionsSection.lastIndexOf("<BookingFinancialStrip")
    );
    assert.ok(actionsSection.includes("detailAdvancedToggle"));
    assert.ok(actionsSection.includes("<TourWorkspaceAdvancedReceiptCard"));
    assert.match(overrideActions, /obligation-override/);
    assert.match(advancedReceiptCard, /workspaceReceiptAdvancedTitle/);
    assert.match(overrideActions, /detailOverrideScheduleDescription/);
    assert.match(overrideActions, /withFinanceRegistrationQuery\(\s*"\/finance\?tab=installments"/);
    assert.match(evidenceList, /ReceiptProofPreview/);
    assert.match(evidenceList, /detailEvidenceReceiptStatus_\$\{receiptStatus\}/);
  });
});
