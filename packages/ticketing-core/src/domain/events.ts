/**
 * Ticket domain events — pure shapes (TKT-001 Phase 2).
 */
import type { TicketEvent, TicketEventType } from "./types";

export type CreateTicketEventInput = {
  readonly id: string;
  readonly tenantId: string;
  readonly ticketId: string;
  readonly actorUserId: string | null;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

export function buildTicketEvent(input: CreateTicketEventInput & { eventType: TicketEventType }): TicketEvent {
  return {
    id: input.id,
    tenantId: input.tenantId,
    ticketId: input.ticketId,
    eventType: input.eventType,
    actorUserId: input.actorUserId,
    payload: input.payload ?? {},
    createdAt: input.createdAt,
  };
}

export const MEMBER_VISIBLE_EVENT_TYPES: readonly TicketEventType[] = [
  "ticket.status.changed",
  "ticket.reopened",
];

export function isMemberVisibleEvent(event: TicketEvent): boolean {
  return (MEMBER_VISIBLE_EVENT_TYPES as readonly string[]).includes(event.eventType);
}

export function filterEventsForMember(events: readonly TicketEvent[]): readonly TicketEvent[] {
  return events.filter(isMemberVisibleEvent);
}
