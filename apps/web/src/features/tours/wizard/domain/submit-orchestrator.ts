import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import { sanitizeDenaliWizardCatalogRefs } from "@/features/tours/wizard/denali/sanitizeDenaliWizardCatalogRefs";
import { prepareDenaliWizardFormForSubmit } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { pruneDenaliWizardFormForSubmit } from "./buildDenaliCreateTourPayloadProjection";

export type PrepareDenaliSubmitArtifactOptions = {
  ruleSet: DenaliRuleSet;
  workspaceId?: string | null;
  catalog: {
    destinationIds: ReadonlySet<string>;
    themeIds: ReadonlySet<string>;
  };
};

/**
 * Single submit-grade wizard artifact: prepare → registry prune → invariants → catalog sanitize.
 * Gate and create mutation must share the exact object reference returned here.
 */
export function prepareDenaliSubmitArtifact(
  rawForm: DenaliCreateTourWizardForm,
  options: PrepareDenaliSubmitArtifactOptions,
): DenaliCreateTourWizardForm {
  const prepared = prepareDenaliWizardFormForSubmit(rawForm, options.ruleSet);
  const pruned = pruneDenaliWizardFormForSubmit(prepared, {
    workspaceId: options.workspaceId,
  });
  const invariant = applyDenaliInvariantState(pruned, undefined, options.ruleSet);
  return sanitizeDenaliWizardCatalogRefs(invariant, options.catalog).form;
}
