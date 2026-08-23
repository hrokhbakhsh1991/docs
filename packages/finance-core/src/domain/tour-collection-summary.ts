/**
 * PR23-D2 — tour collection AR aggregation (pure).
 * Built only from outstanding invoice rows (D1), never payment/ledger sums.
 */

import { isPositiveBalanceDueMinor } from "./finance-exception";
import type { OutstandingBalanceItem } from "./outstanding-balance";

export type TourCollectionSummaryItem = {
  readonly tourId: string;
  readonly tourTitle: string | null;
  readonly registrationsCount: number;
  readonly invoiceTotalMinor: string;
  readonly collectedMinor: string;
  readonly remainingMinor: string;
  readonly currency: string;
};

export type TourCollectionCursor = {
  readonly remainingMinor: string;
  readonly tourId: string;
};

export type TourCollectionSortKey = {
  readonly remainingMinor: string;
  readonly tourId: string;
};

const CURSOR_SEP = "\n";

function parseMinorDigits(raw: string): bigint {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) {
    return BigInt(0);
  }
  try {
    return BigInt(digits);
  } catch {
    return BigInt(0);
  }
}

export function encodeTourCollectionCursor(input: TourCollectionCursor): string {
  return Buffer.from(`${input.remainingMinor}${CURSOR_SEP}${input.tourId}`, "utf8").toString(
    "base64url"
  );
}

export function decodeTourCollectionCursor(raw: string): TourCollectionCursor | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) {
    return null;
  }
  try {
    const decoded = Buffer.from(trimmed, "base64url").toString("utf8");
    const parts = decoded.split(CURSOR_SEP);
    if (parts.length !== 2) {
      return null;
    }
    const remainingMinor = parts[0] ?? "";
    const tourId = parts[1] ?? "";
    if (remainingMinor.length === 0 || tourId.length === 0) {
      return null;
    }
    return { remainingMinor, tourId };
  } catch {
    return null;
  }
}

/** remaining DESC, then tourId ASC. */
export function compareTourCollectionOrder(
  a: TourCollectionSortKey,
  b: TourCollectionSortKey
): number {
  const aRem = parseMinorDigits(a.remainingMinor);
  const bRem = parseMinorDigits(b.remainingMinor);
  if (aRem !== bRem) {
    return aRem > bRem ? -1 : 1;
  }
  return a.tourId < b.tourId ? -1 : a.tourId > b.tourId ? 1 : 0;
}

export function isAfterTourCollectionCursor(
  row: TourCollectionSortKey,
  cursor: TourCollectionCursor
): boolean {
  return compareTourCollectionOrder(row, cursor) > 0;
}

type MutableTourAgg = {
  tourId: string;
  tourTitle: string | null;
  registrationsCount: number;
  invoiceTotal: bigint;
  collected: bigint;
  remaining: bigint;
  currency: string;
};

/**
 * Aggregate D1 outstanding registration invoices by tour.
 * Skips rows without tourId. Does not read payments or ledger.
 */
export function aggregateTourCollectionFromOutstanding(
  items: readonly OutstandingBalanceItem[]
): readonly TourCollectionSummaryItem[] {
  const byTour = new Map<string, MutableTourAgg>();
  for (const item of items) {
    const tourId = item.identity.tourId?.trim() ?? "";
    if (tourId.length === 0) {
      continue;
    }
    if (!isPositiveBalanceDueMinor(item.invoice.remainingMinor)) {
      continue;
    }
    const existing = byTour.get(tourId);
    const total = parseMinorDigits(item.invoice.totalMinor);
    const paid = parseMinorDigits(item.invoice.paidMinor);
    const remaining = parseMinorDigits(item.invoice.remainingMinor);
    const title =
      typeof item.identity.tourTitle === "string" && item.identity.tourTitle.trim().length > 0
        ? item.identity.tourTitle.trim()
        : null;
    if (existing === undefined) {
      byTour.set(tourId, {
        tourId,
        tourTitle: title,
        registrationsCount: 1,
        invoiceTotal: total,
        collected: paid,
        remaining,
        currency: item.invoice.currency,
      });
      continue;
    }
    existing.registrationsCount += 1;
    existing.invoiceTotal += total;
    existing.collected += paid;
    existing.remaining += remaining;
    if (existing.tourTitle === null && title !== null) {
      existing.tourTitle = title;
    }
  }

  return [...byTour.values()]
    .map((row) => ({
      tourId: row.tourId,
      tourTitle: row.tourTitle,
      registrationsCount: row.registrationsCount,
      invoiceTotalMinor: row.invoiceTotal.toString(),
      collectedMinor: row.collected.toString(),
      remainingMinor: row.remaining.toString(),
      currency: row.currency,
    }))
    .filter((row) => isPositiveBalanceDueMinor(row.remainingMinor));
}

export type PaginateTourCollectionItemsResult = {
  readonly items: readonly TourCollectionSummaryItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export function paginateTourCollectionItems(input: {
  readonly items: readonly TourCollectionSummaryItem[];
  readonly limit: number;
  readonly cursor?: string | null;
}): PaginateTourCollectionItemsResult {
  const limit = Math.max(1, Math.floor(input.limit));
  const sorted = [...input.items].sort((a, b) =>
    compareTourCollectionOrder(
      { remainingMinor: a.remainingMinor, tourId: a.tourId },
      { remainingMinor: b.remainingMinor, tourId: b.tourId }
    )
  );

  let after = sorted;
  if (typeof input.cursor === "string" && input.cursor.trim().length > 0) {
    const decoded = decodeTourCollectionCursor(input.cursor);
    if (decoded !== null) {
      after = sorted.filter((item) =>
        isAfterTourCollectionCursor(
          { remainingMinor: item.remainingMinor, tourId: item.tourId },
          decoded
        )
      );
    }
  }

  const page = after.slice(0, limit);
  const hasMore = after.length > limit;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last !== undefined
      ? encodeTourCollectionCursor({
          remainingMinor: last.remainingMinor,
          tourId: last.tourId,
        })
      : null;

  return { items: page, nextCursor, hasMore };
}
