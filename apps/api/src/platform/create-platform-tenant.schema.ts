import { z } from "zod";

import { PlatformValidation } from "./platform.errors.ts";

const subdomainSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "invalid subdomain");

export const createPlatformTenantBodySchema = z
  .object({
    subdomain: subdomainSchema,
    workspaceType: z.string().min(1),
    ownerPhone: z.string().min(8),
    ownerNameNote: z.string().optional(),
    displayName: z.string().optional(),
    theme: z.record(z.string(), z.unknown()).optional(),
    ownerEmail: z.string().email().optional(),
  })
  .strict();

export type CreatePlatformTenantBody = z.infer<typeof createPlatformTenantBodySchema>;

export function parseCreatePlatformTenantBody(raw: unknown): CreatePlatformTenantBody {
  const result = createPlatformTenantBodySchema.safeParse(raw);
  if (!result.success) {
    throw new PlatformValidation(result.error.message);
  }
  return result.data;
}
