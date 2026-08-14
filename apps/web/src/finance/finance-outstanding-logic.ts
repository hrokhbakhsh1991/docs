/**
 * PR23 UX-1 — Outstanding AR presentation helpers (parse/display only).
 * Money and identity come from FinanceService report responses — no client AR math.
 */

import { parseFinanceRegistrationContext } from "@/finance/finance-registration-context";

export const FINANCE_OUTSTANDING_TEST_IDS = {
  panel: "finance-outstanding-panel",
  list: "finance-outstanding-list",
  tours: "finance-outstanding-tours",
  loading: "finance-outstanding-loading",
  empty: "finance-outstanding-empty",
  error: "finance-outstanding-error",
  refresh: "finance-outstanding-refresh",
  item: "finance-outstanding-item",
  remaining: "finance-outstanding-remaining",
  tourRow: "finance-outstanding-tour-row",
  openPayments: "finance-outstanding-open-payments",
  agingUnavailable: "finance-outstanding-aging-unavailable",
} as const;

export type OutstandingBalanceListItem = {
  readonly registrationId: string;
  readonly identity: {
    readonly memberDisplayName: string | null;
    readonly tourTitle: string | null;
    readonly tourId: string | null;
  };
  readonly invoice: {
    readonly totalMinor: string;
    readonly paidMinor: string;
    readonly remainingMinor: string;
    readonly currency: string;
  };
  readonly bookingPaymentStatus: "unpaid" | "partial" | "paid" | null;
  readonly occurredAt: string;
};

export type OutstandingBalancesPage = {
  readonly items: readonly OutstandingBalanceListItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export type TourCollectionListItem = {
  readonly tourId: string;
  readonly tourTitle: string | null;
  readonly registrationsCount: number;
  readonly invoiceTotalMinor: string;
  readonly collectedMinor: string;
  readonly remainingMinor: string;
  readonly currency: string;
};

export type TourCollectionsPage = {
  readonly items: readonly TourCollectionListItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

function parseIdentity(raw: unknown): OutstandingBalanceListItem["identity"] {
  if (raw === null || typeof raw !== "object") {
    return { memberDisplayName: null, tourTitle: null, tourId: null };
  }
  const row = raw as Record<string, unknown>;
  return {
    memberDisplayName:
      typeof row.memberDisplayName === "string" ? row.memberDisplayName : null,
    tourTitle: typeof row.tourTitle === "string" ? row.tourTitle : null,
    tourId: typeof row.tourId === "string" ? row.tourId : null,
  };
}

function parseInvoice(raw: unknown): OutstandingBalanceListItem["invoice"] | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (
    typeof row.totalMinor !== "string" ||
    typeof row.paidMinor !== "string" ||
    typeof row.remainingMinor !== "string" ||
    typeof row.currency !== "string"
  ) {
    return null;
  }
  return {
    totalMinor: row.totalMinor,
    paidMinor: row.paidMinor,
    remainingMinor: row.remainingMinor,
    currency: row.currency,
  };
}

export function parseOutstandingBalanceItem(raw: unknown): OutstandingBalanceListItem | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.registrationId !== "string" || typeof row.occurredAt !== "string") {
    return null;
  }
  const invoice = parseInvoice(row.invoice);
  if (invoice === null) {
    return null;
  }
  const bookingPaymentStatus =
    row.bookingPaymentStatus === "unpaid" ||
    row.bookingPaymentStatus === "partial" ||
    row.bookingPaymentStatus === "paid"
      ? row.bookingPaymentStatus
      : null;
  return {
    registrationId: row.registrationId,
    identity: parseIdentity(row.identity),
    invoice,
    bookingPaymentStatus,
    occurredAt: row.occurredAt,
  };
}

export function parseOutstandingBalancesResponse(raw: unknown): OutstandingBalancesPage {
  if (raw === null || typeof raw !== "object") {
    return { items: [], nextCursor: null, hasMore: false };
  }
  const body = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  const items: OutstandingBalanceListItem[] = [];
  for (const entry of itemsRaw) {
    const parsed = parseOutstandingBalanceItem(entry);
    if (parsed !== null) {
      items.push(parsed);
    }
  }
  return {
    items,
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
    hasMore: body.hasMore === true,
  };
}

export function parseTourCollectionItem(raw: unknown): TourCollectionListItem | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (
    typeof row.tourId !== "string" ||
    typeof row.registrationsCount !== "number" ||
    typeof row.invoiceTotalMinor !== "string" ||
    typeof row.collectedMinor !== "string" ||
    typeof row.remainingMinor !== "string" ||
    typeof row.currency !== "string"
  ) {
    return null;
  }
  return {
    tourId: row.tourId,
    tourTitle: typeof row.tourTitle === "string" ? row.tourTitle : null,
    registrationsCount: row.registrationsCount,
    invoiceTotalMinor: row.invoiceTotalMinor,
    collectedMinor: row.collectedMinor,
    remainingMinor: row.remainingMinor,
    currency: row.currency,
  };
}

export function parseTourCollectionsResponse(raw: unknown): TourCollectionsPage {
  if (raw === null || typeof raw !== "object") {
    return { items: [], nextCursor: null, hasMore: false };
  }
  const body = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  const items: TourCollectionListItem[] = [];
  for (const entry of itemsRaw) {
    const parsed = parseTourCollectionItem(entry);
    if (parsed !== null) {
      items.push(parsed);
    }
  }
  return {
    items,
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
    hasMore: body.hasMore === true,
  };
}

/** Presentation filter only — does not recompute money. */
export function filterOutstandingByTourId(
  items: readonly OutstandingBalanceListItem[],
  tourId: string | null | undefined
): readonly OutstandingBalanceListItem[] {
  const id = tourId?.trim() ?? "";
  if (id.length === 0) {
    return items;
  }
  return items.filter((item) => item.identity.tourId === id);
}

export function outstandingPaymentsHref(registrationId: string): string {
  return `/finance?tab=payments&registrationId=${encodeURIComponent(registrationId)}`;
}

export function outstandingRegistrationContext(item: OutstandingBalanceListItem) {
  return parseFinanceRegistrationContext({
    registrationId: item.registrationId,
    tourId: item.identity.tourId ?? "",
    tourTitle: item.identity.tourTitle ?? "",
    memberDisplayName: item.identity.memberDisplayName ?? "",
  });
}

/** Guard: outstanding UI modules must not invent age buckets or wallet nets. */
export function financeOutstandingLogicForbidsClientAgingMath(source: string): boolean {
  // Build needles without embedding contiguous forbidden identifiers in this file.
  const bucketNeedle = ["aging", "Bucket"].join("");
  const daysNeedle = ["age", "Days"].join("");
  const walletNeedle = ["wallet", "Net"].join("");
  return (
    !source.includes(bucketNeedle) &&
    !source.includes(daysNeedle) &&
    !source.includes(walletNeedle) &&
    !/remainingMinor\s*[+\-*\/]/.test(source)
  );
}
