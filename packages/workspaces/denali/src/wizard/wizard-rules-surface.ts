import {
  applyDenaliInvariantState,
  buildDenaliTourCreateDefaultValues,
  DENALI_CANONICAL_TO_FORM_PATH_MAP,
  DENALI_TOUR_KIND_VALUES,
  evaluateFormFieldRule,
  readDenaliCanonicalBasics,
  resolveDenaliRuleSetFromTemplate,
} from "../denali.plugin";

export type DenaliWizardRulesSurface = {
  readonly evaluateFormFieldRule: typeof evaluateFormFieldRule;
  readonly applyDenaliInvariantState: typeof applyDenaliInvariantState;
  readonly resolveDenaliRuleSetFromTemplate: typeof resolveDenaliRuleSetFromTemplate;
  readonly buildDenaliTourCreateDefaultValues: typeof buildDenaliTourCreateDefaultValues;
  readonly readDenaliCanonicalBasics: typeof readDenaliCanonicalBasics;
  readonly canonicalToFormPathMap: typeof DENALI_CANONICAL_TO_FORM_PATH_MAP;
  readonly tourKindValues: typeof DENALI_TOUR_KIND_VALUES;
};

export const denaliWizardRulesSurface: DenaliWizardRulesSurface = Object.freeze({
  evaluateFormFieldRule,
  applyDenaliInvariantState,
  resolveDenaliRuleSetFromTemplate,
  buildDenaliTourCreateDefaultValues,
  readDenaliCanonicalBasics,
  canonicalToFormPathMap: DENALI_CANONICAL_TO_FORM_PATH_MAP,
  tourKindValues: DENALI_TOUR_KIND_VALUES,
});
