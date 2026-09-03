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
  TicketAssignInput,
  TicketQueueChangeInput,
  TicketQueueCreateInput,
  TicketQueueUpdateInput,
  TicketTagCreateInput,
  TicketTagMutationInput,
  TicketTagUpdateInput,
  TicketTeamCreateInput,
  TicketTeamUpdateInput,
} from "@app-tour/ticketing-http-contracts";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type {
  TicketCategoryHttp,
  TicketQueueHttp,
  TicketTagHttp,
  TicketTeamHttp,
} from "./ticketing-projections";

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
  readonly listTicketCategories: (auth: TenantAuthContext) => Promise<readonly TicketCategoryHttp[]>;
  readonly listTags: (auth: TenantAuthContext) => Promise<readonly TicketTagHttp[]>;
  readonly createTag: (
    auth: TenantAuthContext,
    body: TicketTagCreateInput,
    idempotencyKey: string,
  ) => Promise<TicketTagHttp>;
  readonly updateTag: (
    auth: TenantAuthContext,
    code: string,
    body: TicketTagUpdateInput,
    idempotencyKey: string,
  ) => Promise<TicketTagHttp>;
  readonly listQueues: (auth: TenantAuthContext) => Promise<readonly TicketQueueHttp[]>;
  readonly createQueue: (
    auth: TenantAuthContext,
    body: TicketQueueCreateInput,
    idempotencyKey: string,
  ) => Promise<TicketQueueHttp>;
  readonly updateQueue: (
    auth: TenantAuthContext,
    code: string,
    body: TicketQueueUpdateInput,
    idempotencyKey: string,
  ) => Promise<TicketQueueHttp>;
  readonly listTeams: (auth: TenantAuthContext) => Promise<readonly TicketTeamHttp[]>;
  readonly createTeam: (
    auth: TenantAuthContext,
    body: TicketTeamCreateInput,
    idempotencyKey: string,
  ) => Promise<TicketTeamHttp>;
  readonly updateTeam: (
    auth: TenantAuthContext,
    code: string,
    body: TicketTeamUpdateInput,
    idempotencyKey: string,
  ) => Promise<TicketTeamHttp>;
  readonly assignTicket: (
    auth: TenantAuthContext,
    ticketId: string,
    body: TicketAssignInput,
    idempotencyKey: string,
  ) => Promise<OperatorTicketMutationHttpResponse>;
  readonly changeTicketQueue: (
    auth: TenantAuthContext,
    ticketId: string,
    body: TicketQueueChangeInput,
    idempotencyKey: string,
  ) => Promise<OperatorTicketMutationHttpResponse>;
  readonly addTicketTag: (
    auth: TenantAuthContext,
    ticketId: string,
    body: TicketTagMutationInput,
    idempotencyKey: string,
  ) => Promise<OperatorTicketMutationHttpResponse>;
  readonly removeTicketTag: (
    auth: TenantAuthContext,
    ticketId: string,
    tagCode: string,
    rowVersion: number,
    idempotencyKey: string,
  ) => Promise<OperatorTicketMutationHttpResponse>;
};
