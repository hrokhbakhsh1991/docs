import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import type { Ticket, TicketEvent, TicketMessage } from "@app-tour/ticketing-core";
import { withTenantRls } from "../../db/with-tenant-rls";
import { appendTicketingAuditEvents } from "../ticketing-audit-writer";
import {
  coerceTicketEventId,
  decodeListCursor,
  encodeListCursor,
  mapEventRow,
  mapMessageRow,
  mapTicketRow,
} from "../ticketing-mappers";
import type {
  AddMessagePersistInput,
  CreateTicketPersistInput,
  MemberTicketListQuery,
  OperatorTicketListQuery,
  PersistTicketMutationInput,
  TicketDetailRecord,
  TicketListResult,
  TicketingRepositoryPort,
} from "../ticketing-repository.types";

async function loadDetail(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ticketId: string,
): Promise<TicketDetailRecord | null> {
  const row = await tx.ticket.findFirst({
    where: { tenantId, id: ticketId },
    include: { links: { select: { entityType: true, entityId: true } } },
  });
  if (row === null) return null;
  const messages = await tx.ticketMessage.findMany({
    where: { tenantId, ticketId },
    orderBy: { createdAt: "asc" },
  });
  const events = await tx.ticketEvent.findMany({
    where: { tenantId, ticketId },
    orderBy: { createdAt: "asc" },
  });
  return {
    ticket: mapTicketRow(row, row.links),
    messages: messages.map(mapMessageRow),
    events: events.map(mapEventRow),
  };
}

function ticketWriteData(ticket: Ticket): Prisma.TicketUncheckedCreateInput {
  return {
    id: ticket.id,
    tenantId: ticket.tenantId,
    requesterUserId: ticket.requesterUserId,
    assigneeUserId: ticket.assigneeUserId,
    assigneeTeamId: ticket.assigneeTeamId,
    queueId: ticket.queueId,
    categoryCode: ticket.categoryCode,
    priority: ticket.priority,
    status: ticket.status,
    subject: ticket.subject,
    lastActivityAt: new Date(ticket.lastActivityAt),
    resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt) : null,
    closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
    rowVersion: ticket.rowVersion,
    createdAt: new Date(ticket.createdAt),
    updatedAt: new Date(ticket.updatedAt),
  };
}

async function writeEventsAndAudit(
  tx: Prisma.TransactionClient,
  ticket: Ticket,
  events: readonly TicketEvent[],
  actorUserId: string | null,
): Promise<void> {
  for (const event of events) {
    await tx.ticketEvent.create({
      data: {
        id: coerceTicketEventId(event.id),
        tenantId: event.tenantId,
        ticketId: event.ticketId,
        actorUserId: event.actorUserId,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
        createdAt: new Date(event.createdAt),
      },
    });
  }
  await appendTicketingAuditEvents(tx, ticket, events, actorUserId);
}

export class PrismaTicketingRepository implements TicketingRepositoryPort {
  async findTicketById(tenantId: string, ticketId: string): Promise<TicketDetailRecord | null> {
    return withTenantRls(tenantId, (tx) => loadDetail(tx, tenantId, ticketId));
  }

  async findTicketByCreationIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<TicketDetailRecord | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticket.findFirst({
        where: { tenantId, creationIdempotencyKey: idempotencyKey },
        include: { links: { select: { entityType: true, entityId: true } } },
      });
      if (row === null) return null;
      return loadDetail(tx, tenantId, row.id);
    });
  }

  async findMessageByIdempotencyKey(
    tenantId: string,
    ticketId: string,
    idempotencyKey: string,
  ): Promise<TicketMessage | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticketMessage.findFirst({
        where: { tenantId, ticketId, idempotencyKey },
      });
      return row === null ? null : mapMessageRow(row);
    });
  }

  async findMemberTickets(query: MemberTicketListQuery): Promise<TicketListResult> {
    return withTenantRls(query.tenantId, async (tx) => {
      const cursor = query.cursor ? decodeListCursor(query.cursor) : null;
      const rows = await tx.ticket.findMany({
        where: {
          tenantId: query.tenantId,
          ...(query.requesterUserId !== undefined
            ? { requesterUserId: query.requesterUserId }
            : {}),
          ...(query.status !== undefined ? { status: query.status } : {}),
          ...(cursor !== null
            ? {
                OR: [
                  { lastActivityAt: { lt: cursor.lastActivityAt } },
                  {
                    lastActivityAt: cursor.lastActivityAt,
                    id: { lt: cursor.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
        include: { links: { select: { entityType: true, entityId: true } } },
      });
      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page.at(-1);
      return {
        items: page.map((row) => mapTicketRow(row, row.links)),
        hasMore,
        nextCursor:
          hasMore && last !== undefined
            ? encodeListCursor(last.lastActivityAt, last.id)
            : null,
      };
    });
  }

  async findOperatorTickets(query: OperatorTicketListQuery): Promise<TicketListResult> {
    return withTenantRls(query.tenantId, async (tx) => {
      const cursor = query.cursor ? decodeListCursor(query.cursor) : null;

      let queueId: string | undefined;
      if (query.queueCode !== undefined) {
        const queue = await tx.ticketQueue.findFirst({
          where: { tenantId: query.tenantId, code: query.queueCode },
          select: { id: true },
        });
        if (queue === null) {
          return { items: [], hasMore: false, nextCursor: null };
        }
        queueId = queue.id;
      }

      const rows = await tx.ticket.findMany({
        where: {
          tenantId: query.tenantId,
          ...(query.status !== undefined ? { status: query.status } : {}),
          ...(query.priority !== undefined ? { priority: query.priority } : {}),
          ...(query.categoryCode !== undefined ? { categoryCode: query.categoryCode } : {}),
          ...(query.assigneeUserId !== undefined
            ? { assigneeUserId: query.assigneeUserId }
            : {}),
          ...(query.assigneeTeamId !== undefined
            ? { assigneeTeamId: query.assigneeTeamId }
            : {}),
          ...(queueId !== undefined ? { queueId } : {}),
          ...(query.tagCode !== undefined
            ? {
                tagAssignments: {
                  some: { tenantId: query.tenantId, tagCode: query.tagCode },
                },
              }
            : {}),
          ...(query.teamId !== undefined
            ? {
                OR: [
                  { assigneeTeamId: query.teamId },
                  { queue: { teamId: query.teamId } },
                ],
              }
            : {}),
          ...(query.unassigned === true
            ? { assigneeUserId: null, assigneeTeamId: null }
            : {}),
          ...(query.q !== undefined
            ? { subject: { contains: query.q, mode: "insensitive" } }
            : {}),
          ...(cursor !== null
            ? {
                OR: [
                  { lastActivityAt: { lt: cursor.lastActivityAt } },
                  {
                    lastActivityAt: cursor.lastActivityAt,
                    id: { lt: cursor.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
        include: { links: { select: { entityType: true, entityId: true } } },
      });
      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page.at(-1);
      return {
        items: page.map((row) => mapTicketRow(row, row.links)),
        hasMore,
        nextCursor:
          hasMore && last !== undefined
            ? encodeListCursor(last.lastActivityAt, last.id)
            : null,
      };
    });
  }

  async createTicket(input: CreateTicketPersistInput): Promise<TicketDetailRecord> {
    return withTenantRls(input.ticket.tenantId, async (tx) => {
      await tx.ticket.create({
        data: {
          ...ticketWriteData(input.ticket),
          creationIdempotencyKey: input.creationIdempotencyKey,
        },
      });
      if (input.message !== undefined) {
        await tx.ticketMessage.create({
          data: {
            id: input.message.id,
            tenantId: input.message.tenantId,
            ticketId: input.message.ticketId,
            authorUserId: input.message.authorUserId,
            visibility: input.message.visibility,
            body: input.message.body,
            idempotencyKey: input.messageIdempotencyKey ?? null,
            createdAt: new Date(input.message.createdAt),
          },
        });
      }
      if (input.links !== undefined) {
        for (const link of input.links) {
          await tx.ticketLink.create({
            data: {
              id: randomUUID(),
              tenantId: input.ticket.tenantId,
              ticketId: input.ticket.id,
              entityType: link.entityType,
              entityId: link.entityId,
            },
          });
        }
      }
      await writeEventsAndAudit(
        tx,
        input.ticket,
        input.events,
        input.events[0]?.actorUserId ?? null,
      );
      const detail = await loadDetail(tx, input.ticket.tenantId, input.ticket.id);
      if (detail === null) {
        throw new Error("TICKET_PERSISTENCE_FAILED");
      }
      return detail;
    });
  }

  async persistMutation(input: PersistTicketMutationInput): Promise<TicketDetailRecord> {
    return withTenantRls(input.ticket.tenantId, async (tx) => {
      const updated = await tx.ticket.updateMany({
        where: {
          tenantId: input.ticket.tenantId,
          id: input.ticket.id,
          rowVersion: input.ticket.rowVersion - 1,
        },
        data: {
          assigneeUserId: input.ticket.assigneeUserId,
          assigneeTeamId: input.ticket.assigneeTeamId,
          queueId: input.ticket.queueId,
          categoryCode: input.ticket.categoryCode,
          priority: input.ticket.priority,
          status: input.ticket.status,
          lastActivityAt: new Date(input.ticket.lastActivityAt),
          resolvedAt: input.ticket.resolvedAt ? new Date(input.ticket.resolvedAt) : null,
          closedAt: input.ticket.closedAt ? new Date(input.ticket.closedAt) : null,
          rowVersion: input.ticket.rowVersion,
          updatedAt: new Date(input.ticket.updatedAt),
        },
      });
      if (updated.count !== 1) {
        throw new Error("ROW_VERSION_CONFLICT");
      }
      if (input.message !== undefined) {
        await tx.ticketMessage.create({
          data: {
            id: input.message.id,
            tenantId: input.message.tenantId,
            ticketId: input.message.ticketId,
            authorUserId: input.message.authorUserId,
            visibility: input.message.visibility,
            body: input.message.body,
            createdAt: new Date(input.message.createdAt),
          },
        });
      }
      await writeEventsAndAudit(
        tx,
        input.ticket,
        input.events,
        input.events[0]?.actorUserId ?? null,
      );
      const detail = await loadDetail(tx, input.ticket.tenantId, input.ticket.id);
      if (detail === null) {
        throw new Error("TICKET_PERSISTENCE_FAILED");
      }
      return detail;
    });
  }

  async addMessage(input: AddMessagePersistInput): Promise<TicketDetailRecord> {
    return withTenantRls(input.ticket.tenantId, async (tx) => {
      const updated = await tx.ticket.updateMany({
        where: {
          tenantId: input.ticket.tenantId,
          id: input.ticket.id,
          rowVersion: input.ticket.rowVersion - 1,
        },
        data: {
          status: input.ticket.status,
          lastActivityAt: new Date(input.ticket.lastActivityAt),
          resolvedAt: input.ticket.resolvedAt ? new Date(input.ticket.resolvedAt) : null,
          closedAt: input.ticket.closedAt ? new Date(input.ticket.closedAt) : null,
          rowVersion: input.ticket.rowVersion,
          updatedAt: new Date(input.ticket.updatedAt),
        },
      });
      if (updated.count !== 1) {
        throw new Error("ROW_VERSION_CONFLICT");
      }
      if (input.message !== undefined) {
        await tx.ticketMessage.create({
          data: {
            id: input.message.id,
            tenantId: input.message.tenantId,
            ticketId: input.message.ticketId,
            authorUserId: input.message.authorUserId,
            visibility: input.message.visibility,
            body: input.message.body,
            idempotencyKey: input.messageIdempotencyKey,
            createdAt: new Date(input.message.createdAt),
          },
        });
      }
      await writeEventsAndAudit(
        tx,
        input.ticket,
        input.events,
        input.events[0]?.actorUserId ?? null,
      );
      const detail = await loadDetail(tx, input.ticket.tenantId, input.ticket.id);
      if (detail === null) {
        throw new Error("TICKET_PERSISTENCE_FAILED");
      }
      return detail;
    });
  }

  async isAssigneeInTenant(tenantId: string, assigneeUserId: string): Promise<boolean> {
    return withTenantRls(tenantId, async (tx) => {
      const membership = await tx.userTenant.findFirst({
        where: { tenantId, userId: assigneeUserId, status: "ACTIVE" },
        select: { userId: true },
      });
      return membership !== null;
    });
  }

  async listActiveTenantMemberUserIds(tenantId: string): Promise<readonly string[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.userTenant.findMany({
        where: { tenantId, status: "ACTIVE" },
        select: { userId: true },
      });
      return rows.map((row) => row.userId);
    });
  }

  async existsTourInTenant(tenantId: string, tourId: string): Promise<boolean> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.tour.findFirst({
        where: { tenantId, id: tourId },
        select: { id: true },
      });
      return row !== null;
    });
  }

  async existsRegistrationInTenant(tenantId: string, registrationId: string): Promise<boolean> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.operatorRegistration.findFirst({
        where: { tenantId, id: registrationId },
        select: { id: true },
      });
      return row !== null;
    });
  }
}

export function createTicketingRepository(): PrismaTicketingRepository {
  return new PrismaTicketingRepository();
}
