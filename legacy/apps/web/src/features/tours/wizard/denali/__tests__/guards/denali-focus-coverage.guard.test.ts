/**
 * Structural guard: registry fields ↔ denaliWizardFieldFocus.
 */
import {
  verifyFocusMapOrphans,
  verifyRegistryFocusCoverage,
} from "@/features/tours/wizard/testing/wizard-testing-utils";
import { describeConfigStructuralGuard } from "@/features/tours/wizard/testing/structural-guard";

import { denaliTestConfig } from "@/features/tours/wizard/denali/wizardTestConfig.denali";

describeConfigStructuralGuard("denali focus coverage", denaliTestConfig, [
  {
    name: "every registry field with stepId has an entry in denaliWizardFieldFocus",
    verify: verifyRegistryFocusCoverage,
  },
  {
    name: "focus map keys only reference registered RHF paths",
    verify: verifyFocusMapOrphans,
  },
]);
