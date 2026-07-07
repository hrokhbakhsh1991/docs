import { z } from "zod";

import { PlatformValidation } from "./platform.errors.ts";

const definitionIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9-]*$/i, "invalid definition id");

export const createPlatformWorkspaceDefinitionBodySchema = z
  .object({
    id: definitionIdSchema,
    displayName: z.string().min(1).max(256),
  })
  .strict();

export type CreatePlatformWorkspaceDefinitionBody = z.infer<
  typeof createPlatformWorkspaceDefinitionBodySchema
>;

export function parseCreatePlatformWorkspaceDefinitionBody(
  raw: unknown
): CreatePlatformWorkspaceDefinitionBody {
  const result = createPlatformWorkspaceDefinitionBodySchema.safeParse(raw);
  if (!result.success) {
    throw new PlatformValidation(result.error.message);
  }
  return result.data;
}
