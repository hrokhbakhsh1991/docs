/**
 * Structural guard: blocking publish-readiness codes resolve to registry or focus-map paths.
 */
import { verifyErrorHandlingIntegrity } from "@/features/tours/wizard/testing/wizard-testing-utils";

import { denaliTestConfig } from "@/features/tours/wizard/denali/wizardTestConfig.denali";

describe("denali error-handling integrity (structural guard)", () => {
  it("blocking codes map to registry-known or focusable rhf paths", () => {
    verifyErrorHandlingIntegrity(denaliTestConfig);
  });
});
