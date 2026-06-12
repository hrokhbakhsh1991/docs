import type { evaluateFormFieldRule } from "../rules/evaluateFormRules";
import type { applyDenaliInvariantState } from "../normalize/invariantState";
import type { resolveDenaliRuleSetFromTemplate } from "../normalize/resolveRuleModel";
import type { readDenaliCanonicalBasics } from "../adapters/canonical-basics";
import type { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import type { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../rules/generated/denaliCanonicalPathMap.generated";
import type { DENALI_TOUR_KIND_VALUES } from "../types/legacy/repo-types";

export type DenaliWizardRulesModule = {
  readonly evaluateFormFieldRule: typeof evaluateFormFieldRule;
  readonly applyDenaliInvariantState: typeof applyDenaliInvariantState;
  readonly resolveDenaliRuleSetFromTemplate: typeof resolveDenaliRuleSetFromTemplate;
  readonly buildDefaultForm: typeof buildDenaliTourCreateDefaultValues;
  readonly readCanonicalBasics: typeof readDenaliCanonicalBasics;
  readonly canonicalToFormPathMap: typeof DENALI_CANONICAL_TO_FORM_PATH_MAP;
  readonly tourKindValues: typeof DENALI_TOUR_KIND_VALUES;
};
