import type { TicketListSort } from "@app-tour/ticketing-http-contracts";

export type DecodedTicketListCursor = {
  readonly sort: TicketListSort;
  readonly sortValue: string;
  readonly id: string;
};

export function encodeTicketListCursor(input: DecodedTicketListCursor): string {
  return Buffer.from(`${input.sort}|${input.sortValue}|${input.id}`).toString("base64url");
}

export function decodeTicketListCursor(cursor: string): DecodedTicketListCursor | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const sort = parts[0] as TicketListSort;
      return { sort, sortValue: parts[1], id: parts[2] };
    }
    const legacySeparator = decoded.indexOf("|");
    if (legacySeparator <= 0) return null;
    const iso = decoded.slice(0, legacySeparator);
    const id = decoded.slice(legacySeparator + 1);
    if (!id || Number.isNaN(new Date(iso).getTime())) return null;
    return { sort: "lastActivityAt", sortValue: iso, id };
  } catch {
    return null;
  }
}

export function ticketSortValue(row: {
  readonly lastActivityAt: Date;
  readonly createdAt: Date;
  readonly priority: string;
  readonly status: string;
}, sort: TicketListSort): string {
  switch (sort) {
    case "createdAt":
      return row.createdAt.toISOString();
    case "priority":
      return row.priority;
    case "status":
      return row.status;
    default:
      return row.lastActivityAt.toISOString();
  }
}
