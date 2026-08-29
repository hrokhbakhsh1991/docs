/**
 * Tour Workspace finance tab helpers — TW-C-02 + H-04/H-05 + H-10/H-11 Tour Money Inbox.
 * @see docs/phase-9/appendices/TOURS-WORKSPACE-COMPLETE.md §8
 */
import type {
  OutstandingBalanceListItem,
  TourCollectionListItem,
} from "@/finance/finance-outstanding-logic";
import { filterOutstandingByTourId } from "@/finance/finance-outstanding-logic";
import type { FinancePendingReceipt } from "@/finance/finance-receipts-logic";
import type { ReceiptReviewResultBanner } from "@/finance/finance-receipt-review-content";

export const TOUR_WORKSPACE_FINANCE_TEST_IDS = {
  panel: "operator-tour-workspace-finance-inbox",
  rollup: "operator-tour-workspace-finance-rollup",
  inboxSummary: "operator-tour-workspace-finance-inbox-summary",
  statusStrip: "operator-tour-workspace-finance-status-strip",
  filters: "operator-tour-workspace-finance-filters",
  controls: "operator-tour-workspace-finance-controls",
  filtersToggle: "operator-tour-workspace-finance-filters-toggle",
  filtersPanel: "operator-tour-workspace-finance-filters-panel",
  activeFilters: "operator-tour-workspace-finance-active-filters",
  search: "operator-tour-workspace-finance-search",
  guestList: "operator-tour-workspace-finance-guest-list",
  awaitingPayment: "operator-tour-workspace-finance-awaiting-payment",
  outstandingList: "operator-tour-workspace-finance-outstanding",
  receiptsList: "operator-tour-workspace-finance-receipts",
  empty: "operator-tour-workspace-finance-empty",
  emptyReceipts: "operator-tour-workspace-finance-empty-receipts",
  allSettled: "operator-tour-workspace-finance-all-settled",
  focusMiss: "operator-tour-workspace-finance-focus-miss",
  degraded: "operator-tour-workspace-finance-degraded",
  detailPanel: "operator-tour-workspace-finance-detail-panel",
  detailEmpty: "operator-tour-workspace-finance-detail-empty",
  detailRecommendation: "operator-tour-workspace-finance-detail-recommendation",
  paymentActionResult: "operator-tour-workspace-finance-payment-action-result",
  openHub: "operator-tour-workspace-finance-open-hub",
  openPayments: "operator-tour-workspace-finance-open-payments",
  openCase: "operator-tour-workspace-finance-open-case",
  followUpPayment: "operator-tour-workspace-finance-follow-up-payment",
  reviewPartial: "operator-tour-workspace-finance-review-partial",
  inlineReceiptReview: "operator-tour-workspace-finance-inline-receipt-review",
} as const;

export type TourFinancePaymentTone = "unpaid" | "partial" | "unknown";

export type TourFinanceListFilter = "all" | "unpaid" | "partial";

export type TourWorkspacePaymentActionEvent =
  | {
      readonly kind: "prepayment_recorded";
      readonly registrationId: string;
      readonly amountMinor: string;
      readonly currency: string;
    }
  | {
      readonly kind: "receipt_submitted";
      readonly registrationId: string;
      readonly paymentId: string;
      readonly receiptId: string | null;
    };

export type TourFinanceGuestKind = "unpaid" | "partial";

export type TourFinanceGuestRow = {
  readonly key: string;
  readonly kind: TourFinanceGuestKind;
  readonly registrationId: string | null;
  readonly displayName: string;
  readonly amountMinor: string | null;
  readonly currency: string | null;
};

export type TourFinanceMoneyInbox = {
  readonly partialOutstanding: readonly OutstandingBalanceListItem[];
  readonly awaitingPayment: readonly OutstandingBalanceListItem[];
  readonly guestRows: readonly TourFinanceGuestRow[];
  readonly awaitingGuestCount: number;
  readonly leadSection: "awaiting_payment" | "settled";
};

export function pickTourCollectionRollup(
  tours: readonly TourCollectionListItem[],
  tourId: string
): TourCollectionListItem | null {
  const id = tourId.trim();
  return tours.find((row) => row.tourId === id) ?? null;
}

export function filterTourOutstandingRows(
  items: readonly OutstandingBalanceListItem[],
  tourId: string
): readonly OutstandingBalanceListItem[] {
  return filterOutstandingByTourId(items, tourId);
}

export function sumOutstandingRemainingCount(items: readonly OutstandingBalanceListItem[]): number {
  return items.length;
}

/** Sum invoice.remainingMinor (integer minor units as decimal strings). */
export function sumOutstandingRemainingMinor(items: readonly OutstandingBalanceListItem[]): string {
  let total = 0n;
  for (const row of items) {
    const raw = row.invoice.remainingMinor.trim();
    if (!/^-?\d+$/.test(raw)) {
      continue;
    }
    total += BigInt(raw);
  }
  return total.toString();
}

export function resolveTourFinancePaymentTone(
  status: OutstandingBalanceListItem["bookingPaymentStatus"]
): TourFinancePaymentTone {
  if (status === "unpaid" || status === "partial") {
    return status;
  }
  return "unknown";
}

/** H-11 — tour-scoped finance hub escape (never primary when Case is wrong primary). */
export function buildTourFinanceHubHref(
  tourId: string,
  tab: "receipts" | "payments",
  registrationId?: string | null
): string {
  const params = new URLSearchParams();
  params.set("tourId", tourId.trim());
  params.set("tab", tab);
  const reg = registrationId?.trim() ?? "";
  if (reg.length > 0) {
    params.set("registrationId", reg);
  }
  return `/finance?${params.toString()}`;
}

function outstandingToGuestRow(
  row: OutstandingBalanceListItem,
  kind: "unpaid" | "partial"
): TourFinanceGuestRow {
  return {
    key: `${kind}:${row.registrationId}`,
    kind,
    registrationId: row.registrationId,
    displayName: row.identity.memberDisplayName ?? row.registrationId,
    amountMinor: row.invoice.remainingMinor,
    currency: row.invoice.currency,
  };
}

function pendingReceiptToGuestRow(row: FinancePendingReceipt): TourFinanceGuestRow | null {
  const registrationId = row.payment?.registrationId?.trim() ?? "";
  if (registrationId.length === 0) {
    return null;
  }
  return {
    key: `partial:${registrationId}`,
    kind: "partial",
    registrationId,
    displayName: row.registrationContext?.memberDisplayName ?? registrationId,
    amountMinor: row.payment?.amount ?? null,
    currency: row.payment?.currency ?? null,
  };
}

/** Hide filter/search/list chrome when settled and there are no guest rows to browse. */
export function shouldShowTourFinanceGuestTools(
  inbox: Pick<TourFinanceMoneyInbox, "leadSection" | "guestRows">
): boolean {
  return inbox.leadSection !== "settled" || inbox.guestRows.length > 0;
}

/** H-10/H-11 — build a payment follow-up list from this tour's outstanding balances. */
export function buildTourFinanceMoneyInbox(input: {
  readonly outstanding: readonly OutstandingBalanceListItem[];
  readonly pendingReceipts: readonly FinancePendingReceipt[];
}): TourFinanceMoneyInbox {
  const partialOutstanding = input.outstanding.filter(
    (row) => row.bookingPaymentStatus === "partial"
  );
  const awaitingPayment = input.outstanding.filter((row) => row.bookingPaymentStatus !== "partial");

  const guestRows: TourFinanceGuestRow[] = [
    ...partialOutstanding.map((row) => outstandingToGuestRow(row, "partial")),
    ...awaitingPayment.map((row) => outstandingToGuestRow(row, "unpaid")),
  ];
  const seenRegistrationIds = new Set(
    guestRows
      .map((row) => row.registrationId?.trim() ?? "")
      .filter((registrationId) => registrationId.length > 0)
  );
  for (const receipt of input.pendingReceipts) {
    const row = pendingReceiptToGuestRow(receipt);
    if (row === null) {
      continue;
    }
    const registrationId = row.registrationId?.trim() ?? "";
    if (registrationId.length === 0 || seenRegistrationIds.has(registrationId)) {
      continue;
    }
    guestRows.unshift(row);
    seenRegistrationIds.add(registrationId);
  }

  const awaitingGuestCount = awaitingPayment.length;

  let leadSection: TourFinanceMoneyInbox["leadSection"] = "settled";
  if (guestRows.length > 0 || input.pendingReceipts.length > 0) {
    leadSection = "awaiting_payment";
  }

  return {
    partialOutstanding,
    awaitingPayment,
    guestRows,
    awaitingGuestCount,
    leadSection,
  };
}

export function filterTourFinanceGuestRows(
  rows: readonly TourFinanceGuestRow[],
  filter: TourFinanceListFilter,
  searchQuery: string
): readonly TourFinanceGuestRow[] {
  const q = searchQuery.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === "unpaid" && row.kind !== "unpaid") {
      return false;
    }
    if (filter === "partial" && row.kind !== "partial") {
      return false;
    }
    if (q.length === 0) {
      return true;
    }
    return row.displayName.toLowerCase().includes(q);
  });
}

export function findTourFinanceGuestRow(
  rows: readonly TourFinanceGuestRow[],
  registrationId: string | null
): TourFinanceGuestRow | null {
  const id = registrationId?.trim() ?? "";
  if (id.length === 0) {
    return null;
  }
  return rows.find((row) => row.registrationId === id) ?? null;
}

/**
 * Show review feedback only when it still maps to the currently selected workspace row.
 * This keeps the message local to the relevant guest/case after list refreshes.
 */
export function resolveSelectedWorkspaceReviewResult(input: {
  readonly lastReviewResult: ReceiptReviewResultBanner | null;
  readonly selectedRow: TourFinanceGuestRow | null;
  readonly selectedReceiptId?: string | null;
}): ReceiptReviewResultBanner | null {
  const result = input.lastReviewResult;
  const row = input.selectedRow;
  if (result === null || row === null) {
    return null;
  }
  const registrationId = result.registrationId?.trim() ?? "";
  if (registrationId.length > 0) {
    return row.registrationId === registrationId ? result : null;
  }
  const receiptId = input.selectedReceiptId?.trim() ?? "";
  if (receiptId.length === 0) {
    return null;
  }
  return row.key === `receipt:${receiptId}` ? result : null;
}

export function resolveSelectedWorkspacePaymentAction(input: {
  readonly lastPaymentAction: TourWorkspacePaymentActionEvent | null;
  readonly selectedRow: TourFinanceGuestRow | null;
  readonly selectedReceiptId?: string | null;
}): TourWorkspacePaymentActionEvent | null {
  const event = input.lastPaymentAction;
  const row = input.selectedRow;
  if (event === null || row === null) {
    return null;
  }
  if (event.kind === "receipt_submitted") {
    const receiptId = input.selectedReceiptId?.trim() ?? "";
    if (receiptId.length > 0 && event.receiptId === receiptId) {
      return event;
    }
  }
  return row.registrationId === event.registrationId ? event : null;
}

/** H-04 — never present a capped page length as an absolute total when hasMore. */
export function formatCountMaybeMore(count: number, hasMore: boolean): string {
  const n = Math.max(0, Math.trunc(count));
  return hasMore ? `${n}+` : String(n);
}

export function readPendingReceiptsKpi(input: {
  readonly itemCount: number;
  readonly hasMore: boolean;
}): { readonly count: number; readonly hasMore: boolean; readonly label: string } {
  const count = Math.max(0, Math.trunc(input.itemCount));
  const hasMore = input.hasMore === true;
  return {
    count,
    hasMore,
    label: formatCountMaybeMore(count, hasMore),
  };
}
