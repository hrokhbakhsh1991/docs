import { randomUUID } from "node:crypto";

import {
  addInternalNote,
  addPublicMessage,
  assignTicket,
  buildTicketEvent,
  bumpTicketActivity,
  canListTicket,
  canReadTicket,
  changeTicketPriority,
  changeTicketStatus,
  createTicket,
  reopenTicket,
  withIncrementedRowVersion,
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

import {
  assertOperatorEndpointRole,
  buildTicketActorContext,
} from "./ticketing-actor-context";
import type { PrismaTicketingRepository } from "./infrastructure/prisma-ticketing.repository";
import type { TicketingOperationalRepository } from "./infrastructure/ticketing-operational.repository";
import type { TicketingCapabilityPort } from "./infrastructure/host-ticketing-capability.adapter";
import { createTicketingAttachmentRepository } from "./infrastructure/ticketing-attachment.repository";
import type { TicketingAttachmentRepository } from "./infrastructure/ticketing-attachment.repository";
import {
  createTicketingEntityValidationRepository,
  createTicketingLinkRepository,
} from "./infrastructure/ticketing-link.repository";
import type {
  TicketingEntityValidationRepository,
  TicketingLinkRepository,
} from "./infrastructure/ticketing-link.repository";
import { createTicketingE1Operations } from "./ticketing-e1.operations";
import { loadOperatorTicketSlaHttp, syncTicketSlaAfterChange } from "./ticketing-sla-sync";
import { getTicketSlaState, toTicketSlaStateHttp } from "./ticket-sla.repository";
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
  if (error instanceof Error) {
    if (error.message === "ROW_VERSION_CONFLICT") {
      throwTicketingDomainError({
        code: "ROW_VERSION_CONFLICT",
        message: "stale row version",
      });
    }
    if (error.message === "DUPLICATE_TAG") {
      throwTicketingDomainError({
        code: "DUPLICATE_TAG",
        message: "tag code already exists",
        field: "code",
      });
    }
    if (error.message === "TAG_NOT_FOUND") {
      throwTicketingDomainError({
        code: "TAG_NOT_FOUND",
        message: "tag not found",
      });
    }
    if (error.message === "QUEUE_NOT_FOUND") {
      throwTicketingDomainError({
        code: "QUEUE_NOT_FOUND",
        message: "queue not found",
      });
    }
    if (error.message === "TEAM_NOT_FOUND") {
      throwTicketingDomainError({
        code: "TEAM_NOT_FOUND",
        message: "team not found",
      });
    }
  }
  throw error;
}

function assertAdminRole(auth: TenantAuthContext): void {
  if (auth.role !== "admin" && auth.role !== "owner") {
    throwTicketingDomainError({
      code: "TICKET_ACCESS_DENIED",
      message: "admin or owner role required",
    });
  }
}

export type TicketingServiceDeps = {
  readonly repository: PrismaTicketingRepository;
  readonly operationalRepository: TicketingOperationalRepository;
  readonly capability: TicketingCapabilityPort;
  readonly attachmentRepository?: TicketingAttachmentRepository;
  readonly linkRepository?: TicketingLinkRepository;
  readonly entityRepository?: TicketingEntityValidationRepository;
};

export function createTicketingService(deps: TicketingServiceDeps): TicketingServicePort {
  const {
    repository,
    operationalRepository,
    capability,
    attachmentRepository = createTicketingAttachmentRepository(),
    linkRepository = createTicketingLinkRepository(),
    entityRepository = createTicketingEntityValidationRepository(),
  } = deps;

  async function resolveWorkspaceCapabilities(tenantId: string) {
    const gate = await capability.assertEnabled(tenantId);
    return gate.capabilities;
  }

  function assertCategoryAllowed(
    categoryCode: string,
    allowedCategories: readonly { readonly code: string }[],
  ): void {
    const normalized = categoryCode.trim();
    if (!allowedCategories.some((entry) => entry.code === normalized)) {
      throwTicketingDomainError({
        code: "INVALID_CATEGORY_CODE",
        message: "categoryCode is not enabled for this workspace",
        field: "categoryCode",
      });
    }
  }

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

  async function enrichDetail(detail: TicketDetailRecord): Promise<TicketDetailRecord> {
    const [attachments, links] = await Promise.all([
      attachmentRepository.listByTicket(detail.ticket.tenantId, detail.ticket.id),
      linkRepository.listByTicket(detail.ticket.tenantId, detail.ticket.id),
    ]);
    return { ...detail, attachments, links };
  }

  async function syncSla(
    ticket: TicketDetailRecord["ticket"],
    options?: {
      readonly isMemberPublicMessage?: boolean;
      readonly isOperatorPublicReply?: boolean;
    },
  ): Promise<void> {
    await syncTicketSlaAfterChange(ticket.tenantId, ticket, options);
  }

  async function toOperatorDetailHttp(detail: TicketDetailRecord) {
    const sla =
      (await loadOperatorTicketSlaHttp(detail.ticket.tenantId, detail.ticket.id)) ??
      (await getTicketSlaState(detail.ticket.tenantId, detail.ticket.id).then((state) =>
        state === null ? undefined : toTicketSlaStateHttp(state),
      ));
    return toOperatorTicketDetailHttp({ ...detail, ...(sla !== undefined ? { sla } : {}) });
  }

  const e1 = createTicketingE1Operations({
    repository,
    attachmentRepository,
    linkRepository,
    entityRepository,
    capability,
    loadReadableTicket,
    loadTicketRow: (tenantId, ticketId) => repository.findTicketRowById(tenantId, ticketId),
  });

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
      const capabilities = await resolveWorkspaceCapabilities(auth.tenantId);
      assertCategoryAllowed(body.categoryCode, capabilities.categories);
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
      await syncSla(detail.ticket, { isMemberPublicMessage: true });
      return { ticket: toMemberTicketDetailHttp(detail) };
    },

    async getMemberTicket(auth, ticketId) {
      const detail = await enrichDetail(await loadReadableTicket(auth, ticketId));
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
      await syncSla(persisted.ticket, { isMemberPublicMessage: true });
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
      await syncSla(persisted.ticket);
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
        ...(query.assigneeTeamId !== undefined ? { assigneeTeamId: query.assigneeTeamId } : {}),
        ...(query.queueCode !== undefined ? { queueCode: query.queueCode } : {}),
        ...(query.tagCode !== undefined ? { tagCode: query.tagCode } : {}),
        ...(query.teamId !== undefined ? { teamId: query.teamId } : {}),
        ...(query.unassigned === true ? { unassigned: true } : {}),
        ...(query.q !== undefined ? { q: query.q } : {}),
        ...(query.sort !== undefined ? { sort: query.sort } : {}),
      });
      return toOperatorListHttp(result);
    },

    async getOperatorTicket(auth, ticketId) {
      assertOperatorEndpointRole(auth);
      const detail = await enrichDetail(
        await loadReadableTicket(auth, ticketId, { operator: true }),
      );
      await syncSla(detail.ticket);
      return toOperatorDetailHttp(detail);
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
      await syncSla(persisted.ticket, { isOperatorPublicReply: true });
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
        ticket = detail.ticket;
        expectedRowVersion = ticket.rowVersion;
      }

      if (body.onHold !== undefined || body.onHoldReason !== undefined) {
        const at = nowIso();
        const nextTicket = bumpTicketActivity(
          withIncrementedRowVersion(
            {
              ...ticket,
              onHold: body.onHold ?? ticket.onHold === true,
              onHoldReason:
                body.onHoldReason !== undefined
                  ? body.onHoldReason
                  : (ticket.onHoldReason ?? null),
            },
            at,
          ),
          at,
        );
        detail = await persistMutation({ ticket: nextTicket, events: [] });
        ticket = detail.ticket;
        expectedRowVersion = ticket.rowVersion;
      }

      await syncSla(ticket);
      return { ticket: await toOperatorDetailHttp(detail) };
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
      await syncSla(persisted.ticket);
      return { ticket: await toOperatorDetailHttp(persisted) };
    },

    async listTicketCategories(auth) {
      assertOperatorEndpointRole(auth);
      const capabilities = await resolveWorkspaceCapabilities(auth.tenantId);
      return capabilities.categories.map((category) => ({
        code: category.code,
        labelKey: category.labelKey,
        ...(category.description !== undefined ? { description: category.description } : {}),
        ...(category.icon !== undefined ? { icon: category.icon } : {}),
        sortOrder: category.sortOrder,
        ...(category.defaultPriority !== undefined
          ? { defaultPriority: category.defaultPriority }
          : {}),
      }));
    },

    async listTags(auth) {
      assertAdminRole(auth);
      const tags = await operationalRepository.listTags(auth.tenantId);
      return tags.map((tag) => ({
        code: tag.code,
        label: tag.label,
        colorToken: tag.colorToken,
        archivedAt: tag.archivedAt,
        rowVersion: tag.rowVersion,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      }));
    },

    async createTag(auth, body: TicketTagCreateInput, idempotencyKey) {
      void idempotencyKey;
      assertAdminRole(auth);
      try {
        const tag = await operationalRepository.createTag(auth.tenantId, body);
        return {
          code: tag.code,
          label: tag.label,
          colorToken: tag.colorToken,
          archivedAt: tag.archivedAt,
          rowVersion: tag.rowVersion,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        };
      } catch (error) {
        mapPersistenceError(error);
      }
    },

    async updateTag(auth, code, body: TicketTagUpdateInput, idempotencyKey) {
      void idempotencyKey;
      assertAdminRole(auth);
      try {
        const tag = await operationalRepository.updateTag(auth.tenantId, code, body);
        return {
          code: tag.code,
          label: tag.label,
          colorToken: tag.colorToken,
          archivedAt: tag.archivedAt,
          rowVersion: tag.rowVersion,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        };
      } catch (error) {
        mapPersistenceError(error);
      }
    },

    async listQueues(auth) {
      assertAdminRole(auth);
      const queues = await operationalRepository.listQueues(auth.tenantId);
      return queues.map((queue) => ({
        code: queue.code,
        name: queue.name,
        description: queue.description,
        enabled: queue.enabled,
        sortOrder: queue.sortOrder,
        filterJson: queue.filterJson,
        teamCode: queue.teamCode,
        isDefault: queue.isDefault,
        archivedAt: queue.archivedAt,
        rowVersion: queue.rowVersion,
        createdAt: queue.createdAt,
        updatedAt: queue.updatedAt,
      }));
    },

    async createQueue(auth, body: TicketQueueCreateInput, idempotencyKey) {
      void idempotencyKey;
      assertAdminRole(auth);
      try {
        const queue = await operationalRepository.createQueue(auth.tenantId, body);
        return {
          code: queue.code,
          name: queue.name,
          description: queue.description,
          enabled: queue.enabled,
          sortOrder: queue.sortOrder,
          filterJson: queue.filterJson,
          teamCode: queue.teamCode,
          isDefault: queue.isDefault,
          archivedAt: queue.archivedAt,
          rowVersion: queue.rowVersion,
          createdAt: queue.createdAt,
          updatedAt: queue.updatedAt,
        };
      } catch (error) {
        mapPersistenceError(error);
      }
    },

    async updateQueue(auth, code, body: TicketQueueUpdateInput, idempotencyKey) {
      void idempotencyKey;
      assertAdminRole(auth);
      try {
        const queue =
          body.archived === true
            ? await operationalRepository.archiveQueue(auth.tenantId, code, body.rowVersion)
            : await operationalRepository.updateQueue(auth.tenantId, code, body);
        return {
          code: queue.code,
          name: queue.name,
          description: queue.description,
          enabled: queue.enabled,
          sortOrder: queue.sortOrder,
          filterJson: queue.filterJson,
          teamCode: queue.teamCode,
          isDefault: queue.isDefault,
          archivedAt: queue.archivedAt,
          rowVersion: queue.rowVersion,
          createdAt: queue.createdAt,
          updatedAt: queue.updatedAt,
        };
      } catch (error) {
        mapPersistenceError(error);
      }
    },

    async listTeams(auth) {
      assertAdminRole(auth);
      const teams = await operationalRepository.listTeams(auth.tenantId);
      return teams.map((team) => ({
        code: team.code,
        name: team.name,
        description: team.description,
        enabled: team.enabled,
        isDefault: team.isDefault,
        archivedAt: team.archivedAt,
        rowVersion: team.rowVersion,
        memberUserIds: team.memberUserIds,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      }));
    },

    async createTeam(auth, body: TicketTeamCreateInput, idempotencyKey) {
      void idempotencyKey;
      assertAdminRole(auth);
      if (body.memberUserIds !== undefined) {
        for (const userId of body.memberUserIds) {
          const inTenant = await repository.isAssigneeInTenant(auth.tenantId, userId);
          if (!inTenant) {
            throwTicketingDomainError({
              code: "ASSIGNEE_NOT_IN_TENANT",
              message: "team member is not in tenant",
              field: "memberUserIds",
            });
          }
        }
      }
      try {
        const team = await operationalRepository.createTeam(auth.tenantId, body);
        return {
          code: team.code,
          name: team.name,
          description: team.description,
          enabled: team.enabled,
          isDefault: team.isDefault,
          archivedAt: team.archivedAt,
          rowVersion: team.rowVersion,
          memberUserIds: team.memberUserIds,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        };
      } catch (error) {
        mapPersistenceError(error);
      }
    },

    async updateTeam(auth, code, body: TicketTeamUpdateInput, idempotencyKey) {
      void idempotencyKey;
      assertAdminRole(auth);
      if (body.memberUserIds !== undefined) {
        for (const userId of body.memberUserIds) {
          const inTenant = await repository.isAssigneeInTenant(auth.tenantId, userId);
          if (!inTenant) {
            throwTicketingDomainError({
              code: "ASSIGNEE_NOT_IN_TENANT",
              message: "team member is not in tenant",
              field: "memberUserIds",
            });
          }
        }
      }
      try {
        const team =
          body.archived === true
            ? await operationalRepository.archiveTeam(auth.tenantId, code, body.rowVersion)
            : await operationalRepository.updateTeam(auth.tenantId, code, body);
        return {
          code: team.code,
          name: team.name,
          description: team.description,
          enabled: team.enabled,
          isDefault: team.isDefault,
          archivedAt: team.archivedAt,
          rowVersion: team.rowVersion,
          memberUserIds: team.memberUserIds,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        };
      } catch (error) {
        mapPersistenceError(error);
      }
    },

    async assignTicket(auth, ticketId, body: TicketAssignInput, idempotencyKey) {
      void idempotencyKey;
      assertAdminRole(auth);
      let detail = await loadReadableTicket(auth, ticketId, { operator: true });
      const actor = await buildTicketActorContext(auth, { loadTenantMembers: true });
      const now = nowIso();

      if (body.assigneeUserId !== undefined) {
        const outcome = unwrap(
          assignTicket({
            eventId: randomUUID(),
            ticket: detail.ticket,
            assigneeUserId: body.assigneeUserId,
            actor,
            expectedRowVersion: body.rowVersion,
            nowIso: now,
          }),
        );
        detail = await persistMutation({
          ticket: { ...outcome.ticket, assigneeTeamId: null },
          events: outcome.events,
        });
        await syncSla(detail.ticket);
        return { ticket: await toOperatorDetailHttp(detail) };
      }

      const teamCode = body.assigneeTeamCode;
      if (teamCode === null) {
        if (detail.ticket.rowVersion !== body.rowVersion) {
          throwTicketingDomainError({
            code: "ROW_VERSION_CONFLICT",
            message: "stale row version",
          });
        }
        const event = buildTicketEvent({
          id: randomUUID(),
          tenantId: detail.ticket.tenantId,
          ticketId: detail.ticket.id,
          eventType: "ticket.team.assigned",
          actorUserId: auth.userId,
          payload: { from: detail.ticket.assigneeTeamId, to: null },
          createdAt: now,
        });
        const updatedTicket = withIncrementedRowVersion(
          bumpTicketActivity(
            {
              ...detail.ticket,
              assigneeUserId: null,
              assigneeTeamId: null,
            },
            now,
          ),
          now,
        );
        detail = await persistMutation({ ticket: updatedTicket, events: [event] });
        await syncSla(detail.ticket);
        return { ticket: await toOperatorDetailHttp(detail) };
      }

      const team = await operationalRepository.findTeamByCode(auth.tenantId, teamCode!);
      if (team === null) {
        throwTicketingDomainError({
          code: "TEAM_NOT_FOUND",
          message: "team not found",
          field: "assigneeTeamCode",
        });
      }
      if (detail.ticket.rowVersion !== body.rowVersion) {
        throwTicketingDomainError({
          code: "ROW_VERSION_CONFLICT",
          message: "stale row version",
        });
      }
      const event = buildTicketEvent({
        id: randomUUID(),
        tenantId: detail.ticket.tenantId,
        ticketId: detail.ticket.id,
        eventType: "ticket.team.assigned",
        actorUserId: auth.userId,
        payload: { from: detail.ticket.assigneeTeamId, to: team.id, teamCode: team.code },
        createdAt: now,
      });
      const updatedTicket = withIncrementedRowVersion(
        bumpTicketActivity(
          {
            ...detail.ticket,
            assigneeUserId: null,
            assigneeTeamId: team.id,
          },
          now,
        ),
        now,
      );
      detail = await persistMutation({ ticket: updatedTicket, events: [event] });
      await syncSla(detail.ticket);
      return { ticket: await toOperatorDetailHttp(detail) };
    },

    async changeTicketQueue(auth, ticketId, body: TicketQueueChangeInput, idempotencyKey) {
      void idempotencyKey;
      assertAdminRole(auth);
      let detail = await loadReadableTicket(auth, ticketId, { operator: true });
      const now = nowIso();
      let queueId: string | null = null;
      let queueCode: string | null = body.queueCode;

      if (body.queueCode !== null) {
        const queue = await operationalRepository.findQueueByCode(auth.tenantId, body.queueCode);
        if (queue === null) {
          throwTicketingDomainError({
            code: "QUEUE_NOT_FOUND",
            message: "queue not found",
            field: "queueCode",
          });
        }
        queueId = queue.id;
        queueCode = queue.code;
      }

      const event = buildTicketEvent({
        id: randomUUID(),
        tenantId: detail.ticket.tenantId,
        ticketId: detail.ticket.id,
        eventType: "ticket.queue.changed",
        actorUserId: auth.userId,
        payload: {
          from: detail.ticket.queueId,
          to: queueId,
          queueCode,
        },
        createdAt: now,
      });
      const updatedTicket = withIncrementedRowVersion(
        bumpTicketActivity({ ...detail.ticket, queueId }, now),
        now,
      );
      if (detail.ticket.rowVersion !== body.rowVersion) {
        throwTicketingDomainError({
          code: "ROW_VERSION_CONFLICT",
          message: "stale row version",
        });
      }
      detail = await persistMutation({ ticket: updatedTicket, events: [event] });
      await syncSla(detail.ticket);
      return { ticket: await toOperatorDetailHttp(detail) };
    },

    async addTicketTag(auth, ticketId, body: TicketTagMutationInput, idempotencyKey) {
      void idempotencyKey;
      assertAdminRole(auth);
      let detail = await loadReadableTicket(auth, ticketId, { operator: true });
      const tag = await operationalRepository.findTagByCode(auth.tenantId, body.tagCode);
      if (tag === null) {
        throwTicketingDomainError({
          code: "TAG_NOT_FOUND",
          message: "tag not found",
          field: "tagCode",
        });
      }
      try {
        await operationalRepository.addTicketTag(auth.tenantId, ticketId, body.tagCode);
      } catch (error) {
        mapPersistenceError(error);
      }
      const now = nowIso();
      const event = buildTicketEvent({
        id: randomUUID(),
        tenantId: detail.ticket.tenantId,
        ticketId: detail.ticket.id,
        eventType: "ticket.tag.added",
        actorUserId: auth.userId,
        payload: { tagCode: body.tagCode },
        createdAt: now,
      });
      const updatedTicket = withIncrementedRowVersion(
        bumpTicketActivity(detail.ticket, now),
        now,
      );
      if (detail.ticket.rowVersion !== body.rowVersion) {
        throwTicketingDomainError({
          code: "ROW_VERSION_CONFLICT",
          message: "stale row version",
        });
      }
      detail = await persistMutation({ ticket: updatedTicket, events: [event] });
      return { ticket: await toOperatorDetailHttp(detail) };
    },

    async removeTicketTag(auth, ticketId, tagCode, rowVersion, idempotencyKey) {
      void idempotencyKey;
      assertAdminRole(auth);
      let detail = await loadReadableTicket(auth, ticketId, { operator: true });
      try {
        await operationalRepository.removeTicketTag(auth.tenantId, ticketId, tagCode);
      } catch (error) {
        mapPersistenceError(error);
      }
      const now = nowIso();
      const event = buildTicketEvent({
        id: randomUUID(),
        tenantId: detail.ticket.tenantId,
        ticketId: detail.ticket.id,
        eventType: "ticket.tag.removed",
        actorUserId: auth.userId,
        payload: { tagCode },
        createdAt: now,
      });
      const updatedTicket = withIncrementedRowVersion(
        bumpTicketActivity(detail.ticket, now),
        now,
      );
      if (detail.ticket.rowVersion !== rowVersion) {
        throwTicketingDomainError({
          code: "ROW_VERSION_CONFLICT",
          message: "stale row version",
        });
      }
      detail = await persistMutation({ ticket: updatedTicket, events: [event] });
      return { ticket: await toOperatorDetailHttp(detail) };
    },

    ...e1,
  };
}
