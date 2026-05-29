import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { denaliFormToCanonical } from "../adapters/denaliCanonicalFormAdapter";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import { prepareDenaliWizardFormForSubmit } from "../normalize/invariantState";
import type { DenaliRuleSet } from "../rules/denaliRuleModel";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import { denaliCanonicalTourSchema } from "../schemas/denaliCanonicalTourSchema.unified";

/** Canonical validation issues for a wizard form (no throw). */
export function safeParseDenaliCanonicalFromWizardForm(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): ReturnType<typeof denaliCanonicalTourSchema.safeParse> {
  const normalized = prepareDenaliWizardFormForSubmit(form, ruleSet);
  const canonical = denaliFormToCanonical(normalized);
  return denaliCanonicalTourSchema.safeParse(canonical);
}

export function parseDenaliCanonicalFromWizardForm(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliCanonicalTourModel {
  const result = safeParseDenaliCanonicalFromWizardForm(form, ruleSet);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
