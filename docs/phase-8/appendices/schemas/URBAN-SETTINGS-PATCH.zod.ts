/**
 * Phase 8.1 contract — canonical source for apps/api/src/urban/schemas/urban-settings-patch.schema.ts
 * Authority: docs/phase-8/appendices/urban-api-dispatch-addendum.md §4
 */
import { z } from "zod";

const urbanCatalogSlugSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,64}$/, "slug must match ^[a-z0-9-]{1,64}$");

const urbanCatalogPatchSchema = z
  .object({
    publicEnabled: z.boolean(),
    slug: urbanCatalogSlugSchema,
  })
  .strict();

const urbanRegistrationPolicySchema = z.enum(["open", "waitlist", "closed"]);

const urbanRegistrationPatchSchema = z
  .object({
    policy: urbanRegistrationPolicySchema,
    requirePhone: z.boolean().optional(),
    confirmationMessage: z.string().max(1000).optional(),
  })
  .strict();

const urbanSettingsPatchUrbanSchema = z
  .object({
    catalog: urbanCatalogPatchSchema,
    registration: urbanRegistrationPatchSchema,
  })
  .strict();

export const urbanSettingsPatchBodySchema = z
  .object({
    urban: urbanSettingsPatchUrbanSchema,
  })
  .strict();

export type UrbanSettingsPatchBody = z.infer<typeof urbanSettingsPatchBodySchema>;

export function parseUrbanSettingsPatchBody(raw: unknown): UrbanSettingsPatchBody {
  const result = urbanSettingsPatchBodySchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`ZOD_VALIDATION_FAILED: ${message}`);
  }
  return result.data;
}
