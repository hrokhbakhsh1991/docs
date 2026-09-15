import type { Ticket, TicketActorContext, TicketEvent, TicketMessage, TicketPriority, TicketStatus } from "../domain/types";

export type CreateTicketCommand = {
  readonly ticketId: string;
  readonly messageId: string;
  readonly eventId: string;
  readonly tenantId: string;
  readonly requesterUserId: string;
  readonly categoryCode: string;
  readonly subject: string;
  readonly body: string;
  readonly relatedTourId?: string | null;
  readonly relatedRegistrationId?: string | null;
  readonly priority?: TicketPriority;
  readonly actor: TicketActorContext;
  readonly nowIso: string;
};

export type AddPublicMessageCommand = {
  readonly messageId: string;
  readonly eventId: string;
  readonly ticket: Ticket;
  readonly body: string;
  readonly actor: TicketActorContext;
  readonly expectedRowVersion: number;
  readonly nowIso: string;
};

export type AddInternalNoteCommand = {
  readonly messageId: string;
  readonly eventId: string;
  readonly ticket: Ticket;
  readonly body: string;
  readonly actor: TicketActorContext;
  readonly expectedRowVersion: number;
  readonly nowIso: string;
};

export type ChangeTicketStatusCommand = {
  readonly eventId: string;
  readonly ticket: Ticket;
  readonly status: TicketStatus;
  readonly actor: TicketActorContext;
  readonly expectedRowVersion: number;
  readonly nowIso: string;
};

export type ChangeTicketPriorityCommand = {
  readonly eventId: string;
  readonly ticket: Ticket;
  readonly priority: TicketPriority;
  readonly actor: TicketActorContext;
  readonly expectedRowVersion: number;
  readonly nowIso: string;
};

export type AssignTicketCommand = {
  readonly eventId: string;
  readonly ticket: Ticket;
  readonly assigneeUserId: string | null;
  readonly actor: TicketActorContext;
  readonly expectedRowVersion: number;
  readonly nowIso: string;
};

export type ReopenTicketCommand = {
  readonly eventId: string;
  readonly optionalMessageId?: string;
  readonly optionalEventId?: string;
  readonly ticket: Ticket;
  readonly body?: string;
  readonly actor: TicketActorContext;
  readonly expectedRowVersion: number;
  readonly nowIso: string;
};

export type CloseTicketCommand = {
  readonly eventId: string;
  readonly ticket: Ticket;
  readonly actor: TicketActorContext;
  readonly expectedRowVersion: number;
  readonly nowIso: string;
};

export type TicketMutationOutcome = {
  readonly ticket: Ticket;
  readonly events: readonly TicketEvent[];
  readonly message?: TicketMessage;
};

export type IdempotencyFingerprintInput = {
  readonly scope: string;
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly idempotencyKey: string;
};
