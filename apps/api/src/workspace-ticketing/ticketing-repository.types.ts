import type { Ticket, TicketEvent, TicketMessage, TicketAttachment, TicketLink } from "@app-tour/ticketing-core";

export type TicketDetailRecord = {
  readonly ticket: Ticket;
  readonly messages: readonly TicketMessage[];
  readonly events: readonly TicketEvent[];
  readonly attachments?: readonly TicketAttachment[];
  readonly links?: readonly TicketLink[];
};

export type TicketListResult = {
  readonly items: readonly Ticket[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

export type PersistTicketMutationInput = {
  readonly ticket: Ticket;
  readonly events: readonly TicketEvent[];
  readonly message?: TicketMessage;
  readonly links?: readonly {
    readonly entityType: "tour" | "registration" | "payment" | "wallet";
    readonly entityId: string;
  }[];
};

export type CreateTicketPersistInput = PersistTicketMutationInput & {
  readonly creationIdempotencyKey: string;
  readonly messageIdempotencyKey?: string;
};

export type AddMessagePersistInput = PersistTicketMutationInput & {
  readonly messageIdempotencyKey: string;
};

export type MemberTicketListQuery = {
  readonly tenantId: string;
  readonly requesterUserId?: string;
  readonly status?: string;
  readonly cursor?: string;
  readonly limit: number;
};

export type OperatorTicketListQuery = {
  readonly tenantId: string;
  readonly status?: string;
  readonly priority?: string;
  readonly categoryCode?: string;
  readonly assigneeUserId?: string;
  readonly assigneeTeamId?: string;
  readonly queueCode?: string;
  readonly tagCode?: string;
  readonly teamId?: string;
  readonly unassigned?: boolean;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit: number;
};

export type TicketingRepositoryPort = {
  readonly findTicketById: (
    tenantId: string,
    ticketId: string,
  ) => Promise<TicketDetailRecord | null>;
  readonly findMemberTickets: (query: MemberTicketListQuery) => Promise<TicketListResult>;
  readonly findOperatorTickets: (query: OperatorTicketListQuery) => Promise<TicketListResult>;
  readonly findTicketByCreationIdempotencyKey: (
    tenantId: string,
    idempotencyKey: string,
  ) => Promise<TicketDetailRecord | null>;
  readonly findMessageByIdempotencyKey: (
    tenantId: string,
    ticketId: string,
    idempotencyKey: string,
  ) => Promise<TicketMessage | null>;
  readonly createTicket: (input: CreateTicketPersistInput) => Promise<TicketDetailRecord>;
  readonly persistMutation: (input: PersistTicketMutationInput) => Promise<TicketDetailRecord>;
  readonly addMessage: (input: AddMessagePersistInput) => Promise<TicketDetailRecord>;
  readonly isAssigneeInTenant: (tenantId: string, assigneeUserId: string) => Promise<boolean>;
  readonly listActiveTenantMemberUserIds: (tenantId: string) => Promise<readonly string[]>;
  readonly existsTourInTenant: (tenantId: string, tourId: string) => Promise<boolean>;
  readonly existsRegistrationInTenant: (
    tenantId: string,
    registrationId: string,
  ) => Promise<boolean>;
};
