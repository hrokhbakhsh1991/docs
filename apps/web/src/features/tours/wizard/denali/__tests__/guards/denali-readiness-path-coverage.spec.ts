/**
 * Structural guard: publish-readiness issue codes must resolve to focusable form paths.
 */
import {
  verifyPublishReadinessActiveIssuesResolve,
  verifyPublishReadinessGeoMapsToSteps,
  verifyPublishReadinessPathFixtures,
  verifyPublishReadinessPayloadUnbuildableResolves,
} from "@/features/tours/wizard/testing/wizard-testing-utils";

import { denaliTestConfig } from "@/features/tours/wizard/denali/wizardTestConfig.denali";

const identityT = (key: string) => key;

describe("denali publish-readiness path coverage (structural guard)", () => {
  it("every blocking publish-readiness code has path resolution fixtures", () => {
    verifyPublishReadinessPathFixtures(denaliTestConfig);
  });

  it("DENALI_PUBLISH_PAYLOAD_UNBUILDABLE resolves path even when omitted on issue", () => {
    verifyPublishReadinessPayloadUnbuildableResolves(denaliTestConfig);
  });

  it("geo readiness from publish gate includes path and maps to wizard steps in review views", () => {
    verifyPublishReadinessGeoMapsToSteps(denaliTestConfig, identityT);
  });

  it("active publish gate issues always resolve paths", () => {
    verifyPublishReadinessActiveIssuesResolve(denaliTestConfig);
  });
});
