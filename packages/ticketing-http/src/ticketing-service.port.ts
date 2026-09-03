import type {
  MemberAddMessageHttpResponse,
  MemberCreateTicketHttpResponse,
  MemberTicketDetailHttp,
  OperatorMessageHttpResponse,
  OperatorTicketDetailHttp,
  OperatorTicketMutationHttpResponse,
  PaginatedMemberTicketListHttp,
  PaginatedOperatorTicketListHttp,
} from "@app-tour/ticketing-http-contracts";
import type {
  MemberAddMessageInput,
  MemberCreateTicketInput,
  MemberReopenTicketInput,
  MemberTicketListQuery,
  OperatorInternalNoteInput,
  OperatorReplyInput,
  OperatorTicketListQuery,
  OperatorTicketPatchInput,
} from "@app-tour/ticketing-http-contracts";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

export type TicketingServicePort = {
  readonly listMemberTickets: (
    auth: TenantAuthContext,
    query: MemberTicketListQuery,
  ) => Promise<PaginatedMemberTicketListHttp>;
  readonly createMemberTicket: (
    auth: TenantAuthContext,
    body: MemberCreateTicketInput,
    idempotencyKey: string,
  ) => Promise<MemberCreateTicketHttpResponse>;
  readonly getMemberTicket: (
    auth: TenantAuthContext,
    ticketId: string,
  ) => Promise<MemberTicketDetailHttp>;
  readonly addMemberMessage: (
    auth: TenantAuthContext,
    ticketId: string,
    body: MemberAddMessageInput,
    idempotencyKey: string,
  ) => Promise<MemberAddMessageHttpResponse>;
  readonly reopenMemberTicket: (
    auth: TenantAuthContext,
    ticketId: string,
    body: MemberReopenTicketInput,
    idempotencyKey: string,
  ) => Promise<MemberTicketDetailHttp>;
  readonly listOperatorTickets: (
    auth: TenantAuthContext,
    query: OperatorTicketListQuery,
  ) => Promise<PaginatedOperatorTicketListHttp>;
  readonly getOperatorTicket: (
    auth: TenantAuthContext,
    ticketId: string,
  ) => Promise<OperatorTicketDetailHttp>;
  readonly operatorReply: (
    auth: TenantAuthContext,
    ticketId: string,
    body: OperatorReplyInput,
    idempotencyKey: string,
  ) => Promise<OperatorMessageHttpResponse>;
  readonly operatorInternalNote: (
    auth: TenantAuthContext,
    ticketId: string,
    body: OperatorInternalNoteInput,
    idempotencyKey: string,
  ) => Promise<OperatorMessageHttpResponse>;
  readonly patchOperatorTicket: (
    auth: TenantAuthContext,
    ticketId: string,
    body: OperatorTicketPatchInput,
    idempotencyKey: string,
  ) => Promise<OperatorTicketMutationHttpResponse>;
  readonly reopenOperatorTicket: (
    auth: TenantAuthContext,
    ticketId: string,
    body: MemberReopenTicketInput,
    idempotencyKey: string,
  ) => Promise<OperatorTicketMutationHttpResponse>;
};
