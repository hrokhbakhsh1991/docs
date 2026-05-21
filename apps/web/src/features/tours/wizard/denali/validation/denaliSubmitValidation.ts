/**
 * Submit validation — canonical schema only.
 *
 * Runtime: form → {@link denaliFormToCanonical} → {@link denaliCanonicalTourSchema}.
 */

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { denaliFormToCanonical } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { denaliCanonicalTourSchema } from "@/features/tours/wizard/schemas/denaliCanonicalTourSchema";

/**
 * Canonical validation issues for a wizard form (no throw).
 */
export function safeParseDenaliCanonicalFromWizardForm(
  form: DenaliCreateTourWizardForm,
): ReturnType<typeof denaliCanonicalTourSchema.safeParse> {
  const normalized = normalizeDenaliWizardForm(form);
  const canonical = denaliFormToCanonical(normalized);
  return denaliCanonicalTourSchema.safeParse(canonical);
}

/**
 * Submit gate: map legacy form shell → canonical, validate with {@link denaliCanonicalTourSchema} only.
 * @throws {z.ZodError} when canonical validation fails.
 */
export function parseDenaliCanonicalFromWizardForm(
  form: DenaliCreateTourWizardForm,
): DenaliCanonicalTourModel {
  const result = safeParseDenaliCanonicalFromWizardForm(form);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
