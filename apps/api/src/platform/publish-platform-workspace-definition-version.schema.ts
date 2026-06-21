import { z } from "zod";

import { PlatformValidation } from "./platform.errors.ts";

export const publishPlatformWorkspaceDefinitionVersionBodySchema = z
  .object({
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export type PublishPlatformWorkspaceDefinitionVersionBody = z.infer<
  typeof publishPlatformWorkspaceDefinitionVersionBodySchema
>;

export function parsePublishPlatformWorkspaceDefinitionVersionBody(
  raw: unknown
): PublishPlatformWorkspaceDefinitionVersionBody {
  const result = publishPlatformWorkspaceDefinitionVersionBodySchema.safeParse(raw);
  if (!result.success) {
    throw new PlatformValidation(result.error.message);
  }
  return result.data;
}
