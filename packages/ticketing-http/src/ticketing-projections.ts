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

export type TicketTagHttp = {
  readonly code: string;
  readonly label: string;
  readonly colorToken: string | null;
  readonly archivedAt: string | null;
  readonly rowVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TicketQueueHttp = {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly filterJson: Readonly<Record<string, unknown>>;
  readonly teamCode: string | null;
  readonly isDefault: boolean;
  readonly archivedAt: string | null;
  readonly rowVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TicketTeamHttp = {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly isDefault: boolean;
  readonly archivedAt: string | null;
  readonly rowVersion: number;
  readonly memberUserIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TicketCategoryHttp = {
  readonly code: string;
  readonly labelKey: string;
  readonly description?: string;
  readonly icon?: string;
  readonly sortOrder: number;
  readonly defaultPriority?: string;
};

export function toTicketTagHttp(
  tag: {
    readonly code: string;
    readonly label: string;
    readonly colorToken: string | null;
    readonly archivedAt: string | null;
    readonly rowVersion: number;
    readonly createdAt: string;
    readonly updatedAt: string;
  },
): TicketTagHttp {
  return {
    code: tag.code,
    label: tag.label,
    colorToken: tag.colorToken,
    archivedAt: tag.archivedAt,
    rowVersion: tag.rowVersion,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

export function toTicketQueueHttp(
  queue: {
    readonly code: string;
    readonly name: string;
    readonly description: string | null;
    readonly enabled: boolean;
    readonly sortOrder: number;
    readonly filterJson: Readonly<Record<string, unknown>>;
    readonly teamCode: string | null;
    readonly isDefault: boolean;
    readonly archivedAt: string | null;
    readonly rowVersion: number;
    readonly createdAt: string;
    readonly updatedAt: string;
  },
): TicketQueueHttp {
  return {
    code: queue.code,
    name: queue.name,
    description: queue.description,
    enabled: queue.enabled,
    sortOrder: queue.sortOrder,
    filterJson: queue.filterJson,
    teamCode: queue.teamCode,
    isDefault: queue.isDefault,
    archivedAt: queue.archivedAt,
    rowVersion: queue.rowVersion,
    createdAt: queue.createdAt,
    updatedAt: queue.updatedAt,
  };
}

export function toTicketTeamHttp(
  team: {
    readonly code: string;
    readonly name: string;
    readonly description: string | null;
    readonly enabled: boolean;
    readonly isDefault: boolean;
    readonly archivedAt: string | null;
    readonly rowVersion: number;
    readonly memberUserIds: readonly string[];
    readonly createdAt: string;
    readonly updatedAt: string;
  },
): TicketTeamHttp {
  return {
    code: team.code,
    name: team.name,
    description: team.description,
    enabled: team.enabled,
    isDefault: team.isDefault,
    archivedAt: team.archivedAt,
    rowVersion: team.rowVersion,
    memberUserIds: team.memberUserIds,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}
