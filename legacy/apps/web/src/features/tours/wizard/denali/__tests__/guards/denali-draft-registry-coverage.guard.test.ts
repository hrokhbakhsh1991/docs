/**
 * Structural guard: registry rhfPaths survive draft sanitize.
 */
import { verifyRegistryDraftRepresentability } from "@/features/tours/wizard/testing/wizard-testing-utils";
import { describeConfigStructuralGuard } from "@/features/tours/wizard/testing/structural-guard";

import { denaliTestConfig } from "@/features/tours/wizard/denali/wizardTestConfig.denali";

describeConfigStructuralGuard("denali draft registry coverage", denaliTestConfig, [
  {
    name: "every registry rhfPath survives sanitizeDenaliWizardDraftSnapshot",
    verify: verifyRegistryDraftRepresentability,
  },
]);
