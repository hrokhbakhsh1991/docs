/**
 * Ticketing HTTP enums — TKT-001 Phase 1.
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

export const TICKET_LIST_SORTS = ["lastActivityAt"] as const;

export type TicketListSort = (typeof TICKET_LIST_SORTS)[number];

export const DEFAULT_TICKET_LIST_LIMIT = 20;
export const MAX_TICKET_LIST_LIMIT = 50;

export const TICKET_SUBJECT_MIN_LENGTH = 3;
export const TICKET_SUBJECT_MAX_LENGTH = 200;
export const TICKET_BODY_MIN_LENGTH = 1;
export const TICKET_BODY_MAX_LENGTH = 10_000;

export const TICKET_CATEGORY_CODE_MIN_LENGTH = 2;
export const TICKET_CATEGORY_CODE_MAX_LENGTH = 64;
