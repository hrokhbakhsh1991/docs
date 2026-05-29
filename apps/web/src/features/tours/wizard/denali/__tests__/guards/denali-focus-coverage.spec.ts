/**
 * Structural guard: every registry field assigned to a wizard step must be focusable
 * from review validation / publish-readiness links via {@link denaliWizardFieldFocus}.
 */
import {
  verifyFocusMapOrphans,
  verifyRegistryFocusCoverage,
} from "@/features/tours/wizard/testing/wizard-testing-utils";

import { denaliTestConfig } from "@/features/tours/wizard/denali/wizardTestConfig.denali";

describe("denali focus coverage (structural guard)", () => {
  it("every registry field with stepId has an entry in denaliWizardFieldFocus", () => {
    verifyRegistryFocusCoverage(denaliTestConfig);
  });

  it("focus map keys only reference registered RHF paths", () => {
    verifyFocusMapOrphans(denaliTestConfig);
  });
});
