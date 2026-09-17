import { assertTenantOwnsObjectKey } from "../storage/assert-tenant-object-key-scope";
import { getTenantObjectStorage } from "../storage/create-tenant-object-storage";

export const TICKET_ATTACHMENT_INTENT_TTL_MS = 15 * 60 * 1000;
export const TICKET_ATTACHMENT_READ_URL_TTL_SECONDS = 300;

export const TICKET_ATTACHMENT_ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function sanitizeTicketAttachmentFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "attachment";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "attachment.bin";
}

export function buildTicketAttachmentObjectKey(input: {
  readonly tenantId: string;
  readonly ticketId: string;
  readonly messageId: string;
  readonly attachmentId: string;
}): string {
  return `tickets/${input.tenantId}/${input.ticketId}/${input.messageId}/${input.attachmentId}`;
}

export function assertTicketAttachmentKeyScope(storageKey: string, tenantId: string): void {
  const prefix = `tickets/${tenantId}/`;
  if (!storageKey.startsWith(prefix)) {
    throw new Error("TICKET_ATTACHMENT_KEY_SCOPE_INVALID");
  }
  assertTenantOwnsObjectKey(storageKey, tenantId);
}

export function assertTicketAttachmentContentType(contentType: string): void {
  const normalized = contentType.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  if (!TICKET_ATTACHMENT_ALLOWED_CONTENT_TYPES.has(normalized)) {
    throw new Error("TICKET_ATTACHMENT_UNSUPPORTED_TYPE");
  }
}

export async function putTicketAttachmentObject(input: {
  readonly tenantId: string;
  readonly storageKey: string;
  readonly body: Buffer;
  readonly contentType: string;
}): Promise<void> {
  assertTicketAttachmentContentType(input.contentType);
  assertTicketAttachmentKeyScope(input.storageKey, input.tenantId);
  if (input.body.length === 0) {
    throw new Error("TICKET_ATTACHMENT_INVALID_FILE");
  }
  await getTenantObjectStorage().put({
    tenantId: input.tenantId,
    storageKey: input.storageKey,
    body: input.body,
    contentType: input.contentType,
  });
}

export async function getTicketAttachmentSignedReadUrl(input: {
  readonly tenantId: string;
  readonly storageKey: string;
  readonly expiresInSeconds?: number;
}): Promise<string> {
  assertTicketAttachmentKeyScope(input.storageKey, input.tenantId);
  return getTenantObjectStorage().getSignedReadUrl({
    tenantId: input.tenantId,
    storageKey: input.storageKey,
    ttlSeconds: input.expiresInSeconds ?? TICKET_ATTACHMENT_READ_URL_TTL_SECONDS,
  });
}

export async function removeTicketAttachmentObject(input: {
  readonly tenantId: string;
  readonly storageKey: string;
}): Promise<void> {
  assertTicketAttachmentKeyScope(input.storageKey, input.tenantId);
  await getTenantObjectStorage().remove({
    tenantId: input.tenantId,
    storageKey: input.storageKey,
  });
}

export async function ticketAttachmentObjectExists(input: {
  readonly tenantId: string;
  readonly storageKey: string;
}): Promise<boolean> {
  assertTicketAttachmentKeyScope(input.storageKey, input.tenantId);
  try {
    await getTenantObjectStorage().getSignedReadUrl({
      tenantId: input.tenantId,
      storageKey: input.storageKey,
      ttlSeconds: 60,
    });
    return true;
  } catch {
    return false;
  }
}
