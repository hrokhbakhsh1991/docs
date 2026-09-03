import type { Prisma } from "@prisma/client";

import type { TicketAttachment, TicketEvent } from "@app-tour/ticketing-core";
import { withTenantRls } from "../../db/with-tenant-rls";
import { appendTicketingAuditEvents } from "../ticketing-audit-writer";
import { toIso } from "../ticketing-mappers";
import type { Ticket as PrismaTicket, TicketAttachment as PrismaTicketAttachment } from "@prisma/client";

export type CreateAttachmentIntentInput = {
  readonly id: string;
  readonly tenantId: string;
  readonly ticketId: string;
  readonly messageId: string;
  readonly uploadedByUserId: string;
  readonly objectKey: string;
  readonly originalFileName: string;
  readonly contentType: string;
  readonly idempotencyKey: string;
  readonly uploadIntentExpiresAt: Date;
};

export function mapAttachmentRow(row: PrismaTicketAttachment): TicketAttachment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    ticketId: row.ticketId,
    messageId: row.messageId,
    uploadedByUserId: row.uploadedByUserId,
    objectKey: row.objectKey,
    originalFileName: row.originalFileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    scanStatus: row.scanStatus as TicketAttachment["scanStatus"],
    uploadedAt: row.uploadedAt ? toIso(row.uploadedAt) : null,
    uploadIntentExpiresAt: row.uploadIntentExpiresAt
      ? toIso(row.uploadIntentExpiresAt)
      : null,
    createdAt: toIso(row.createdAt),
    deletedAt: row.deletedAt ? toIso(row.deletedAt) : null,
  };
}

export class TicketingAttachmentRepository {
  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<TicketAttachment | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticketAttachment.findFirst({
        where: { tenantId, idempotencyKey, deletedAt: null },
      });
      return row === null ? null : mapAttachmentRow(row);
    });
  }

  async findById(
    tenantId: string,
    ticketId: string,
    attachmentId: string,
  ): Promise<TicketAttachment | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticketAttachment.findFirst({
        where: { tenantId, ticketId, id: attachmentId, deletedAt: null },
      });
      return row === null ? null : mapAttachmentRow(row);
    });
  }

  async listByTicket(tenantId: string, ticketId: string): Promise<readonly TicketAttachment[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.ticketAttachment.findMany({
        where: { tenantId, ticketId, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(mapAttachmentRow);
    });
  }

  async createIntent(input: CreateAttachmentIntentInput): Promise<TicketAttachment> {
    return withTenantRls(input.tenantId, async (tx) => {
      try {
        const row = await tx.ticketAttachment.create({
          data: {
            id: input.id,
            tenantId: input.tenantId,
            ticketId: input.ticketId,
            messageId: input.messageId,
            uploadedByUserId: input.uploadedByUserId,
            objectKey: input.objectKey,
            originalFileName: input.originalFileName,
            contentType: input.contentType,
            sizeBytes: 0,
            scanStatus: "pending",
            idempotencyKey: input.idempotencyKey,
            uploadIntentExpiresAt: input.uploadIntentExpiresAt,
          },
        });
        return mapAttachmentRow(row);
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes("uq_ticket_attachments_tenant_idempotency_key") ||
            error.message.includes("Unique constraint"))
        ) {
          const existing = await tx.ticketAttachment.findFirst({
            where: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
              deletedAt: null,
            },
          });
          if (existing !== null) {
            return mapAttachmentRow(existing);
          }
        }
        throw error;
      }
    });
  }

  async completeAttachment(input: {
    readonly tenantId: string;
    readonly ticketId: string;
    readonly attachmentId: string;
    readonly sizeBytes: number;
    readonly ticket: PrismaTicket;
    readonly events: readonly TicketEvent[];
    readonly actorUserId: string | null;
  }): Promise<TicketAttachment> {
    return withTenantRls(input.tenantId, async (tx) => {
      const updated = await tx.ticketAttachment.updateMany({
        where: {
          tenantId: input.tenantId,
          ticketId: input.ticketId,
          id: input.attachmentId,
          deletedAt: null,
          scanStatus: "pending",
        },
        data: {
          sizeBytes: input.sizeBytes,
          scanStatus: "clean",
          uploadedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new Error("TICKET_ATTACHMENT_NOT_FOUND");
      }
      for (const event of input.events) {
        await tx.ticketEvent.create({
          data: {
            id: event.id,
            tenantId: event.tenantId,
            ticketId: event.ticketId,
            actorUserId: event.actorUserId,
            eventType: event.eventType,
            payload: event.payload as Prisma.InputJsonValue,
            createdAt: new Date(event.createdAt),
          },
        });
      }
      await appendTicketingAuditEvents(
        tx,
        {
          id: input.ticket.id,
          tenantId: input.ticket.tenantId,
          requesterUserId: input.ticket.requesterUserId,
          assigneeUserId: input.ticket.assigneeUserId,
          assigneeTeamId: input.ticket.assigneeTeamId,
          queueId: input.ticket.queueId,
          categoryCode: input.ticket.categoryCode,
          subject: input.ticket.subject,
          priority: input.ticket.priority as import("@app-tour/ticketing-core").Ticket["priority"],
          status: input.ticket.status as import("@app-tour/ticketing-core").Ticket["status"],
          relatedTourId: null,
          relatedRegistrationId: null,
          rowVersion: input.ticket.rowVersion,
          lastActivityAt: input.ticket.lastActivityAt.toISOString(),
          resolvedAt: input.ticket.resolvedAt?.toISOString() ?? null,
          closedAt: input.ticket.closedAt?.toISOString() ?? null,
          createdAt: input.ticket.createdAt.toISOString(),
          updatedAt: input.ticket.updatedAt.toISOString(),
        },
        input.events,
        input.actorUserId,
      );
      const row = await tx.ticketAttachment.findFirstOrThrow({
        where: { tenantId: input.tenantId, id: input.attachmentId },
      });
      return mapAttachmentRow(row);
    });
  }

  async recordUploadedSize(
    tenantId: string,
    ticketId: string,
    attachmentId: string,
    sizeBytes: number,
  ): Promise<void> {
    return withTenantRls(tenantId, async (tx) => {
      await tx.ticketAttachment.updateMany({
        where: {
          tenantId,
          ticketId,
          id: attachmentId,
          deletedAt: null,
          scanStatus: "pending",
        },
        data: { sizeBytes },
      });
    });
  }

  async softDelete(input: {
    readonly tenantId: string;
    readonly ticketId: string;
    readonly attachmentId: string;
    readonly ticket: PrismaTicket;
    readonly events: readonly TicketEvent[];
    readonly actorUserId: string | null;
  }): Promise<void> {
    return withTenantRls(input.tenantId, async (tx) => {
      const updated = await tx.ticketAttachment.updateMany({
        where: {
          tenantId: input.tenantId,
          ticketId: input.ticketId,
          id: input.attachmentId,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new Error("TICKET_ATTACHMENT_NOT_FOUND");
      }
      for (const event of input.events) {
        await tx.ticketEvent.create({
          data: {
            id: event.id,
            tenantId: event.tenantId,
            ticketId: event.ticketId,
            actorUserId: event.actorUserId,
            eventType: event.eventType,
            payload: event.payload as Prisma.InputJsonValue,
            createdAt: new Date(event.createdAt),
          },
        });
      }
      await appendTicketingAuditEvents(
        tx,
        {
          id: input.ticket.id,
          tenantId: input.ticket.tenantId,
          requesterUserId: input.ticket.requesterUserId,
          assigneeUserId: input.ticket.assigneeUserId,
          assigneeTeamId: input.ticket.assigneeTeamId,
          queueId: input.ticket.queueId,
          categoryCode: input.ticket.categoryCode,
          subject: input.ticket.subject,
          priority: input.ticket.priority as import("@app-tour/ticketing-core").Ticket["priority"],
          status: input.ticket.status as import("@app-tour/ticketing-core").Ticket["status"],
          relatedTourId: null,
          relatedRegistrationId: null,
          rowVersion: input.ticket.rowVersion,
          lastActivityAt: input.ticket.lastActivityAt.toISOString(),
          resolvedAt: input.ticket.resolvedAt?.toISOString() ?? null,
          closedAt: input.ticket.closedAt?.toISOString() ?? null,
          createdAt: input.ticket.createdAt.toISOString(),
          updatedAt: input.ticket.updatedAt.toISOString(),
        },
        input.events,
        input.actorUserId,
      );
    });
  }

  async findMessageById(
    tenantId: string,
    ticketId: string,
    messageId: string,
  ): Promise<{ readonly id: string; readonly visibility: string } | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticketMessage.findFirst({
        where: { tenantId, ticketId, id: messageId },
        select: { id: true, visibility: true },
      });
      return row;
    });
  }
}

export function createTicketingAttachmentRepository(): TicketingAttachmentRepository {
  return new TicketingAttachmentRepository();
}
