/**
 * PR23-B2 — pure pending-receipt queue helpers (cursor + scope pagination).
 * No SLA / lifecycle semantics.
 */

export type PendingReceiptCursor = {
  readonly createdAt: Date;
  readonly id: string;
};

export type PendingReceiptQueueRow = {
  readonly id: string;
  readonly createdAt: Date;
  readonly tenantId?: string;
  readonly status?: string;
  readonly payment: { readonly registrationId: string } | null;
};

const CURSOR_SEP = "\n";

/** Opaque keyset cursor — createdAt ISO + id. */
export function encodePendingReceiptCursor(input: PendingReceiptCursor): string {
  const iso = input.createdAt.toISOString();
  return Buffer.from(`${iso}${CURSOR_SEP}${input.id}`, "utf8").toString("base64url");
}

export function decodePendingReceiptCursor(raw: string): PendingReceiptCursor | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 1024) {
    return null;
  }
  try {
    const decoded = Buffer.from(trimmed, "base64url").toString("utf8");
    const sep = decoded.indexOf(CURSOR_SEP);
    if (sep <= 0) {
      return null;
    }
    const iso = decoded.slice(0, sep);
    const id = decoded.slice(sep + CURSOR_SEP.length);
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
      return null;
    }
    return { createdAt, id };
  } catch {
    return null;
  }
}

export function comparePendingReceiptQueueOrder(
  a: { readonly createdAt: Date; readonly id: string },
  b: { readonly createdAt: Date; readonly id: string }
): number {
  const byTime = a.createdAt.getTime() - b.createdAt.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function isAfterPendingReceiptCursor(
  row: { readonly createdAt: Date; readonly id: string },
  cursor: PendingReceiptCursor
): boolean {
  return comparePendingReceiptQueueOrder(row, cursor) > 0;
}

export type PaginatePendingReceiptRowsResult<T extends PendingReceiptQueueRow> = {
  readonly rows: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

/**
 * In-memory / test parity: filter → sort → keyset → limit.
 * `registrationIds` when provided (including empty) restricts to that set.
 */
export function paginatePendingReceiptRows<T extends PendingReceiptQueueRow>(input: {
  readonly rows: readonly T[];
  readonly tenantId: string;
  readonly limit: number;
  readonly cursor?: string | null;
  readonly registrationId?: string;
  readonly registrationIds?: readonly string[];
}): PaginatePendingReceiptRowsResult<T> {
  const limit = Math.max(1, Math.floor(input.limit));
  let filtered = input.rows.filter(
    (row) =>
      (row.tenantId === undefined || row.tenantId === input.tenantId) &&
      (row.status === undefined || row.status === "Pending")
  );

  if (input.registrationId !== undefined) {
    filtered = filtered.filter(
      (row) => row.payment?.registrationId === input.registrationId
    );
  } else if (input.registrationIds !== undefined) {
    const allowed = new Set(input.registrationIds);
    filtered = filtered.filter((row) => {
      const reg = row.payment?.registrationId;
      return typeof reg === "string" && allowed.has(reg);
    });
  }

  const sorted = [...filtered].sort(comparePendingReceiptQueueOrder);

  let afterCursor = sorted;
  if (typeof input.cursor === "string" && input.cursor.trim().length > 0) {
    const decoded = decodePendingReceiptCursor(input.cursor);
    if (decoded !== null) {
      afterCursor = sorted.filter((row) => isAfterPendingReceiptCursor(row, decoded));
    }
  }

  const page = afterCursor.slice(0, limit);
  const hasMore = afterCursor.length > limit;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last !== undefined
      ? encodePendingReceiptCursor({ createdAt: last.createdAt, id: last.id })
      : null;

  return { rows: page, nextCursor, hasMore };
}
