import { z } from "zod";

const tenantUuidSchema = z.string().uuid({ message: "tenantId must be a valid UUID" });

const subdomainSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "invalid subdomain");

export const provisionTenantBodySchema = z
  .object({
    tenantId: tenantUuidSchema,
    subdomain: subdomainSchema,
    workspaceType: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    theme: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type ProvisionTenantBody = z.infer<typeof provisionTenantBodySchema>;

export function parseProvisionTenantBody(raw: unknown): ProvisionTenantBody {
  const result = provisionTenantBodySchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`ZOD_VALIDATION_FAILED: ${message}`);
  }
  return result.data;
}
