/**
 * Ticketing domain literals — canonical source of truth (TKT-001 Phase 2).
 *
 * Type alignment: `@app-tour/ticketing-http-contracts` mirrors these literals for HTTP
 * transport. Core must not import http-contracts (import boundary).
 */

export const TICKET_STATUSES = [
  "open",
  "pending_member",
  "resolved",
  "closed",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_MESSAGE_VISIBILITIES = ["public", "internal"] as const;

export type TicketMessageVisibility = (typeof TICKET_MESSAGE_VISIBILITIES)[number];

/** Authorization / actor context roles (not persisted on TicketMessage). */
export const TICKET_ACTOR_ROLES = [
  "member",
  "viewer",
  "admin",
  "owner",
  "platform_admin",
] as const;

export type TicketActorRole = (typeof TICKET_ACTOR_ROLES)[number];

/** Write-time author classification for messages (authorization only). */
export const TICKET_AUTHOR_ROLES = ["member", "operator", "system"] as const;

export type TicketAuthorRole = (typeof TICKET_AUTHOR_ROLES)[number];

/** Lifecycle transition actors (subset of authorization roles). */
export const TICKET_TRANSITION_ACTORS = ["member", "operator", "owner", "system"] as const;

export type TicketTransitionActor = (typeof TICKET_TRANSITION_ACTORS)[number];

export type TicketCategoryCode = string;

export const DEFAULT_TICKET_PRIORITY: TicketPriority = "normal";

export const TICKET_SUBJECT_MIN_LENGTH = 3;
export const TICKET_SUBJECT_MAX_LENGTH = 200;
export const TICKET_BODY_MIN_LENGTH = 1;
export const TICKET_BODY_MAX_LENGTH = 10_000;
export const TICKET_CATEGORY_CODE_MIN_LENGTH = 2;
export const TICKET_CATEGORY_CODE_MAX_LENGTH = 64;

export type Ticket = {
  readonly id: string;
  readonly tenantId: string;
  readonly requesterUserId: string;
  readonly assigneeUserId: string | null;
  readonly assigneeTeamId: string | null;
  readonly queueId: string | null;
  readonly categoryCode: TicketCategoryCode;
  readonly subject: string;
  readonly priority: TicketPriority;
  readonly status: TicketStatus;
  readonly relatedTourId: string | null;
  readonly relatedRegistrationId: string | null;
  readonly rowVersion: number;
  readonly lastActivityAt: string;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Extensibility — not persisted in MVP. */
  readonly tags?: readonly string[];
  /** Extensibility — queue routing; not persisted in MVP. */
  readonly queueCode?: string | null;
};

export type TicketMessage = {
  readonly id: string;
  readonly tenantId: string;
  readonly ticketId: string;
  readonly authorUserId: string;
  readonly visibility: TicketMessageVisibility;
  readonly body: string;
  readonly createdAt: string;
};

export const TICKET_EVENT_TYPES = [
  "ticket.created",
  "ticket.message.created",
  "ticket.internal_note.created",
  "ticket.status.changed",
  "ticket.priority.changed",
  "ticket.assigned",
  "ticket.team.assigned",
  "ticket.queue.changed",
  "ticket.tag.added",
  "ticket.tag.removed",
  "ticket.category.changed",
  "ticket.reopened",
  "ticket.closed",
] as const;

export type TicketEventType = (typeof TICKET_EVENT_TYPES)[number];

export type TicketEvent = {
  readonly id: string;
  readonly tenantId: string;
  readonly ticketId: string;
  readonly eventType: TicketEventType;
  readonly actorUserId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

export type TicketTransition = {
  readonly from: TicketStatus;
  readonly to: TicketStatus;
  readonly actors: readonly TicketTransitionActor[];
};

export type TicketActorContext = {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: TicketActorRole;
  /** When false, all mutations fail closed. */
  readonly workspaceTicketingEnabled?: boolean;
  /** Impersonation / read-only operator context. */
  readonly readOnly?: boolean;
  /** Tenant member user ids for assignee validation (adapter-provided). */
  readonly tenantMemberUserIds?: readonly string[];
};

export type TicketPermission =
  | "read"
  | "list"
  | "create"
  | "reply"
  | "internal_note"
  | "change_status"
  | "change_priority"
  | "assign"
  | "reopen"
  | "close"
  | "archive";

export type TicketCommandResult<T> = {
  readonly ticket: Ticket;
  readonly events: readonly TicketEvent[];
  readonly message?: TicketMessage;
  readonly value?: T;
};
