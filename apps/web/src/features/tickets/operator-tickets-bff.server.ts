import type {
  OperatorTicketDetailHttp,
  OperatorTicketMessageHttp,
  OperatorTicketSummaryHttp,
  PaginatedOperatorTicketListHttp,
  TicketEventHttp,
} from "@app-tour/ticketing-http-contracts";

import {
  formatOperatorTicketDateTime,
  shortenUserId,
  ticketCategoryLabelKey,
  ticketPriorityLabelKey,
  ticketStatusIcon,
  ticketStatusLabelKey,
} from "./operator-tickets-format";
import type {
  OperatorTicketDetailView,
  OperatorTicketEventView,
  OperatorTicketListItemView,
  OperatorTicketListView,
  OperatorTicketMessageView,
  OperatorTicketsMetaView,
} from "./operator-tickets-types";

export type OperatorTicketsBffPayload = {
  readonly ok: true;
  readonly list: OperatorTicketListView;
};

export type OperatorTicketDetailBffPayload = {
  readonly ok: true;
  readonly detail: OperatorTicketDetailView;
};

export type OperatorTicketsMetaBffPayload = {
  readonly ok: true;
  readonly meta: OperatorTicketsMetaView;
};

export type OperatorTicketMutationBffPayload = {
  readonly ok: true;
  readonly detail: OperatorTicketDetailView;
};

export type OperatorTicketMessageBffPayload = {
  readonly ok: true;
  readonly detail: OperatorTicketDetailView;
  readonly message: OperatorTicketMessageView;
};

export type OperatorTicketsBffError = {
  readonly ok: false;
  readonly code: string;
  readonly status: number;
  readonly message?: string;
};

type UserLabelResolver = (userId: string) => string;

function defaultUserLabel(userId: string): string {
  return shortenUserId(userId);
}

function mapMessage(
  message: OperatorTicketMessageHttp,
  locale: string,
  resolveUserLabel: UserLabelResolver,
): OperatorTicketMessageView {
  return {
    id: message.id,
    ticketId: message.ticketId,
    authorUserId: message.authorUserId,
    authorLabel: resolveUserLabel(message.authorUserId),
    body: message.body,
    visibility: message.visibility,
    createdAt: message.createdAt,
    createdAtLabel: formatOperatorTicketDateTime(message.createdAt, locale),
    attachments: (message.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      originalFileName: attachment.originalFileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      uploadedAtLabel:
        attachment.uploadedAt !== null
          ? formatOperatorTicketDateTime(attachment.uploadedAt, locale)
          : null,
    })),
  };
}

function mapEvent(
  event: TicketEventHttp,
  locale: string,
  resolveUserLabel: UserLabelResolver,
): OperatorTicketEventView {
  return {
    id: event.id,
    eventType: event.eventType,
    actorUserId: event.actorUserId,
    actorLabel: event.actorUserId !== null ? resolveUserLabel(event.actorUserId) : null,
    createdAt: event.createdAt,
    createdAtLabel: formatOperatorTicketDateTime(event.createdAt, locale),
    payload: event.payload,
  };
}

export function mapOperatorTicketSummaryToListItem(
  item: OperatorTicketSummaryHttp,
  locale: string,
  options?: {
    readonly resolveUserLabel?: UserLabelResolver;
    readonly hasInternalNotes?: boolean;
    readonly hasAttachments?: boolean;
    readonly tagCodes?: readonly string[];
    readonly assigneeLabel?: string | null;
  },
): OperatorTicketListItemView {
  const resolveUserLabel = options?.resolveUserLabel ?? defaultUserLabel;
  return {
    id: item.id,
    subject: item.subject,
    requesterUserId: item.requesterUserId,
    requesterLabel: resolveUserLabel(item.requesterUserId),
    categoryCode: item.categoryCode,
    categoryLabelKey: ticketCategoryLabelKey(item.categoryCode),
    priority: item.priority,
    priorityLabelKey: ticketPriorityLabelKey(item.priority),
    status: item.status,
    statusLabelKey: ticketStatusLabelKey(item.status),
    statusIcon: ticketStatusIcon(item.status),
    assigneeUserId: item.assigneeUserId,
    assigneeLabel:
      options?.assigneeLabel ??
      (item.assigneeUserId !== null ? resolveUserLabel(item.assigneeUserId) : null),
    lastActivityAt: item.lastActivityAt,
    lastActivityLabel: formatOperatorTicketDateTime(item.lastActivityAt, locale),
    hasInternalNotes: options?.hasInternalNotes ?? false,
    hasAttachments: options?.hasAttachments ?? false,
    tagCodes: options?.tagCodes ?? [],
  };
}

export function buildOperatorTicketListView(
  page: PaginatedOperatorTicketListHttp,
  locale: string,
  resolveUserLabel: UserLabelResolver = defaultUserLabel,
): OperatorTicketListView {
  return {
    items: page.items.map((item) => mapOperatorTicketSummaryToListItem(item, locale, { resolveUserLabel })),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export function buildOperatorTicketDetailView(
  detail: OperatorTicketDetailHttp,
  locale: string,
  resolveUserLabel: UserLabelResolver = defaultUserLabel,
  extras?: {
    readonly queueCode?: string | null;
    readonly assigneeTeamId?: string | null;
    readonly tagCodes?: readonly string[];
  },
): OperatorTicketDetailView {
  const hasInternalNotes = detail.messages.some((message) => message.visibility === "internal");
  const hasAttachments = detail.messages.some(
    (message) => (message.attachments?.length ?? 0) > 0,
  );
  const ticket = mapOperatorTicketSummaryToListItem(detail.ticket, locale, {
    resolveUserLabel,
    hasInternalNotes,
    hasAttachments,
    tagCodes: extras?.tagCodes ?? [],
  });
  return {
    ticket,
    rowVersion: detail.rowVersion,
    links: detail.links ?? [],
    queueCode: extras?.queueCode ?? null,
    assigneeTeamId: extras?.assigneeTeamId ?? null,
    messages: detail.messages.map((message) => mapMessage(message, locale, resolveUserLabel)),
    events: detail.events.map((event) => mapEvent(event, locale, resolveUserLabel)),
  };
}

export function mergeMessageIntoDetail(
  detail: OperatorTicketDetailView,
  message: OperatorTicketMessageView,
): OperatorTicketDetailView {
  const messages = [...detail.messages, message];
  const hasInternalNotes = messages.some((entry) => entry.visibility === "internal");
  const hasAttachments = messages.some((entry) => entry.attachments.length > 0);
  return {
    ...detail,
    ticket: {
      ...detail.ticket,
      lastActivityAt: message.createdAt,
      lastActivityLabel: message.createdAtLabel,
      hasInternalNotes,
      hasAttachments,
    },
    messages,
  };
}

export function buildOperatorTicketsMetaView(input: {
  readonly categories: OperatorTicketsMetaView["categories"];
  readonly queues?: OperatorTicketsMetaView["queues"];
  readonly teams?: OperatorTicketsMetaView["teams"];
  readonly tags?: OperatorTicketsMetaView["tags"];
  readonly operators?: OperatorTicketsMetaView["operators"];
}): OperatorTicketsMetaView {
  return {
    categories: input.categories,
    queues: input.queues ?? [],
    teams: input.teams ?? [],
    tags: input.tags ?? [],
    operators: input.operators ?? [],
  };
}
