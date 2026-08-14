/**
 * PR23-D1 — outstanding balance AR read helpers (pure).
 * Invoice compile remains the only remaining-balance SoT.
 */

import { isPositiveBalanceDueMinor } from "./finance-exception";

export type OutstandingBalanceIdentity = {
  readonly memberDisplayName: string | null;
  readonly tourTitle: string | null;
  readonly tourId: string | null;
};

export type OutstandingBalanceInvoice = {
  readonly totalMinor: string;
  readonly paidMinor: string;
  readonly remainingMinor: string;
  readonly currency: string;
};

export type OutstandingBalanceItem = {
  readonly registrationId: string;
  readonly identity: OutstandingBalanceIdentity;
  readonly invoice: OutstandingBalanceInvoice;
  readonly bookingPaymentStatus: "unpaid" | "partial" | "paid" | null;
  readonly occurredAt: string;
};

export type OutstandingBalanceCursor = {
  readonly occurredAt: Date;
  readonly registrationId: string;
};

export type OutstandingBalanceSortKey = {
  readonly occurredAt: Date;
  readonly registrationId: string;
};

const CURSOR_SEP = "\n";

export function encodeOutstandingBalanceCursor(input: OutstandingBalanceCursor): string {
  return Buffer.from(
    `${input.occurredAt.toISOString()}${CURSOR_SEP}${input.registrationId}`,
    "utf8"
  ).toString("base64url");
}

export function decodeOutstandingBalanceCursor(raw: string): OutstandingBalanceCursor | null {
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
    const occurredAt = new Date(parts[0] ?? "");
    const registrationId = parts[1] ?? "";
    if (Number.isNaN(occurredAt.getTime()) || registrationId.length === 0) {
      return null;
    }
    return { occurredAt, registrationId };
  } catch {
    return null;
  }
}

export function compareOutstandingBalanceOrder(
  a: OutstandingBalanceSortKey,
  b: OutstandingBalanceSortKey
): number {
  const byTime = a.occurredAt.getTime() - b.occurredAt.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  return a.registrationId < b.registrationId
    ? -1
    : a.registrationId > b.registrationId
      ? 1
      : 0;
}

export function isAfterOutstandingBalanceCursor(
  row: OutstandingBalanceSortKey,
  cursor: OutstandingBalanceCursor
): boolean {
  return compareOutstandingBalanceOrder(row, cursor) > 0;
}

export type PaginateOutstandingBalanceItemsResult = {
  readonly items: readonly OutstandingBalanceItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

/**
 * Keyset page over already-filtered outstanding items (remaining > 0).
 * Preserves oldest-obligation-first ordering; does not sort by payment rows.
 */
export function paginateOutstandingBalanceItems(input: {
  readonly items: readonly OutstandingBalanceItem[];
  readonly limit: number;
  readonly cursor?: string | null;
}): PaginateOutstandingBalanceItemsResult {
  const limit = Math.max(1, Math.floor(input.limit));
  const sorted = [...input.items].sort((a, b) =>
    compareOutstandingBalanceOrder(
      { occurredAt: new Date(a.occurredAt), registrationId: a.registrationId },
      { occurredAt: new Date(b.occurredAt), registrationId: b.registrationId }
    )
  );

  let after = sorted;
  if (typeof input.cursor === "string" && input.cursor.trim().length > 0) {
    const decoded = decodeOutstandingBalanceCursor(input.cursor);
    if (decoded !== null) {
      after = sorted.filter((item) =>
        isAfterOutstandingBalanceCursor(
          { occurredAt: new Date(item.occurredAt), registrationId: item.registrationId },
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
      ? encodeOutstandingBalanceCursor({
          occurredAt: new Date(last.occurredAt),
          registrationId: last.registrationId,
        })
      : null;

  return { items: page, nextCursor, hasMore };
}

export { isPositiveBalanceDueMinor };
