/**
 * Shared wallet HTTP validation helpers (Phase 2D).
 */
import { z } from "zod";

export const minorAmountSchema = z
  .string()
  .regex(/^\d+$/, "amount must be minor-unit integer string");

export const currencySchema = z.string().min(3).max(8);

export const uuidSchema = z.string().uuid();

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
