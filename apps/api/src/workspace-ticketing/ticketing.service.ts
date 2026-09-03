import { randomUUID } from "node:crypto";

import {
  addInternalNote,
  addPublicMessage,
  assignTicket,
  canListTicket,
  canReadTicket,
  changeTicketPriority,
  changeTicketStatus,
  createTicket,
  reopenTicket,
  type TicketingResult,
} from "@app-tour/ticketing-core";
import type { TicketingServicePort } from "@app-tour/ticketing-http";
import { throwTicketingDomainError } from "@app-tour/ticketing-http";
import {
  toMemberListHttp,
  toMemberMessageHttp,
  toMemberTicketDetailHttp,
  toOperatorListHttp,
  toOperatorMessageHttp,
  toOperatorTicketDetailHttp,
} from "@app-tour/ticketing-http";
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

import {
  assertOperatorEndpointRole,
  buildTicketActorContext,
} from "./ticketing-actor-context";
import type { PrismaTicketingRepository } from "./infrastructure/prisma-ticketing.repository";
import type {
  PersistTicketMutationInput,
  TicketDetailRecord,
} from "./ticketing-repository.types";

function unwrap<T>(result: TicketingResult<T>): T {
  if (!result.ok) {
    throwTicketingDomainError(result.error);
  }
  return result.value;
}

function nowIso(): string {
  return new Date().toISOString();
}

function requireDetail(detail: TicketDetailRecord | null): TicketDetailRecord {
  if (detail === null) {
    throwTicketingDomainError({
      code: "TICKET_NOT_FOUND",
      message: "ticket not found",
    });
  }
  return detail;
}

function mapPersistenceError(error: unknown): never {
  if (error instanceof Error && error.message === "ROW_VERSION_CONFLICT") {
    throwTicketingDomainError({
      code: "ROW_VERSION_CONFLICT",
      message: "stale row version",
    });
  }
  throw error;
}

export type TicketingServiceDeps = {
  readonly repository: PrismaTicketingRepository;
};

export function createTicketingService(deps: TicketingServiceDeps): TicketingServicePort {
  const { repository } = deps;

  async function persistMutation(
    input: PersistTicketMutationInput,
  ): Promise<TicketDetailRecord> {
    try {
      return await repository.persistMutation(input);
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function addMessage(input: Parameters<PrismaTicketingRepository["addMessage"]>[0]) {
    try {
      return await repository.addMessage(input);
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function loadReadableTicket(
    auth: TenantAuthContext,
    ticketId: string,
    options?: { readonly operator?: boolean },
  ): Promise<TicketDetailRecord> {
    const actor = await buildTicketActorContext(auth, {
      loadTenantMembers: options?.operator === true || auth.role === "viewer",
    });
    const detail = requireDetail(await repository.findTicketById(auth.tenantId, ticketId));
    if (!canReadTicket(detail.ticket, actor)) {
      throwTicketingDomainError({
        code: "TICKET_NOT_FOUND",
        message: "ticket not found",
      });
    }
    return detail;
  }

  async function validateRelatedLinks(
    tenantId: string,
    input: MemberCreateTicketInput,
  ): Promise<
    readonly { entityType: "tour" | "registration"; entityId: string }[]
  > {
    const links: { entityType: "tour" | "registration"; entityId: string }[] = [];
    if (input.relatedTourId !== undefined) {
      const exists = await repository.existsTourInTenant(tenantId, input.relatedTourId);
      if (!exists) {
        throwTicketingDomainError({
          code: "TICKET_ACCESS_DENIED",
          message: "related tour not found",
          field: "relatedTourId",
        });
      }
      links.push({ entityType: "tour", entityId: input.relatedTourId });
    }
    if (input.relatedRegistrationId !== undefined) {
      const exists = await repository.existsRegistrationInTenant(
        tenantId,
        input.relatedRegistrationId,
      );
      if (!exists) {
        throwTicketingDomainError({
          code: "TICKET_ACCESS_DENIED",
          message: "related registration not found",
          field: "relatedRegistrationId",
        });
      }
      links.push({ entityType: "registration", entityId: input.relatedRegistrationId });
    }
    return links;
  }

  return {
    async listMemberTickets(auth, query: MemberTicketListQuery) {
      const actor = await buildTicketActorContext(auth, { loadTenantMembers: auth.role === "viewer" });
      if (!canListTicket(actor, auth.role === "viewer" ? "tenant" : "own")) {
        throwTicketingDomainError({
          code: "TICKET_ACCESS_DENIED",
          message: "cannot list tickets",
        });
      }
      const result = await repository.findMemberTickets({
        tenantId: auth.tenantId,
        limit: query.limit,
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(auth.role === "member" ? { requesterUserId: auth.userId } : {}),
      });
      return toMemberListHttp(result);
    },

    async createMemberTicket(auth, body, idempotencyKey) {
      const existing = await repository.findTicketByCreationIdempotencyKey(
        auth.tenantId,
        idempotencyKey,
      );
      if (existing !== null) {
        return { ticket: toMemberTicketDetailHttp(existing) };
      }
      const actor = await buildTicketActorContext(auth);
      const links = await validateRelatedLinks(auth.tenantId, body);
      const ticketId = randomUUID();
      const messageId = randomUUID();
      const eventId = randomUUID();
      const outcome = unwrap(
        createTicket({
          ticketId,
          messageId,
          eventId,
          tenantId: auth.tenantId,
          requesterUserId: auth.userId,
          categoryCode: body.categoryCode,
          subject: body.subject,
          body: body.body,
          relatedTourId: body.relatedTourId ?? null,
          relatedRegistrationId: body.relatedRegistrationId ?? null,
          actor,
          nowIso: nowIso(),
        }),
      );
      const detail = await repository.createTicket({
        ticket: outcome.ticket,
        message: outcome.message,
        events: outcome.events,
        creationIdempotencyKey: idempotencyKey,
        messageIdempotencyKey: `${idempotencyKey}:initial-message`,
        ...(links.length > 0 ? { links } : {}),
      });
      return { ticket: toMemberTicketDetailHttp(detail) };
    },

    async getMemberTicket(auth, ticketId) {
      const detail = await loadReadableTicket(auth, ticketId);
      return toMemberTicketDetailHttp(detail);
    },

    async addMemberMessage(auth, ticketId, body: MemberAddMessageInput, idempotencyKey) {
      const existing = await repository.findMessageByIdempotencyKey(
        auth.tenantId,
        ticketId,
        idempotencyKey,
      );
      if (existing !== null) {
        return { message: toMemberMessageHttp(existing) };
      }
      const detail = await loadReadableTicket(auth, ticketId);
      const actor = await buildTicketActorContext(auth);
      const outcome = unwrap(
        addPublicMessage({
          messageId: randomUUID(),
          eventId: randomUUID(),
          ticket: detail.ticket,
          body: body.body,
          actor,
          expectedRowVersion: detail.ticket.rowVersion,
          nowIso: nowIso(),
        }),
      );
      const persisted = await addMessage({
        ticket: outcome.ticket,
        message: outcome.message,
        events: outcome.events,
        messageIdempotencyKey: idempotencyKey,
      });
      const message = persisted.messages.at(-1);
      if (message === undefined || outcome.message === undefined) {
        throw new Error("TICKET_MESSAGE_PERSISTENCE_FAILED");
      }
      return { message: toMemberMessageHttp(message) };
    },

    async reopenMemberTicket(auth, ticketId, body: MemberReopenTicketInput, idempotencyKey) {
      void idempotencyKey;
      const detail = await loadReadableTicket(auth, ticketId);
      const actor = await buildTicketActorContext(auth);
      const messageId = body.body !== undefined ? randomUUID() : undefined;
      const outcome = unwrap(
        reopenTicket({
          eventId: randomUUID(),
          optionalMessageId: messageId,
          optionalEventId: messageId !== undefined ? randomUUID() : undefined,
          ticket: detail.ticket,
          ...(body.body !== undefined ? { body: body.body } : {}),
          actor,
          expectedRowVersion: detail.ticket.rowVersion,
          nowIso: nowIso(),
        }),
      );
      const persisted = await persistMutation({
        ticket: outcome.ticket,
        message: outcome.message,
        events: outcome.events,
      });
      return toMemberTicketDetailHttp(persisted);
    },

    async listOperatorTickets(auth, query: OperatorTicketListQuery) {
      assertOperatorEndpointRole(auth);
      const actor = await buildTicketActorContext(auth, { loadTenantMembers: true });
      if (!canListTicket(actor, "tenant")) {
        throwTicketingDomainError({
          code: "TICKET_ACCESS_DENIED",
          message: "cannot list tenant tickets",
        });
      }
      const result = await repository.findOperatorTickets({
        tenantId: auth.tenantId,
        limit: query.limit,
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.priority !== undefined ? { priority: query.priority } : {}),
        ...(query.categoryCode !== undefined ? { categoryCode: query.categoryCode } : {}),
        ...(query.assigneeUserId !== undefined ? { assigneeUserId: query.assigneeUserId } : {}),
        ...(query.unassigned === true ? { unassigned: true } : {}),
        ...(query.q !== undefined ? { q: query.q } : {}),
      });
      return toOperatorListHttp(result);
    },

    async getOperatorTicket(auth, ticketId) {
      assertOperatorEndpointRole(auth);
      const detail = await loadReadableTicket(auth, ticketId, { operator: true });
      return toOperatorTicketDetailHttp(detail);
    },

    async operatorReply(auth, ticketId, body: OperatorReplyInput, idempotencyKey) {
      assertOperatorEndpointRole(auth);
      const existing = await repository.findMessageByIdempotencyKey(
        auth.tenantId,
        ticketId,
        idempotencyKey,
      );
      if (existing !== null) {
        return { message: toOperatorMessageHttp(existing) };
      }
      const detail = await loadReadableTicket(auth, ticketId, { operator: true });
      const actor = await buildTicketActorContext(auth, { loadTenantMembers: true });
      const outcome = unwrap(
        addPublicMessage({
          messageId: randomUUID(),
          eventId: randomUUID(),
          ticket: detail.ticket,
          body: body.body,
          actor,
          expectedRowVersion: detail.ticket.rowVersion,
          nowIso: nowIso(),
        }),
      );
      const persisted = await addMessage({
        ticket: outcome.ticket,
        message: outcome.message,
        events: outcome.events,
        messageIdempotencyKey: idempotencyKey,
      });
      const message = persisted.messages.at(-1);
      if (message === undefined) {
        throw new Error("TICKET_MESSAGE_PERSISTENCE_FAILED");
      }
      return { message: toOperatorMessageHttp(message) };
    },

    async operatorInternalNote(
      auth,
      ticketId,
      body: OperatorInternalNoteInput,
      idempotencyKey,
    ) {
      assertOperatorEndpointRole(auth);
      const existing = await repository.findMessageByIdempotencyKey(
        auth.tenantId,
        ticketId,
        idempotencyKey,
      );
      if (existing !== null) {
        return { message: toOperatorMessageHttp(existing) };
      }
      const detail = await loadReadableTicket(auth, ticketId, { operator: true });
      const actor = await buildTicketActorContext(auth, { loadTenantMembers: true });
      const outcome = unwrap(
        addInternalNote({
          messageId: randomUUID(),
          eventId: randomUUID(),
          ticket: detail.ticket,
          body: body.body,
          actor,
          expectedRowVersion: detail.ticket.rowVersion,
          nowIso: nowIso(),
        }),
      );
      const persisted = await addMessage({
        ticket: outcome.ticket,
        message: outcome.message,
        events: outcome.events,
        messageIdempotencyKey: idempotencyKey,
      });
      const message = persisted.messages.at(-1);
      if (message === undefined) {
        throw new Error("TICKET_MESSAGE_PERSISTENCE_FAILED");
      }
      return { message: toOperatorMessageHttp(message) };
    },

    async patchOperatorTicket(auth, ticketId, body: OperatorTicketPatchInput, idempotencyKey) {
      void idempotencyKey;
      assertOperatorEndpointRole(auth);
      let detail = await loadReadableTicket(auth, ticketId, { operator: true });
      let actor = await buildTicketActorContext(auth, { loadTenantMembers: true });
      let ticket = detail.ticket;
      let expectedRowVersion = body.rowVersion;

      if (body.status !== undefined) {
        const outcome = unwrap(
          changeTicketStatus({
            eventId: randomUUID(),
            ticket,
            status: body.status,
            actor,
            expectedRowVersion,
            nowIso: nowIso(),
          }),
        );
        detail = await persistMutation({ ticket: outcome.ticket, events: outcome.events });
        ticket = detail.ticket;
        expectedRowVersion = ticket.rowVersion;
      }

      if (body.priority !== undefined) {
        const outcome = unwrap(
          changeTicketPriority({
            eventId: randomUUID(),
            ticket,
            priority: body.priority,
            actor,
            expectedRowVersion,
            nowIso: nowIso(),
          }),
        );
        detail = await persistMutation({ ticket: outcome.ticket, events: outcome.events });
        ticket = detail.ticket;
        expectedRowVersion = ticket.rowVersion;
      }

      if (body.assigneeUserId !== undefined) {
        actor = await buildTicketActorContext(auth, { loadTenantMembers: true });
        const outcome = unwrap(
          assignTicket({
            eventId: randomUUID(),
            ticket,
            assigneeUserId: body.assigneeUserId,
            actor,
            expectedRowVersion,
            nowIso: nowIso(),
          }),
        );
        detail = await persistMutation({ ticket: outcome.ticket, events: outcome.events });
      }

      return { ticket: toOperatorTicketDetailHttp(detail) };
    },

    async reopenOperatorTicket(auth, ticketId, body: MemberReopenTicketInput, idempotencyKey) {
      void idempotencyKey;
      assertOperatorEndpointRole(auth);
      const detail = await loadReadableTicket(auth, ticketId, { operator: true });
      const actor = await buildTicketActorContext(auth, { loadTenantMembers: true });
      const messageId = body.body !== undefined ? randomUUID() : undefined;
      const outcome = unwrap(
        reopenTicket({
          eventId: randomUUID(),
          optionalMessageId: messageId,
          optionalEventId: messageId !== undefined ? randomUUID() : undefined,
          ticket: detail.ticket,
          ...(body.body !== undefined ? { body: body.body } : {}),
          actor,
          expectedRowVersion: detail.ticket.rowVersion,
          nowIso: nowIso(),
        }),
      );
      const persisted = await persistMutation({
        ticket: outcome.ticket,
        message: outcome.message,
        events: outcome.events,
      });
      return { ticket: toOperatorTicketDetailHttp(persisted) };
    },
  };
}
