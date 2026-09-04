import type {
  TicketEventHttp,
  TicketLinkHttp,
  TicketMessageVisibility,
  TicketPriority,
  TicketStatus,
} from "@app-tour/ticketing-http-contracts";

export const OPERATOR_TICKETS_LIST_PAGE_SIZE = 25;

export const OPERATOR_TICKETS_TEST_IDS = {
  shell: "operator-tickets-shell",
  inbox: "operator-tickets-inbox",
  inboxRow: "operator-tickets-inbox-row",
  detail: "operator-tickets-detail",
  composer: "operator-tickets-composer",
  filterStatus: "operator-tickets-filter-status",
  filterPriority: "operator-tickets-filter-priority",
  filterCategory: "operator-tickets-filter-category",
  filterSearch: "operator-tickets-filter-search",
  loadMore: "operator-tickets-load-more",
  mutationNotice: "operator-tickets-mutation-notice",
  mobileSheet: "operator-tickets-mobile-sheet",
} as const;

export const TICKET_STATUS_FILTER_OPTIONS = [
  "all",
  "open",
  "pending_member",
  "resolved",
  "closed",
] as const;

export type TicketStatusFilter = (typeof TICKET_STATUS_FILTER_OPTIONS)[number];

export const TICKET_PRIORITY_FILTER_OPTIONS = [
  "all",
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export type TicketPriorityFilter = (typeof TICKET_PRIORITY_FILTER_OPTIONS)[number];

export type OperatorTicketsCommandCenterQuery = {
  readonly status: TicketStatusFilter;
  readonly priority: TicketPriorityFilter;
  readonly categoryCode: string;
  readonly queueCode: string;
  readonly teamId: string;
  readonly assigneeUserId: string;
  readonly unassigned: boolean;
  readonly tagCode: string;
  readonly search: string;
  readonly ticketId: string;
  readonly listCursor: string;
};

export const DEFAULT_OPERATOR_TICKETS_QUERY: OperatorTicketsCommandCenterQuery = {
  status: "all",
  priority: "all",
  categoryCode: "",
  queueCode: "",
  teamId: "",
  assigneeUserId: "",
  unassigned: false,
  tagCode: "",
  search: "",
  ticketId: "",
  listCursor: "",
};

export type OperatorTicketListItemView = {
  readonly id: string;
  readonly ticketCode: string;
  readonly subject: string;
  readonly requesterUserId: string;
  readonly requesterLabel: string;
  readonly categoryCode: string;
  readonly categoryLabelKey: string;
  readonly priority: TicketPriority;
  readonly priorityLabelKey: string;
  readonly status: TicketStatus;
  readonly statusLabelKey: string;
  readonly statusIcon: string;
  readonly assigneeUserId: string | null;
  readonly assigneeLabel: string | null;
  readonly lastActivityAt: string;
  readonly lastActivityLabel: string;
  readonly hasInternalNotes: boolean;
  readonly hasAttachments: boolean;
  readonly tagCodes: readonly string[];
};

export type OperatorTicketListView = {
  readonly items: readonly OperatorTicketListItemView[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export type OperatorTicketMessageView = {
  readonly id: string;
  readonly ticketId: string;
  readonly authorUserId: string;
  readonly authorLabel: string;
  readonly body: string;
  readonly visibility: TicketMessageVisibility;
  readonly createdAt: string;
  readonly createdAtLabel: string;
  readonly attachments: readonly {
    readonly id: string;
    readonly originalFileName: string;
    readonly contentType: string;
    readonly sizeBytes: number;
    readonly uploadedAtLabel: string | null;
  }[];
};

export type OperatorTicketEventView = {
  readonly id: string;
  readonly eventType: string;
  readonly actorUserId: string | null;
  readonly actorLabel: string | null;
  readonly createdAt: string;
  readonly createdAtLabel: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type OperatorTicketDetailView = {
  readonly ticket: OperatorTicketListItemView;
  readonly messages: readonly OperatorTicketMessageView[];
  readonly events: readonly OperatorTicketEventView[];
  readonly links: readonly TicketLinkHttp[];
  readonly rowVersion: number;
  readonly queueCode: string | null;
  readonly assigneeTeamId: string | null;
};

export type OperatorTicketsMetaView = {
  readonly categories: readonly {
    readonly code: string;
    readonly labelKey: string;
    readonly sortOrder: number;
  }[];
  readonly queues: readonly { readonly code: string; readonly name: string }[];
  readonly teams: readonly { readonly code: string; readonly name: string }[];
  readonly tags: readonly { readonly code: string; readonly label: string }[];
  readonly operators: readonly { readonly userId: string; readonly label: string }[];
};

export function isAdminOrOwnerRole(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function canMutateTickets(role: string): boolean {
  return isAdminOrOwnerRole(role);
}

export function canAccessTicketsInbox(role: string): boolean {
  return role === "owner" || role === "admin" || role === "viewer";
}

export type OperatorTicketLinkHttp = TicketLinkHttp;
export type OperatorTicketEventHttp = TicketEventHttp;
