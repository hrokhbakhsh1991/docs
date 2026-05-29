/**
 * Structural guard: every registry rhfPath is representable in the draft snapshot pipeline.
 */
import { verifyRegistryDraftRepresentability } from "@/features/tours/wizard/testing/wizard-testing-utils";

import { denaliTestConfig } from "@/features/tours/wizard/denali/wizardTestConfig.denali";

describe("denali draft registry coverage (structural guard)", () => {
  it("every registry rhfPath survives sanitizeDenaliWizardDraftSnapshot", () => {
    verifyRegistryDraftRepresentability(denaliTestConfig);
  });
});
