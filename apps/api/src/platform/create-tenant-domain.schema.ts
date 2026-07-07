import { z } from "zod";

import { PlatformValidation } from "./platform.errors.ts";

export const createTenantDomainBodySchema = z
  .object({
    hostname: z
      .string()
      .min(3)
      .max(255)
      .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i, "invalid hostname"),
    surface: z.enum(["marketing", "portal"]).optional(),
  })
  .strict();

export type CreateTenantDomainBody = z.infer<typeof createTenantDomainBodySchema>;

export function parseCreateTenantDomainBody(raw: unknown): CreateTenantDomainBody {
  const result = createTenantDomainBodySchema.safeParse(raw);
  if (!result.success) {
    throw new PlatformValidation(result.error.message);
  }
  return result.data;
}
