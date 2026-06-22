import {
  applyDenaliInvariantState,
  buildDenaliTourCreateDefaultValues,
  DENALI_CANONICAL_TO_FORM_PATH_MAP,
  DENALI_TOUR_KIND_VALUES,
  evaluateFormFieldRule,
  readDenaliCanonicalBasics,
  resolveDenaliRuleSetFromTemplate,
} from "@app-tour/workspace-denali/plugin";

const DENALI_WIZARD_RULES_MODULE_SYNC = Object.freeze({
  evaluateFormFieldRule,
  applyDenaliInvariantState,
  resolveDenaliRuleSetFromTemplate,
  buildDefaultForm: buildDenaliTourCreateDefaultValues,
  readCanonicalBasics: readDenaliCanonicalBasics,
  canonicalToFormPathMap: DENALI_CANONICAL_TO_FORM_PATH_MAP,
  tourKindValues: DENALI_TOUR_KIND_VALUES,
});

/** Sync rules bundle for API publish-readiness validation (mirrors web rules-loader). */
export function getDenaliWizardRulesModuleSync(): typeof DENALI_WIZARD_RULES_MODULE_SYNC {
  return DENALI_WIZARD_RULES_MODULE_SYNC;
}
