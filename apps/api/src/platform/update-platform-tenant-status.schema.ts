import { z } from "zod";

import { PlatformValidation } from "./platform.errors.ts";

export const platformTenantStatusSchema = z.enum(["active", "suspended"]);

export const updatePlatformTenantStatusBodySchema = z
  .object({
    status: platformTenantStatusSchema,
  })
  .strict();

export type UpdatePlatformTenantStatusBody = z.infer<typeof updatePlatformTenantStatusBodySchema>;

export function parseUpdatePlatformTenantStatusBody(raw: unknown): UpdatePlatformTenantStatusBody {
  const result = updatePlatformTenantStatusBodySchema.safeParse(raw);
  if (!result.success) {
    throw new PlatformValidation(result.error.message);
  }
  return result.data;
}
