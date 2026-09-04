/**
 * Ticketing attachment HTTP contracts — TKT-001 Phase E1.
 */
import { z } from "zod";

import { uuidSchema, parseWithZod } from "./ticketing-validation";

export const TICKET_ATTACHMENT_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const ticketAttachmentIntentInputSchema = z
  .object({
    messageId: uuidSchema,
    originalFileName: z.string().trim().min(1).max(255),
    contentType: z.enum(TICKET_ATTACHMENT_ALLOWED_CONTENT_TYPES),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export type TicketAttachmentIntentInput = z.infer<typeof ticketAttachmentIntentInputSchema>;

export const ticketAttachmentIntentResponseSchema = z.object({
  attachmentId: uuidSchema,
  expiresAt: z.string().datetime(),
});

export type TicketAttachmentIntentResponse = z.infer<typeof ticketAttachmentIntentResponseSchema>;

export const ticketAttachmentCompleteResponseSchema = z.object({
  id: uuidSchema,
  ticketId: uuidSchema,
  messageId: uuidSchema,
  originalFileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
  scanStatus: z.literal("clean"),
  uploadedAt: z.string().datetime(),
  readUrl: z.string().url().optional(),
});

export type TicketAttachmentCompleteResponse = z.infer<typeof ticketAttachmentCompleteResponseSchema>;

export const ticketAttachmentDownloadResponseSchema = z.object({
  readUrl: z.string(),
  expiresAt: z.string().datetime(),
});

export type TicketAttachmentDownloadResponse = z.infer<typeof ticketAttachmentDownloadResponseSchema>;

export type TicketAttachmentHttp = {
  readonly id: string;
  readonly ticketId: string;
  readonly messageId: string | null;
  readonly originalFileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly scanStatus: string;
  readonly uploadedAt: string | null;
  readonly createdAt: string;
};

export function parseTicketAttachmentIntentInput(raw: unknown): TicketAttachmentIntentInput {
  return parseWithZod(ticketAttachmentIntentInputSchema, raw, "attachment intent");
}
