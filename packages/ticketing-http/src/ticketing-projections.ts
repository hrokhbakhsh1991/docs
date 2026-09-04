import { filterEventsForMember, filterMessagesForMember, filterAttachmentsForMember, filterAttachmentsForOperator } from "@app-tour/ticketing-core";
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
  TicketAttachmentHttp,
  TicketLinkHttp,
} from "@app-tour/ticketing-http-contracts";
import type { Ticket, TicketEvent, TicketMessage, TicketAttachment, TicketLink } from "@app-tour/ticketing-core";

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

export function toTicketAttachmentHttp(attachment: TicketAttachment): TicketAttachmentHttp {
  return {
    id: attachment.id,
    ticketId: attachment.ticketId,
    messageId: attachment.messageId,
    originalFileName: attachment.originalFileName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    scanStatus: attachment.scanStatus,
    uploadedAt: attachment.uploadedAt,
    createdAt: attachment.createdAt,
  };
}

export function toTicketLinkHttp(link: TicketLink): TicketLinkHttp {
  return {
    id: link.id,
    ticketId: link.ticketId,
    entityType: link.entityType,
    entityId: link.entityId,
    createdAt: link.createdAt,
  };
}

function attachmentsForMessage(
  messageId: string,
  attachments: readonly TicketAttachment[],
): readonly TicketAttachmentHttp[] {
  return attachments
    .filter((attachment) => attachment.messageId === messageId)
    .map(toTicketAttachmentHttp);
}

export function toMemberMessageHttp(
  message: TicketMessage,
  attachments: readonly TicketAttachment[] = [],
): MemberTicketMessageHttp {
  return {
    id: message.id,
    ticketId: message.ticketId,
    authorUserId: message.authorUserId,
    body: message.body,
    createdAt: message.createdAt,
    attachments: attachmentsForMessage(message.id, attachments),
  };
}

export function toOperatorMessageHttp(
  message: TicketMessage,
  attachments: readonly TicketAttachment[] = [],
): OperatorTicketMessageHttp {
  return {
    ...toMemberMessageHttp(message, attachments),
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
  readonly attachments?: readonly TicketAttachment[];
  readonly links?: readonly TicketLink[];
}): MemberTicketDetailHttp {
  const visibleAttachments = filterAttachmentsForMember(
    input.attachments ?? [],
    input.messages,
  );
  return {
    ticket: toTicketSummaryHttp(input.ticket),
    messages: filterMessagesForMember(input.messages).map((message) =>
      toMemberMessageHttp(message, visibleAttachments),
    ),
    events: filterEventsForMember(input.events).map(toTicketEventHttp),
    ...(input.links !== undefined ? { links: input.links.map(toTicketLinkHttp) } : {}),
    rowVersion: input.ticket.rowVersion,
  };
}

export function toOperatorTicketDetailHttp(input: {
  readonly ticket: Ticket;
  readonly messages: readonly TicketMessage[];
  readonly events: readonly TicketEvent[];
  readonly attachments?: readonly TicketAttachment[];
  readonly links?: readonly TicketLink[];
  readonly sla?: Readonly<Record<string, unknown>>;
}): OperatorTicketDetailHttp {
  const visibleAttachments = filterAttachmentsForOperator(input.attachments ?? []);
  return {
    ticket: toOperatorTicketSummaryHttp(input.ticket),
    messages: input.messages.map((message) =>
      toOperatorMessageHttp(message, visibleAttachments),
    ),
    events: input.events.map(toTicketEventHttp),
    ...(input.links !== undefined ? { links: input.links.map(toTicketLinkHttp) } : {}),
    rowVersion: input.ticket.rowVersion,
    ...(input.sla !== undefined ? { sla: input.sla } : {}),
  };
}

export function toMemberListHttp(input: {
  readonly items: readonly { readonly ticket: Ticket; readonly publicMessageCount?: number }[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}): PaginatedMemberTicketListHttp {
  return {
    items: input.items.map((item) => ({
      ...toTicketSummaryHttp(item.ticket),
      publicMessageCount: item.publicMessageCount ?? 0,
    })),
    nextCursor: input.nextCursor,
    hasMore: input.hasMore,
  };
}

export function toOperatorListHttp(input: {
  readonly items: readonly { readonly ticket: Ticket; readonly publicMessageCount?: number }[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}): PaginatedOperatorTicketListHttp {
  return {
    items: input.items.map((item) => toOperatorTicketSummaryHttp(item.ticket)),
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
