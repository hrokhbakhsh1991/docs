/**
 * Message visibility filtering — member-safe projection (TKT-001 Phase 2).
 */
import type { TicketAttachment, TicketMessage } from "./types";

export function isPublicMessage(message: TicketMessage): boolean {
  return message.visibility === "public";
}

export function filterMessagesForMember(
  messages: readonly TicketMessage[],
): readonly TicketMessage[] {
  return messages.filter(isPublicMessage);
}

/** Viewer read path — tenant-wide read-only; includes internal notes (TKT-001 viewer policy). */
export function filterMessagesForViewer(
  messages: readonly TicketMessage[],
): readonly TicketMessage[] {
  return messages;
}

export function assertMemberSafeMessage(message: TicketMessage): void {
  if (message.visibility === "internal") {
    throw new Error("INTERNAL_MESSAGE_LEAK");
  }
}

export function filterAttachmentsForMember(
  attachments: readonly TicketAttachment[],
  messages: readonly TicketMessage[],
): readonly TicketAttachment[] {
  const publicMessageIds = new Set(
    messages.filter(isPublicMessage).map((message) => message.id),
  );
  return attachments.filter(
    (attachment) =>
      attachment.deletedAt === null &&
      attachment.scanStatus === "clean" &&
      attachment.messageId !== null &&
      publicMessageIds.has(attachment.messageId),
  );
}

export function filterAttachmentsForOperator(
  attachments: readonly TicketAttachment[],
): readonly TicketAttachment[] {
  return attachments.filter(
    (attachment) =>
      attachment.deletedAt === null &&
      attachment.scanStatus !== "rejected" &&
      attachment.scanStatus !== "failed",
  );
}
