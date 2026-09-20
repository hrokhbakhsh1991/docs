/**
 * Shared ticketing HTTP validation helpers — TKT-001 Phase 1.
 */
import { z } from "zod";

import {
  TICKET_BODY_MAX_LENGTH,
  TICKET_BODY_MIN_LENGTH,
  TICKET_CATEGORY_CODE_MAX_LENGTH,
  TICKET_CATEGORY_CODE_MIN_LENGTH,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_SUBJECT_MAX_LENGTH,
  TICKET_SUBJECT_MIN_LENGTH,
} from "./ticketing-enums";

export const uuidSchema = z.string().uuid();

export const ticketStatusSchema = z.enum(TICKET_STATUSES);

export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);

/**
 * Stable category code — ASCII slug; labels come from workspace manifest.
 * Rejects Persian/Unicode labels masquerading as codes.
 */
export const categoryCodeSchema = z
  .string()
  .trim()
  .min(TICKET_CATEGORY_CODE_MIN_LENGTH)
  .max(TICKET_CATEGORY_CODE_MAX_LENGTH)
  .regex(
    /^[a-z][a-z0-9_-]*$/,
    "categoryCode must be lowercase ASCII slug (a-z, 0-9, _, -)",
  );

export const ticketSubjectSchema = z
  .string()
  .trim()
  .min(TICKET_SUBJECT_MIN_LENGTH)
  .max(TICKET_SUBJECT_MAX_LENGTH);

export const ticketBodySchema = z
  .string()
  .trim()
  .min(TICKET_BODY_MIN_LENGTH)
  .max(TICKET_BODY_MAX_LENGTH);

export const rowVersionSchema = z.number().int().positive();

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}

export function parseWithZod<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  label: string,
): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${label}: ${formatZodError(result.error)}`);
  }
  return result.data;
}
