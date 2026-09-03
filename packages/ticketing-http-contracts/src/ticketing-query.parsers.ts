/**
 * Ticketing list query parsers — TKT-001 Phase 1.
 */
import {
  DEFAULT_TICKET_LIST_LIMIT,
  MAX_TICKET_LIST_LIMIT,
  TICKET_LIST_SORTS,
  type TicketListSort,
  type TicketPriority,
  type TicketStatus,
} from "./ticketing-enums";
import { ticketPrioritySchema, ticketStatusSchema, uuidSchema } from "./ticketing-validation";

export type MemberTicketListQuery = {
  readonly cursor?: string;
  readonly limit: number;
  readonly status?: TicketStatus;
};

export type OperatorTicketListQuery = {
  readonly cursor?: string;
  readonly limit: number;
  readonly status?: TicketStatus;
  readonly priority?: TicketPriority;
  readonly categoryCode?: string;
  readonly assigneeUserId?: string;
  readonly unassigned?: boolean;
  readonly q?: string;
  readonly sort: TicketListSort;
};

function parseOptionalCursor(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length > 1024) {
    throw new Error("ZOD_VALIDATION_FAILED: cursor length exceeded");
  }
  return trimmed;
}

export function parseTicketListLimit(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return DEFAULT_TICKET_LIST_LIMIT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error("ZOD_VALIDATION_FAILED: limit must be an integer");
  }
  return Math.min(Math.max(parsed, 1), MAX_TICKET_LIST_LIMIT);
}

function parseOptionalStatus(raw: string | null | undefined): TicketStatus | undefined {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const result = ticketStatusSchema.safeParse(raw.trim());
  if (!result.success) {
    throw new Error("ZOD_VALIDATION_FAILED: status invalid");
  }
  return result.data;
}

function parseOptionalPriority(raw: string | null | undefined): TicketPriority | undefined {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const result = ticketPrioritySchema.safeParse(raw.trim());
  if (!result.success) {
    throw new Error("ZOD_VALIDATION_FAILED: priority invalid");
  }
  return result.data;
}

function parseOptionalSort(raw: string | null | undefined): TicketListSort {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return "lastActivityAt";
  }
  const trimmed = raw.trim();
  if (!(TICKET_LIST_SORTS as readonly string[]).includes(trimmed)) {
    throw new Error("ZOD_VALIDATION_FAILED: sort invalid");
  }
  return trimmed as TicketListSort;
}

/** Member GET /member/tickets — status + pagination only. */
export function parseMemberTicketListQuery(url: URL): MemberTicketListQuery {
  return {
    ...(parseOptionalCursor(url.searchParams.get("cursor")) !== undefined
      ? { cursor: parseOptionalCursor(url.searchParams.get("cursor")) }
      : {}),
    limit: parseTicketListLimit(url.searchParams.get("limit")),
    ...(parseOptionalStatus(url.searchParams.get("status")) !== undefined
      ? { status: parseOptionalStatus(url.searchParams.get("status")) }
      : {}),
  };
}

/** Operator GET /tickets — full filter surface. */
export function parseOperatorTicketListQuery(url: URL): OperatorTicketListQuery {
  const categoryRaw = url.searchParams.get("categoryCode")?.trim();
  const assigneeRaw = url.searchParams.get("assigneeUserId")?.trim();
  const unassignedRaw = url.searchParams.get("unassigned")?.trim().toLowerCase();
  const qRaw = url.searchParams.get("q")?.trim();

  let assigneeUserId: string | undefined;
  if (assigneeRaw !== undefined && assigneeRaw.length > 0) {
    const result = uuidSchema.safeParse(assigneeRaw);
    if (!result.success) {
      throw new Error("ZOD_VALIDATION_FAILED: assigneeUserId invalid");
    }
    assigneeUserId = result.data;
  }

  return {
    ...(parseOptionalCursor(url.searchParams.get("cursor")) !== undefined
      ? { cursor: parseOptionalCursor(url.searchParams.get("cursor")) }
      : {}),
    limit: parseTicketListLimit(url.searchParams.get("limit")),
    ...(parseOptionalStatus(url.searchParams.get("status")) !== undefined
      ? { status: parseOptionalStatus(url.searchParams.get("status")) }
      : {}),
    ...(parseOptionalPriority(url.searchParams.get("priority")) !== undefined
      ? { priority: parseOptionalPriority(url.searchParams.get("priority")) }
      : {}),
    ...(categoryRaw !== undefined && categoryRaw.length > 0 ? { categoryCode: categoryRaw } : {}),
    ...(assigneeUserId !== undefined ? { assigneeUserId } : {}),
    ...(unassignedRaw === "true" || unassignedRaw === "1" ? { unassigned: true } : {}),
    ...(qRaw !== undefined && qRaw.length > 0 ? { q: qRaw.slice(0, 200) } : {}),
    sort: parseOptionalSort(url.searchParams.get("sort")),
  };
}
