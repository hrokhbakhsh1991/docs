/**
 * PR23-E3 — operator refund list keyset helpers (pure).
 * Order: requestedAt DESC, id DESC. Next page = strictly older than cursor.
 */

export type OperatorRefundCursor = {
  readonly requestedAt: Date;
  readonly id: string;
};

export type OperatorRefundSortKey = {
  readonly requestedAt: Date;
  readonly id: string;
};

const CURSOR_SEP = "\n";

export function encodeOperatorRefundCursor(input: OperatorRefundCursor): string {
  return Buffer.from(
    `${input.requestedAt.toISOString()}${CURSOR_SEP}${input.id}`,
    "utf8"
  ).toString("base64url");
}

export function decodeOperatorRefundCursor(raw: string): OperatorRefundCursor | null {
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
    const requestedAt = new Date(parts[0] ?? "");
    const id = parts[1] ?? "";
    if (Number.isNaN(requestedAt.getTime()) || id.length === 0) {
      return null;
    }
    return { requestedAt, id };
  } catch {
    return null;
  }
}

/** Sort comparator: newest requestedAt first, then id DESC. */
export function compareOperatorRefundOrder(
  a: OperatorRefundSortKey,
  b: OperatorRefundSortKey
): number {
  const byTime = b.requestedAt.getTime() - a.requestedAt.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** True when `row` is strictly older than `cursor` under DESC (requestedAt, id). */
export function isOlderThanOperatorRefundCursor(
  row: OperatorRefundSortKey,
  cursor: OperatorRefundCursor
): boolean {
  const byTime = row.requestedAt.getTime() - cursor.requestedAt.getTime();
  if (byTime !== 0) {
    return byTime < 0;
  }
  return row.id < cursor.id;
}
