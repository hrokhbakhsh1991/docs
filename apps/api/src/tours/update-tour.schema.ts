import { z } from "zod";

const canonicalDataSchema = z.record(z.string(), z.unknown());

export const updateTourBodySchema = z
  .object({
    rowVersion: z.number().int().positive(),
    schemaVersion: z.number().int().positive().optional(),
    roots: z.array(z.string().min(1)).min(1).optional(),
    data: canonicalDataSchema.optional(),
  })
  .strict();

export type UpdateTourBody = z.infer<typeof updateTourBodySchema>;

export function parseUpdateTourBody(raw: unknown): UpdateTourBody {
  const result = updateTourBodySchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`ZOD_VALIDATION_FAILED: ${message}`);
  }
  return result.data;
}
