import { readDenaliCanonicalBasics } from "../adapters/canonical-basics";
import { applyDenaliInvariantState } from "../normalize/invariantState";
import { resolveDenaliRuleSetFromTemplate } from "../normalize/resolveRuleModel";
import {
  evaluateFormFieldRule,
  type EvaluateFormRulesOptions,
} from "../rules/evaluateFormRules";
import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../rules/generated/denaliCanonicalPathMap.generated";
import type { DenaliRuleFieldStep } from "../rules/denaliRuleModel";
import type { DenaliCreateWizardStepId } from "../layout/stepIds";
import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import { DENALI_TOUR_KIND_VALUES } from "../types/legacy/repo-types";

import type { CanonicalWizardDraftEnvelope } from "./canonical-draft-access";
import { tourWizardDraftToDenaliForm } from "./denali-wizard-form-adapter";
import type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";

let cachedRulesModule: DenaliWizardRulesModule | null = null;

/** Sync rules snapshot for draft-only callers (prefill, review) — same surface as wizard host. */
export function getDenaliWizardRulesModuleSnapshot(): DenaliWizardRulesModule {
  if (cachedRulesModule != null) {
    return cachedRulesModule;
  }
  cachedRulesModule = Object.freeze({
    evaluateFormFieldRule,
    applyDenaliInvariantState,
    resolveDenaliRuleSetFromTemplate,
    buildDefaultForm: buildDenaliTourCreateDefaultValues,
    readCanonicalBasics: readDenaliCanonicalBasics,
    canonicalToFormPathMap: DENALI_CANONICAL_TO_FORM_PATH_MAP,
    tourKindValues: DENALI_TOUR_KIND_VALUES,
  });
  return cachedRulesModule;
}

/**
 * Matrix + contextual visibility for a canonical path on a wizard draft envelope.
 * Single source of truth — delegates to {@link evaluateFormFieldRule}.
 */
export function isDenaliWizardFieldVisibleOnDraft(
  draft: CanonicalWizardDraftEnvelope,
  canonicalPath: string,
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
  options?: EvaluateFormRulesOptions
): boolean {
  const rules = getDenaliWizardRulesModuleSnapshot();
  const form = tourWizardDraftToDenaliForm(draft, rules);
  return evaluateFormFieldRule(form, canonicalPath, step, options).visible;
}
