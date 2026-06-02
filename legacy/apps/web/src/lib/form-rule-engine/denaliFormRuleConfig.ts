import type { RuleConfig } from "@repo/shared";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { LOOKUP_PROVIDER_IDS } from "./lookupProviderIds";

/**
 * Denali wizard fields that use {@link FormRuleEngine} lookups / dependencies.
 * Visibility/required for Denali still come from `denaliRuleSet` + `evaluateFormRules`;
 * this config is for autocomplete wiring only.
 */
export const DENALI_FORM_RULE_CONFIG: readonly RuleConfig<DenaliCreateTourWizardForm>[] = [
  {
    path: "basicInfo.destinationId",
    lookupProvider: LOOKUP_PROVIDER_IDS.destinationSearch,
    dependencies: ["basicInfo.tourType"],
    required: ({ form }) => typeof form.basicInfo.destinationId === "string",
  },
  {
    path: "photosData.photos",
    dependencies: ["participantRequirements.sportsInsuranceRequired"],
    required: ({ form }) => form.participantRequirements.sportsInsuranceRequired === true,
  },
];
