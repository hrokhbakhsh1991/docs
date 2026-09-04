/**
 * TKT-F1 — member tickets BFF view builders.
 */
import type {
  MemberTicketDetailHttp,
  MemberTicketListItemHttp,
  PaginatedMemberTicketListHttp,
  TicketAttachmentHttp,
  TicketLinkHttp,
  ViewerTicketDetailHttp,
} from "@app-tour/ticketing-http-contracts";

import {
  formatMemberTicketDateTime,
  ticketCategoryLabelKey,
  ticketPriorityLabelKey,
  ticketStatusIcon,
  ticketStatusLabelKey,
} from "./member-tickets-format";

export type MemberTicketListItemView = MemberTicketListItemHttp & {
  readonly lastActivityLabel: string;
  readonly statusLabelKey: string;
  readonly priorityLabelKey: string;
  readonly categoryLabelKey: string;
  readonly statusIcon: string;
};

export type MemberTicketListView = {
  readonly items: readonly MemberTicketListItemView[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export type MemberTicketAttachmentView = TicketAttachmentHttp & {
  readonly uploadedAtLabel: string | null;
};

export type MemberTicketMessageView = {
  readonly id: string;
  readonly ticketId: string;
  readonly authorUserId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly createdAtLabel: string;
  readonly isMemberAuthor: boolean;
  readonly visibility?: "public" | "internal";
  readonly attachments: readonly MemberTicketAttachmentView[];
};

export type MemberTicketDetailView = {
  readonly ticket: MemberTicketListItemView;
  readonly messages: readonly MemberTicketMessageView[];
  readonly links: readonly TicketLinkHttp[];
  readonly rowVersion: number;
  readonly readOnly: boolean;
};

export type MemberTicketCategoriesView = {
  readonly defaultCategoryCode: string;
  readonly maxAttachmentSizeBytes: number;
  readonly attachmentsEnabled: boolean;
  readonly categories: readonly {
    readonly code: string;
    readonly labelKey: string;
    readonly sortOrder: number;
    readonly defaultPriority?: string;
  }[];
};

export type MemberTicketsBffPayload = {
  readonly ok: true;
  readonly list: MemberTicketListView;
};

export type MemberTicketDetailBffPayload = {
  readonly ok: true;
  readonly detail: MemberTicketDetailView;
};

export type MemberTicketCategoriesBffPayload = {
  readonly ok: true;
  readonly categories: MemberTicketCategoriesView;
};

export type MemberTicketsBffError = {
  readonly ok: false;
  readonly code: string;
  readonly status: number;
  readonly message?: string;
};

function mapListItem(
  item: MemberTicketListItemHttp,
  locale: string,
): MemberTicketListItemView {
  return {
    ...item,
    lastActivityLabel: formatMemberTicketDateTime(item.lastActivityAt, locale),
    statusLabelKey: ticketStatusLabelKey(item.status),
    priorityLabelKey: ticketPriorityLabelKey(item.priority),
    categoryLabelKey: ticketCategoryLabelKey(item.categoryCode),
    statusIcon: ticketStatusIcon(item.status),
  };
}

export function buildMemberTicketCategoriesBffPayload(
  categories: MemberTicketCategoriesView,
): MemberTicketCategoriesBffPayload {
  return { ok: true, categories };
}

export function buildMemberTicketListView(
  page: PaginatedMemberTicketListHttp,
  locale: string,
): MemberTicketListView {
  return {
    items: page.items.map((item) => mapListItem(item, locale)),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export function buildMemberTicketDetailView(
  detail: MemberTicketDetailHttp | ViewerTicketDetailHttp,
  locale: string,
  memberUserId: string,
  options?: { readonly readOnly?: boolean },
): MemberTicketDetailView {
  const readOnly = options?.readOnly === true;
  const ticket = mapListItem(
    {
      ...detail.ticket,
      publicMessageCount: detail.messages.filter(
        (message) => ("visibility" in message ? message.visibility === "public" : true),
      ).length,
    },
    locale,
  );
  return {
    ticket,
    rowVersion: detail.rowVersion,
    links: detail.links ?? [],
    readOnly,
    messages: detail.messages.map((message) => ({
      id: message.id,
      ticketId: message.ticketId,
      authorUserId: message.authorUserId,
      body: message.body,
      createdAt: message.createdAt,
      createdAtLabel: formatMemberTicketDateTime(message.createdAt, locale),
      isMemberAuthor: message.authorUserId === memberUserId,
      ...("visibility" in message && message.visibility !== undefined
        ? { visibility: message.visibility }
        : {}),
      attachments: (message.attachments ?? []).map((attachment) => ({
        ...attachment,
        uploadedAtLabel:
          attachment.uploadedAt !== null
            ? formatMemberTicketDateTime(attachment.uploadedAt, locale)
            : null,
      })),
    })),
  };
}
