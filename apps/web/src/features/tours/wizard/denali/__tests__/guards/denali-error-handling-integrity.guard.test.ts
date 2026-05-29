/**
 * Structural guard: blocking publish-readiness codes ↔ registry or focus-map paths.
 */
import { verifyErrorHandlingIntegrity } from "@/features/tours/wizard/testing/wizard-testing-utils";
import { describeConfigStructuralGuard } from "@/features/tours/wizard/testing/structural-guard";

import { denaliTestConfig } from "@/features/tours/wizard/denali/wizardTestConfig.denali";

describeConfigStructuralGuard("denali error-handling integrity", denaliTestConfig, [
  {
    name: "blocking codes map to registry-known or focusable rhf paths",
    verify: verifyErrorHandlingIntegrity,
  },
]);
