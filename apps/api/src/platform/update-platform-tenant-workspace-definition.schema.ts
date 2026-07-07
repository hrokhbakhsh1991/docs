import { z } from "zod";

import { PlatformValidation } from "./platform.errors.ts";

export const updatePlatformTenantWorkspaceDefinitionBodySchema = z
  .object({
    definitionId: z.string().min(1).nullable(),
    definitionVersion: z.number().int().positive().nullable().optional(),
  })
  .strict();

export type UpdatePlatformTenantWorkspaceDefinitionBody = z.infer<
  typeof updatePlatformTenantWorkspaceDefinitionBodySchema
>;

export function parseUpdatePlatformTenantWorkspaceDefinitionBody(
  raw: unknown
): UpdatePlatformTenantWorkspaceDefinitionBody {
  const result = updatePlatformTenantWorkspaceDefinitionBodySchema.safeParse(raw);
  if (!result.success) {
    throw new PlatformValidation(result.error.message);
  }
  return result.data;
}
