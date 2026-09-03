import { filterEventsForMember, filterMessagesForMember } from "@app-tour/ticketing-core";
import type {
  MemberTicketDetailHttp,
  MemberTicketMessageHttp,
  OperatorTicketDetailHttp,
  OperatorTicketMessageHttp,
  OperatorTicketSummaryHttp,
  PaginatedMemberTicketListHttp,
  PaginatedOperatorTicketListHttp,
  TicketEventHttp,
  TicketSummaryHttp,
} from "@app-tour/ticketing-http-contracts";
import type { Ticket, TicketEvent, TicketMessage } from "@app-tour/ticketing-core";

export function toTicketSummaryHttp(ticket: Ticket): TicketSummaryHttp {
  return {
    id: ticket.id,
    subject: ticket.subject,
    categoryCode: ticket.categoryCode,
    priority: ticket.priority,
    status: ticket.status,
    assigneeUserId: ticket.assigneeUserId,
    lastActivityAt: ticket.lastActivityAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

export function toOperatorTicketSummaryHttp(ticket: Ticket): OperatorTicketSummaryHttp {
  return {
    ...toTicketSummaryHttp(ticket),
    requesterUserId: ticket.requesterUserId,
  };
}

export function toMemberMessageHttp(message: TicketMessage): MemberTicketMessageHttp {
  return {
    id: message.id,
    ticketId: message.ticketId,
    authorUserId: message.authorUserId,
    body: message.body,
    createdAt: message.createdAt,
  };
}

export function toOperatorMessageHttp(message: TicketMessage): OperatorTicketMessageHttp {
  return {
    ...toMemberMessageHttp(message),
    visibility: message.visibility,
  };
}

export function toTicketEventHttp(event: TicketEvent): TicketEventHttp {
  return {
    id: event.id,
    ticketId: event.ticketId,
    eventType: event.eventType,
    actorUserId: event.actorUserId,
    payload: event.payload,
    createdAt: event.createdAt,
  };
}

export function toMemberTicketDetailHttp(input: {
  readonly ticket: Ticket;
  readonly messages: readonly TicketMessage[];
  readonly events: readonly TicketEvent[];
}): MemberTicketDetailHttp {
  return {
    ticket: toTicketSummaryHttp(input.ticket),
    messages: filterMessagesForMember(input.messages).map(toMemberMessageHttp),
    events: filterEventsForMember(input.events).map(toTicketEventHttp),
    rowVersion: input.ticket.rowVersion,
  };
}

export function toOperatorTicketDetailHttp(input: {
  readonly ticket: Ticket;
  readonly messages: readonly TicketMessage[];
  readonly events: readonly TicketEvent[];
}): OperatorTicketDetailHttp {
  return {
    ticket: toOperatorTicketSummaryHttp(input.ticket),
    messages: input.messages.map(toOperatorMessageHttp),
    events: input.events.map(toTicketEventHttp),
    rowVersion: input.ticket.rowVersion,
  };
}

export function toMemberListHttp(input: {
  readonly items: readonly Ticket[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}): PaginatedMemberTicketListHttp {
  return {
    items: input.items.map(toTicketSummaryHttp),
    nextCursor: input.nextCursor,
    hasMore: input.hasMore,
  };
}

export function toOperatorListHttp(input: {
  readonly items: readonly Ticket[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}): PaginatedOperatorTicketListHttp {
  return {
    items: input.items.map(toOperatorTicketSummaryHttp),
    nextCursor: input.nextCursor,
    hasMore: input.hasMore,
  };
}
