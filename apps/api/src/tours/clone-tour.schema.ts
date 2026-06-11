import { z } from "zod";

export const cloneTourBodySchema = z
  .object({
    activeEquipmentIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type CloneTourBody = z.infer<typeof cloneTourBodySchema>;

export function parseCloneTourBody(raw: unknown): CloneTourBody {
  const result = cloneTourBodySchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`ZOD_VALIDATION_FAILED: ${message}`);
  }
  return result.data;
}
