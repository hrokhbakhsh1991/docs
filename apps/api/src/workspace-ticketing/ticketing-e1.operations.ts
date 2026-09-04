import { randomUUID } from "node:crypto";

import {
  buildTicketEvent,
  canCreateTicketLink,
  canDeleteAttachment,
  canManageTicketLinks,
  canReadAttachment,
  canUploadAttachment,
  type TicketLinkEntityType,
} from "@app-tour/ticketing-core";
import { throwTicketingDomainError } from "@app-tour/ticketing-http";
import type {
  TicketAttachmentCompleteResponse,
  TicketAttachmentDownloadResponse,
  TicketAttachmentIntentInput,
  TicketAttachmentIntentResponse,
  TicketLinkCreateInput,
  TicketLinkHttp,
  TicketLinkListHttpResponse,
} from "@app-tour/ticketing-http-contracts";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { TicketingAttachmentRepository } from "./infrastructure/ticketing-attachment.repository";
import type {
  TicketingEntityValidationRepository,
  TicketingLinkRepository,
} from "./infrastructure/ticketing-link.repository";
import type { TicketingCapabilityPort } from "./infrastructure/host-ticketing-capability.adapter";
import type { PrismaTicketingRepository } from "./infrastructure/prisma-ticketing.repository";
import {
  buildTicketAttachmentObjectKey,
  getTicketAttachmentSignedReadUrl,
  putTicketAttachmentObject,
  removeTicketAttachmentObject,
  TICKET_ATTACHMENT_INTENT_TTL_MS,
  ticketAttachmentObjectExists,
} from "./ticket-attachment-storage";
import { getTicketAttachmentScanner } from "./ticket-attachment-scan";
import { buildTicketActorContext } from "./ticketing-actor-context";
import type { TicketDetailRecord } from "./ticketing-repository.types";

type E1Deps = {
  readonly repository: PrismaTicketingRepository;
  readonly attachmentRepository: TicketingAttachmentRepository;
  readonly linkRepository: TicketingLinkRepository;
  readonly entityRepository: TicketingEntityValidationRepository;
  readonly capability: TicketingCapabilityPort;
  readonly loadReadableTicket: (
    auth: TenantAuthContext,
    ticketId: string,
    options?: { readonly operator?: boolean }
  ) => Promise<TicketDetailRecord>;
  readonly loadTicketRow: (
    tenantId: string,
    ticketId: string
  ) => Promise<import("@prisma/client").Ticket | null>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function mapE1Error(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === "TICKET_ATTACHMENT_NOT_FOUND") {
      throwTicketingDomainError({
        code: "TICKET_ATTACHMENT_NOT_FOUND",
        message: "attachment not found",
      });
    }
    if (error.message === "TICKET_LINK_DUPLICATE") {
      throwTicketingDomainError({
        code: "TICKET_LINK_DUPLICATE",
        message: "link already exists",
      });
    }
    if (error.message === "TICKET_ENTITY_NOT_FOUND") {
      throwTicketingDomainError({
        code: "TICKET_ENTITY_NOT_FOUND",
        message: "entity not found",
      });
    }
    if (error.message === "TICKET_ATTACHMENT_UNSUPPORTED_TYPE") {
      throwTicketingDomainError({
        code: "TICKET_ATTACHMENT_UNSUPPORTED_TYPE",
        message: "unsupported content type",
      });
    }
    if (error.message === "TICKET_ATTACHMENT_INVALID_FILE") {
      throwTicketingDomainError({
        code: "TICKET_ATTACHMENT_INVALID_FILE",
        message: "invalid attachment file",
      });
    }
    if (error.message === "MINIO_NOT_CONFIGURED") {
      throwTicketingDomainError({
        code: "TICKET_STORAGE_UNAVAILABLE",
        message: "storage unavailable",
      });
    }
  }
  throw error;
}

async function assertAttachmentsEnabled(
  capability: TicketingCapabilityPort,
  tenantId: string
): Promise<{ readonly maxAttachmentSizeBytes: number }> {
  const gate = await capability.assertEnabled(tenantId);
  if (!gate.capabilities.attachments) {
    throwTicketingDomainError({
      code: "TICKET_ATTACHMENTS_DISABLED",
      message: "attachments are disabled for this workspace",
    });
  }
  return { maxAttachmentSizeBytes: gate.capabilities.maxAttachmentSizeBytes };
}

async function validateEntityExists(
  entityRepository: TicketingEntityValidationRepository,
  tenantId: string,
  entityType: TicketLinkEntityType,
  entityId: string
): Promise<void> {
  let exists = false;
  switch (entityType) {
    case "tour":
      exists = await entityRepository.existsTourInTenant(tenantId, entityId);
      break;
    case "registration":
      exists = await entityRepository.existsRegistrationInTenant(tenantId, entityId);
      break;
    case "payment":
      exists = await entityRepository.existsPaymentInTenant(tenantId, entityId);
      break;
    case "wallet":
      exists = await entityRepository.existsWalletInTenant(tenantId, entityId);
      break;
    default:
      exists = false;
  }
  if (!exists) {
    throwTicketingDomainError({
      code: "TICKET_ENTITY_NOT_FOUND",
      message: `${entityType} not found in tenant`,
      field: "entityId",
    });
  }
}

function loadActorContext(auth: TenantAuthContext, options?: { readonly operator?: boolean }) {
  return buildTicketActorContext(auth, {
    loadTenantMembers: options?.operator === true || auth.role === "viewer",
  });
}

export function createTicketingE1Operations(deps: E1Deps) {
  return {
    async createAttachmentIntent(
      auth: TenantAuthContext,
      ticketId: string,
      body: TicketAttachmentIntentInput,
      idempotencyKey: string,
      options?: { readonly operator?: boolean }
    ): Promise<TicketAttachmentIntentResponse> {
      const limits = await assertAttachmentsEnabled(deps.capability, auth.tenantId);
      if (body.sizeBytes > limits.maxAttachmentSizeBytes) {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_TOO_LARGE",
          message: "attachment exceeds max size",
          field: "sizeBytes",
        });
      }
      const existing = await deps.attachmentRepository.findByIdempotencyKey(
        auth.tenantId,
        idempotencyKey
      );
      if (existing !== null) {
        return {
          attachmentId: existing.id,
          expiresAt:
            existing.uploadIntentExpiresAt ??
            new Date(Date.now() + TICKET_ATTACHMENT_INTENT_TTL_MS).toISOString(),
        };
      }
      const detail = await deps.loadReadableTicket(auth, ticketId, options);
      const message = await deps.attachmentRepository.findMessageById(
        auth.tenantId,
        ticketId,
        body.messageId
      );
      if (message === null) {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_NOT_FOUND",
          message: "message not found on ticket",
          field: "messageId",
        });
      }
      const actor = await loadActorContext(auth, options);
      if (
        !canUploadAttachment(
          detail.ticket,
          actor,
          message.visibility as import("@app-tour/ticketing-core").TicketMessageVisibility
        )
      ) {
        throwTicketingDomainError({
          code: "TICKET_ACCESS_DENIED",
          message: "upload denied",
        });
      }
      const attachmentId = randomUUID();
      const expiresAt = new Date(Date.now() + TICKET_ATTACHMENT_INTENT_TTL_MS);
      const objectKey = buildTicketAttachmentObjectKey({
        tenantId: auth.tenantId,
        ticketId,
        messageId: body.messageId,
        attachmentId,
      });
      try {
        const attachment = await deps.attachmentRepository.createIntent({
          id: attachmentId,
          tenantId: auth.tenantId,
          ticketId,
          messageId: body.messageId,
          uploadedByUserId: auth.userId,
          objectKey,
          originalFileName: body.originalFileName,
          contentType: body.contentType,
          idempotencyKey,
          uploadIntentExpiresAt: expiresAt,
        });
        return { attachmentId: attachment.id, expiresAt: expiresAt.toISOString() };
      } catch (error) {
        mapE1Error(error);
      }
    },

    async uploadAttachment(
      auth: TenantAuthContext,
      ticketId: string,
      attachmentId: string,
      body: Buffer,
      contentType: string,
      options?: { readonly operator?: boolean }
    ): Promise<void> {
      await assertAttachmentsEnabled(deps.capability, auth.tenantId);
      const detail = await deps.loadReadableTicket(auth, ticketId, options);
      const attachment = await deps.attachmentRepository.findAttachmentById(
        auth.tenantId,
        ticketId,
        attachmentId
      );
      if (attachment === null || attachment.scanStatus !== "pending") {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_NOT_FOUND",
          message: "attachment not found",
        });
      }
      const message =
        attachment.messageId === null
          ? null
          : await deps.attachmentRepository.findMessageById(
              auth.tenantId,
              ticketId,
              attachment.messageId
            );
      const actor = await loadActorContext(auth, options);
      if (
        !canUploadAttachment(
          detail.ticket,
          actor,
          (message?.visibility ??
            "public") as import("@app-tour/ticketing-core").TicketMessageVisibility
        )
      ) {
        throwTicketingDomainError({
          code: "TICKET_ACCESS_DENIED",
          message: "upload denied",
        });
      }
      const limits = await assertAttachmentsEnabled(deps.capability, auth.tenantId);
      if (body.length > limits.maxAttachmentSizeBytes) {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_TOO_LARGE",
          message: "attachment exceeds max size",
        });
      }
      try {
        await putTicketAttachmentObject({
          tenantId: auth.tenantId,
          storageKey: attachment.objectKey,
          body,
          contentType: contentType || attachment.contentType,
        });
        await deps.attachmentRepository.recordUploadedSize(
          auth.tenantId,
          ticketId,
          attachmentId,
          body.length
        );
      } catch (error) {
        mapE1Error(error);
      }
    },

    async completeAttachment(
      auth: TenantAuthContext,
      ticketId: string,
      messageId: string,
      attachmentId: string,
      idempotencyKey: string,
      options?: { readonly operator?: boolean }
    ): Promise<TicketAttachmentCompleteResponse> {
      void idempotencyKey;
      await assertAttachmentsEnabled(deps.capability, auth.tenantId);
      const existing = await deps.attachmentRepository.findAttachmentById(
        auth.tenantId,
        ticketId,
        attachmentId
      );
      if (existing !== null && existing.scanStatus === "clean") {
        const readUrl = await getTicketAttachmentSignedReadUrl({
          tenantId: auth.tenantId,
          storageKey: existing.objectKey,
        });
        return {
          id: existing.id,
          ticketId: existing.ticketId,
          messageId: existing.messageId ?? messageId,
          originalFileName: existing.originalFileName,
          contentType: existing.contentType,
          sizeBytes: existing.sizeBytes,
          scanStatus: "clean",
          uploadedAt: existing.uploadedAt ?? nowIso(),
          readUrl,
        };
      }
      const detail = await deps.loadReadableTicket(auth, ticketId, options);
      const attachment = await deps.attachmentRepository.findAttachmentById(
        auth.tenantId,
        ticketId,
        attachmentId
      );
      if (attachment === null || attachment.messageId !== messageId) {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_NOT_FOUND",
          message: "attachment not found",
        });
      }
      const message = await deps.attachmentRepository.findMessageById(
        auth.tenantId,
        ticketId,
        messageId
      );
      const actor = await loadActorContext(auth, options);
      if (
        !canUploadAttachment(
          detail.ticket,
          actor,
          (message?.visibility ??
            "public") as import("@app-tour/ticketing-core").TicketMessageVisibility
        )
      ) {
        throwTicketingDomainError({
          code: "TICKET_ACCESS_DENIED",
          message: "complete denied",
        });
      }
      const exists = await ticketAttachmentObjectExists({
        tenantId: auth.tenantId,
        storageKey: attachment.objectKey,
      });
      if (!exists) {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_INVALID_FILE",
          message: "uploaded object not found",
        });
      }
      const ticketRow = await deps.loadTicketRow(auth.tenantId, ticketId);
      if (ticketRow === null) {
        throwTicketingDomainError({ code: "TICKET_NOT_FOUND", message: "ticket not found" });
      }
      const sizeBytes = attachment.sizeBytes > 0 ? attachment.sizeBytes : 0;
      if (sizeBytes <= 0) {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_INVALID_FILE",
          message: "attachment size unknown",
        });
      }
      const scanResult = await getTicketAttachmentScanner().scan({
        tenantId: auth.tenantId,
        storageKey: attachment.objectKey,
        contentType: attachment.contentType,
        sizeBytes,
        originalFileName: attachment.originalFileName,
      });
      if (scanResult === "rejected") {
        await deps.attachmentRepository.markScanRejected(auth.tenantId, ticketId, attachmentId);
        try {
          await removeTicketAttachmentObject({
            tenantId: auth.tenantId,
            storageKey: attachment.objectKey,
          });
        } catch {
          // best-effort cleanup after scan rejection
        }
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_SCAN_REJECTED",
          message: "attachment scan rejected",
        });
      }

      const event = buildTicketEvent({
        id: randomUUID(),
        tenantId: auth.tenantId,
        ticketId,
        eventType: "attachment.completed",
        actorUserId: auth.userId,
        payload: { attachmentId, messageId },
        createdAt: nowIso(),
      });
      try {
        const completed = await deps.attachmentRepository.completeAttachment({
          tenantId: auth.tenantId,
          ticketId,
          attachmentId,
          sizeBytes,
          ticket: ticketRow,
          events: [event],
          actorUserId: auth.userId,
        });
        const readUrl = await getTicketAttachmentSignedReadUrl({
          tenantId: auth.tenantId,
          storageKey: completed.objectKey,
        });
        return {
          id: completed.id,
          ticketId: completed.ticketId,
          messageId: messageId,
          originalFileName: completed.originalFileName,
          contentType: completed.contentType,
          sizeBytes: completed.sizeBytes,
          scanStatus: "clean",
          uploadedAt: completed.uploadedAt ?? nowIso(),
          readUrl,
        };
      } catch (error) {
        mapE1Error(error);
      }
    },

    async getAttachmentDownloadUrl(
      auth: TenantAuthContext,
      ticketId: string,
      attachmentId: string,
      options?: { readonly operator?: boolean }
    ): Promise<TicketAttachmentDownloadResponse> {
      const detail = await deps.loadReadableTicket(auth, ticketId, options);
      const attachment = await deps.attachmentRepository.findAttachmentById(
        auth.tenantId,
        ticketId,
        attachmentId
      );
      if (attachment === null) {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_NOT_FOUND",
          message: "attachment not found",
        });
      }
      const message =
        attachment.messageId === null
          ? null
          : await deps.attachmentRepository.findMessageById(
              auth.tenantId,
              ticketId,
              attachment.messageId
            );
      const actor = await loadActorContext(auth, options);
      if (
        !canReadAttachment(
          detail.ticket,
          actor,
          attachment,
          (message?.visibility ?? null) as
            | import("@app-tour/ticketing-core").TicketMessageVisibility
            | null
        )
      ) {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_NOT_FOUND",
          message: "attachment not found",
        });
      }
      if (attachment.scanStatus !== "clean") {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_SCAN_REJECTED",
          message: "attachment not available",
        });
      }
      try {
        const readUrl = await getTicketAttachmentSignedReadUrl({
          tenantId: auth.tenantId,
          storageKey: attachment.objectKey,
        });
        const expiresAt = new Date(Date.now() + 300_000).toISOString();
        return { readUrl, expiresAt };
      } catch (error) {
        mapE1Error(error);
      }
    },

    async deleteAttachment(
      auth: TenantAuthContext,
      ticketId: string,
      attachmentId: string,
      options?: { readonly operator?: boolean }
    ): Promise<void> {
      const detail = await deps.loadReadableTicket(auth, ticketId, options);
      const attachment = await deps.attachmentRepository.findAttachmentById(
        auth.tenantId,
        ticketId,
        attachmentId
      );
      if (attachment === null) {
        throwTicketingDomainError({
          code: "TICKET_ATTACHMENT_NOT_FOUND",
          message: "attachment not found",
        });
      }
      const message =
        attachment.messageId === null
          ? null
          : await deps.attachmentRepository.findMessageById(
              auth.tenantId,
              ticketId,
              attachment.messageId
            );
      const actor = await loadActorContext(auth, options);
      if (
        !canDeleteAttachment(
          detail.ticket,
          actor,
          attachment,
          (message?.visibility ?? null) as
            | import("@app-tour/ticketing-core").TicketMessageVisibility
            | null
        )
      ) {
        throwTicketingDomainError({
          code: "TICKET_ACCESS_DENIED",
          message: "delete denied",
        });
      }
      const ticketRow = await deps.loadTicketRow(auth.tenantId, ticketId);
      if (ticketRow === null) {
        throwTicketingDomainError({ code: "TICKET_NOT_FOUND", message: "ticket not found" });
      }
      const event = buildTicketEvent({
        id: randomUUID(),
        tenantId: auth.tenantId,
        ticketId,
        eventType: "attachment.deleted",
        actorUserId: auth.userId,
        payload: { attachmentId },
        createdAt: nowIso(),
      });
      try {
        await deps.attachmentRepository.softDelete({
          tenantId: auth.tenantId,
          ticketId,
          attachmentId,
          ticket: ticketRow,
          events: [event],
          actorUserId: auth.userId,
        });
        await removeTicketAttachmentObject({
          tenantId: auth.tenantId,
          storageKey: attachment.objectKey,
        });
      } catch (error) {
        mapE1Error(error);
      }
    },

    async listTicketLinks(
      auth: TenantAuthContext,
      ticketId: string,
      options?: { readonly operator?: boolean }
    ): Promise<TicketLinkListHttpResponse> {
      await deps.loadReadableTicket(auth, ticketId, options);
      const items = await deps.linkRepository.listByTicket(auth.tenantId, ticketId);
      return {
        items: items.map(
          (link): TicketLinkHttp => ({
            id: link.id,
            ticketId: link.ticketId,
            entityType: link.entityType,
            entityId: link.entityId,
            createdAt: link.createdAt,
          })
        ),
      };
    },

    async createTicketLink(
      auth: TenantAuthContext,
      ticketId: string,
      body: TicketLinkCreateInput,
      idempotencyKey: string,
      options?: { readonly operator?: boolean }
    ): Promise<TicketLinkHttp> {
      void idempotencyKey;
      const detail = await deps.loadReadableTicket(auth, ticketId, options);
      const actor = await loadActorContext(auth, options);
      if (!canCreateTicketLink(detail.ticket, actor, body.entityType)) {
        throwTicketingDomainError({
          code: "TICKET_ACCESS_DENIED",
          message: "link create denied",
        });
      }
      await validateEntityExists(
        deps.entityRepository,
        auth.tenantId,
        body.entityType,
        body.entityId
      );
      const ticketRow = await deps.loadTicketRow(auth.tenantId, ticketId);
      if (ticketRow === null) {
        throwTicketingDomainError({ code: "TICKET_NOT_FOUND", message: "ticket not found" });
      }
      const event = buildTicketEvent({
        id: randomUUID(),
        tenantId: auth.tenantId,
        ticketId,
        eventType: "ticket.link.created",
        actorUserId: auth.userId,
        payload: { entityType: body.entityType, entityId: body.entityId },
        createdAt: nowIso(),
      });
      try {
        const link = await deps.linkRepository.createLink({
          tenantId: auth.tenantId,
          ticketId,
          entityType: body.entityType,
          entityId: body.entityId,
          ticket: ticketRow,
          events: [event],
          actorUserId: auth.userId,
        });
        return {
          id: link.id,
          ticketId: link.ticketId,
          entityType: link.entityType,
          entityId: link.entityId,
          createdAt: link.createdAt,
        };
      } catch (error) {
        mapE1Error(error);
      }
    },

    async deleteTicketLink(
      auth: TenantAuthContext,
      ticketId: string,
      linkId: string
    ): Promise<void> {
      const detail = await deps.loadReadableTicket(auth, ticketId, { operator: true });
      const actor = await loadActorContext(auth, { operator: true });
      if (!canManageTicketLinks(detail.ticket, actor)) {
        throwTicketingDomainError({
          code: "TICKET_ACCESS_DENIED",
          message: "link delete denied",
        });
      }
      const ticketRow = await deps.loadTicketRow(auth.tenantId, ticketId);
      if (ticketRow === null) {
        throwTicketingDomainError({ code: "TICKET_NOT_FOUND", message: "ticket not found" });
      }
      const event = buildTicketEvent({
        id: randomUUID(),
        tenantId: auth.tenantId,
        ticketId,
        eventType: "ticket.link.deleted",
        actorUserId: auth.userId,
        payload: { linkId },
        createdAt: nowIso(),
      });
      try {
        await deps.linkRepository.deleteLink({
          tenantId: auth.tenantId,
          ticketId,
          linkId,
          ticket: ticketRow,
          events: [event],
          actorUserId: auth.userId,
        });
      } catch (error) {
        mapE1Error(error);
      }
    },
  };
}
