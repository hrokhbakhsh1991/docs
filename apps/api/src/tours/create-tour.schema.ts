import { z } from "zod";

/** Aligns with workspace-sdk AUTH_SCOPE_ID_PATTERN. */
const authScopeIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, "invalid auth scope id");

const canonicalDataSchema = z.record(z.string(), z.unknown());

export const createTourBodySchema = z
  .object({
    tenantId: authScopeIdSchema.optional(),
    schemaVersion: z.number().int().positive().optional(),
    roots: z.array(z.string().min(1)).min(1).optional(),
    data: canonicalDataSchema.optional(),
  })
  .strict();

export type CreateTourBody = z.infer<typeof createTourBodySchema>;

export function parseCreateTourBody(raw: unknown): CreateTourBody {
  const result = createTourBodySchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`ZOD_VALIDATION_FAILED: ${message}`);
  }
  return result.data;
}
