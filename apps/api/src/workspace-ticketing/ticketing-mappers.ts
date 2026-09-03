import type { Ticket, TicketEvent, TicketMessage } from "@app-tour/ticketing-core";
import { randomUUID } from "node:crypto";
import type {
  TicketEvent as PrismaTicketEvent,
  TicketLink,
  TicketMessage as PrismaTicketMessage,
  Ticket as PrismaTicket,
} from "@prisma/client";

const TICKET_EVENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function coerceTicketEventId(id: string): string {
  return TICKET_EVENT_ID_RE.test(id) ? id : randomUUID();
}

export function toIso(value: Date): string {
  return value.toISOString();
}

export function mapTicketRow(
  row: PrismaTicket,
  links: readonly Pick<TicketLink, "entityType" | "entityId">[] = [],
): Ticket {
  const relatedTourId = links.find((link) => link.entityType === "tour")?.entityId ?? null;
  const relatedRegistrationId =
    links.find((link) => link.entityType === "registration")?.entityId ?? null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    requesterUserId: row.requesterUserId,
    assigneeUserId: row.assigneeUserId,
    categoryCode: row.categoryCode,
    subject: row.subject,
    priority: row.priority as Ticket["priority"],
    status: row.status as Ticket["status"],
    relatedTourId,
    relatedRegistrationId,
    rowVersion: row.rowVersion,
    lastActivityAt: toIso(row.lastActivityAt),
    resolvedAt: row.resolvedAt ? toIso(row.resolvedAt) : null,
    closedAt: row.closedAt ? toIso(row.closedAt) : null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function mapMessageRow(row: PrismaTicketMessage): TicketMessage {
  return {
    id: row.id,
    tenantId: row.tenantId,
    ticketId: row.ticketId,
    authorUserId: row.authorUserId,
    visibility: row.visibility as TicketMessage["visibility"],
    body: row.body,
    createdAt: toIso(row.createdAt),
  };
}

export function mapEventRow(row: PrismaTicketEvent): TicketEvent {
  const payload =
    row.payload !== null && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    tenantId: row.tenantId,
    ticketId: row.ticketId,
    eventType: row.eventType as TicketEvent["eventType"],
    actorUserId: row.actorUserId,
    payload,
    createdAt: toIso(row.createdAt),
  };
}

export function encodeListCursor(lastActivityAt: Date, id: string): string {
  return Buffer.from(`${lastActivityAt.toISOString()}|${id}`).toString("base64url");
}

export function decodeListCursor(
  cursor: string,
): { readonly lastActivityAt: Date; readonly id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const separator = decoded.indexOf("|");
    if (separator <= 0) return null;
    const iso = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!id) return null;
    const lastActivityAt = new Date(iso);
    if (Number.isNaN(lastActivityAt.getTime())) return null;
    return { lastActivityAt, id };
  } catch {
    return null;
  }
}
