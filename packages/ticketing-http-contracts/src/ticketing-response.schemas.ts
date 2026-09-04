/**
 * Ticketing HTTP response read models — TKT-001 Phase 1.
 */
import type { TicketMessageVisibility, TicketPriority, TicketStatus } from "./ticketing-enums";

export type TicketSummaryHttp = {
  readonly id: string;
  readonly ticketCode: string;
  readonly subject: string;
  readonly categoryCode: string;
  readonly priority: TicketPriority;
  readonly status: TicketStatus;
  readonly assigneeUserId: string | null;
  readonly lastActivityAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** Member list row — includes public message count for portal list UI. */
export type MemberTicketListItemHttp = TicketSummaryHttp & {
  readonly publicMessageCount: number;
};

/** Operator list item — includes requester for triage. */
export type OperatorTicketSummaryHttp = TicketSummaryHttp & {
  readonly requesterUserId: string;
};

/** Member-safe message — no visibility field (always public). */
export type MemberTicketMessageHttp = {
  readonly id: string;
  readonly ticketId: string;
  readonly authorUserId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly attachments?: readonly import("./ticketing-attachment.schemas").TicketAttachmentHttp[];
};

/** Operator message — includes visibility for internal/public separation. */
export type OperatorTicketMessageHttp = MemberTicketMessageHttp & {
  readonly visibility: TicketMessageVisibility;
};

export type TicketEventHttp = {
  readonly id: string;
  readonly ticketId: string;
  readonly eventType: string;
  readonly actorUserId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

export type MemberTicketDetailHttp = {
  readonly ticket: TicketSummaryHttp;
  readonly messages: readonly MemberTicketMessageHttp[];
  readonly events: readonly TicketEventHttp[];
  readonly links?: readonly import("./ticketing-link.schemas").TicketLinkHttp[];
  readonly rowVersion: number;
};

export type OperatorTicketDetailHttp = {
  readonly ticket: OperatorTicketSummaryHttp;
  readonly messages: readonly OperatorTicketMessageHttp[];
  readonly events: readonly TicketEventHttp[];
  readonly links?: readonly import("./ticketing-link.schemas").TicketLinkHttp[];
  readonly rowVersion: number;
  readonly sla?: Readonly<Record<string, unknown>>;
};

export type PaginatedMemberTicketListHttp = {
  readonly items: readonly MemberTicketListItemHttp[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export type PaginatedOperatorTicketListHttp = {
  readonly items: readonly OperatorTicketSummaryHttp[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export type MemberCreateTicketHttpResponse = {
  readonly ticket: MemberTicketDetailHttp;
};

export type MemberAddMessageHttpResponse = {
  readonly message: MemberTicketMessageHttp;
};

export type OperatorTicketMutationHttpResponse = {
  readonly ticket: OperatorTicketDetailHttp;
};

export type OperatorMessageHttpResponse = {
  readonly message: OperatorTicketMessageHttp;
};
