/**
 * Submit validation — canonical schema only.
 *
 * Runtime: form → {@link denaliFormToCanonical} → {@link ../schemas/denaliCanonicalTourSchema.unified}.
 */

import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import { ZodError } from "zod";
import { fromError } from "zod-validation-error";

import { denaliFormToCanonical } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { prepareDenaliWizardFormForSubmit } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { denaliCanonicalTourSchema } from "@/features/tours/wizard/schemas/denaliCanonicalTourSchema.unified";

/** User-facing message for canonical submit validation failures. */
export function formatDenaliCanonicalValidationError(error: ZodError): string {
  return fromError(error, { prefix: "Denali tour validation" }).toString();
}

/**
 * Canonical validation issues for a wizard form (no throw).
 */
export function safeParseDenaliCanonicalFromWizardForm(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): ReturnType<typeof denaliCanonicalTourSchema.safeParse> {
  const normalized = prepareDenaliWizardFormForSubmit(form, ruleSet);
  const canonical = denaliFormToCanonical(normalized);
  return denaliCanonicalTourSchema.safeParse(canonical);
}

/**
 * Submit gate: map legacy form shell → canonical, validate with unified canonical schema only.
 * @throws {ValidationError} when canonical validation fails (wraps {@link ZodError} with readable message).
 */
export function parseDenaliCanonicalFromWizardForm(
  form: DenaliCreateTourWizardForm,
): DenaliCanonicalTourModel {
  const result = safeParseDenaliCanonicalFromWizardForm(form);
  if (!result.success) {
    throw fromError(result.error, { prefix: "Denali tour validation" });
  }
  return result.data;
}
