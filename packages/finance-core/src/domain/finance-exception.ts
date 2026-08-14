/**
 * PR23-C2 — read-only operator finance exceptions (pure helpers).
 * No SLA / mutation / settlement invention.
 */

export const FINANCE_EXCEPTION_TYPE = {
  REJECTED_RECEIPT_PENDING_PAYMENT: "REJECTED_RECEIPT_PENDING_PAYMENT",
  CANCELLED_PAYMENT_WITH_BALANCE: "CANCELLED_PAYMENT_WITH_BALANCE",
} as const;

export type FinanceExceptionType =
  (typeof FINANCE_EXCEPTION_TYPE)[keyof typeof FINANCE_EXCEPTION_TYPE];

export type FinanceExceptionSeverity = "attention" | "info";

export type FinanceExceptionIdentity = {
  readonly memberDisplayName: string | null;
  readonly tourTitle: string | null;
  readonly tourId: string | null;
};

export type FinanceExceptionPayment = {
  readonly id: string;
  readonly status: "Pending" | "Cancelled";
  readonly amount: string;
  readonly currency: string;
  readonly method: string;
};

export type FinanceExceptionItem = {
  readonly id: string;
  readonly type: FinanceExceptionType;
  readonly severity: FinanceExceptionSeverity;
  readonly registrationId: string;
  readonly identity: FinanceExceptionIdentity;
  readonly payment: FinanceExceptionPayment;
  readonly reason: string | null;
  readonly balanceDueMinor: string | null;
  readonly bookingPaymentStatus: "unpaid" | "partial" | "paid" | null;
  readonly href: {
    readonly payments: string;
    readonly receipts?: string;
  };
  readonly occurredAt: string;
};

export type FinanceExceptionCursor = {
  readonly typePriority: number;
  readonly occurredAt: Date;
  readonly id: string;
};

export type FinanceExceptionSortKey = {
  readonly typePriority: number;
  readonly occurredAt: Date;
  readonly id: string;
};

const CURSOR_SEP = "\n";

export function financeExceptionTypePriority(type: FinanceExceptionType): number {
  return type === FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT ? 0 : 1;
}

export function buildFinanceExceptionId(
  type: FinanceExceptionType,
  paymentId: string
): string {
  return `${type}:${paymentId}`;
}

export function encodeFinanceExceptionCursor(input: FinanceExceptionCursor): string {
  return Buffer.from(
    `${input.typePriority}${CURSOR_SEP}${input.occurredAt.toISOString()}${CURSOR_SEP}${input.id}`,
    "utf8"
  ).toString("base64url");
}

export function decodeFinanceExceptionCursor(raw: string): FinanceExceptionCursor | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) {
    return null;
  }
  try {
    const decoded = Buffer.from(trimmed, "base64url").toString("utf8");
    const parts = decoded.split(CURSOR_SEP);
    if (parts.length !== 3) {
      return null;
    }
    const typePriority = Number.parseInt(parts[0] ?? "", 10);
    const occurredAt = new Date(parts[1] ?? "");
    const id = parts[2] ?? "";
    if (!Number.isFinite(typePriority) || Number.isNaN(occurredAt.getTime()) || id.length === 0) {
      return null;
    }
    return { typePriority, occurredAt, id };
  } catch {
    return null;
  }
}

export function compareFinanceExceptionOrder(
  a: FinanceExceptionSortKey,
  b: FinanceExceptionSortKey
): number {
  if (a.typePriority !== b.typePriority) {
    return a.typePriority - b.typePriority;
  }
  const byTime = a.occurredAt.getTime() - b.occurredAt.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function isAfterFinanceExceptionCursor(
  row: FinanceExceptionSortKey,
  cursor: FinanceExceptionCursor
): boolean {
  return compareFinanceExceptionOrder(row, cursor) > 0;
}

export function buildFinanceExceptionPaymentsHref(registrationId: string): string {
  return `/finance?tab=payments&registrationId=${encodeURIComponent(registrationId)}`;
}

export function buildFinanceExceptionReceiptsHref(registrationId: string): string {
  return `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`;
}

/** True when invoice remaining is a positive minor amount. */
export function isPositiveBalanceDueMinor(balanceDueMinor: string | null | undefined): boolean {
  if (balanceDueMinor === null || balanceDueMinor === undefined) {
    return false;
  }
  const digits = balanceDueMinor.replace(/\D/g, "");
  if (digits.length === 0) {
    return false;
  }
  try {
    return BigInt(digits) > BigInt(0);
  } catch {
    return false;
  }
}

export type PaginateFinanceExceptionItemsResult = {
  readonly items: readonly FinanceExceptionItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export function paginateFinanceExceptionItems(input: {
  readonly items: readonly FinanceExceptionItem[];
  readonly limit: number;
  readonly cursor?: string | null;
}): PaginateFinanceExceptionItemsResult {
  const limit = Math.max(1, Math.floor(input.limit));
  const sorted = [...input.items].sort((a, b) =>
    compareFinanceExceptionOrder(
      {
        typePriority: financeExceptionTypePriority(a.type),
        occurredAt: new Date(a.occurredAt),
        id: a.id,
      },
      {
        typePriority: financeExceptionTypePriority(b.type),
        occurredAt: new Date(b.occurredAt),
        id: b.id,
      }
    )
  );

  let after = sorted;
  if (typeof input.cursor === "string" && input.cursor.trim().length > 0) {
    const decoded = decodeFinanceExceptionCursor(input.cursor);
    if (decoded !== null) {
      after = sorted.filter((item) =>
        isAfterFinanceExceptionCursor(
          {
            typePriority: financeExceptionTypePriority(item.type),
            occurredAt: new Date(item.occurredAt),
            id: item.id,
          },
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
      ? encodeFinanceExceptionCursor({
          typePriority: financeExceptionTypePriority(last.type),
          occurredAt: new Date(last.occurredAt),
          id: last.id,
        })
      : null;

  return { items: page, nextCursor, hasMore };
}
