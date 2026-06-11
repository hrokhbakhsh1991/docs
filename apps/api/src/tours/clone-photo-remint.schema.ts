import { z } from "zod";

const remintPlanEntrySchema = z
  .object({
    sourceStorageKey: z.string().min(1),
    destStorageKey: z.string().min(1),
    oldPhotoId: z.string().min(1),
    newPhotoId: z.string().min(1),
    contentType: z.string().min(1).optional(),
  })
  .strict();

export const clonePhotoRemintBodySchema = z
  .object({
    plan: z.array(remintPlanEntrySchema).max(10),
  })
  .strict();

export type ClonePhotoRemintBody = z.infer<typeof clonePhotoRemintBodySchema>;

export function parseClonePhotoRemintBody(raw: unknown): ClonePhotoRemintBody {
  const result = clonePhotoRemintBodySchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`ZOD_VALIDATION_FAILED: ${message}`);
  }
  return result.data;
}
