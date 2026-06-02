/**
 * Structural guard: publish-readiness issue codes resolve to focusable form paths.
 */
import {
  verifyPublishReadinessActiveIssuesResolve,
  verifyPublishReadinessGeoMapsToSteps,
  verifyPublishReadinessPathFixtures,
  verifyPublishReadinessPayloadUnbuildableResolves,
} from "@/features/tours/wizard/testing/wizard-testing-utils";
import { describeConfigStructuralGuard } from "@/features/tours/wizard/testing/structural-guard";

import { denaliTestConfig } from "@/features/tours/wizard/denali/wizardTestConfig.denali";

const identityT = (key: string) => key;

describeConfigStructuralGuard("denali publish-readiness path coverage", denaliTestConfig, [
  {
    name: "every blocking publish-readiness code has path resolution fixtures",
    verify: verifyPublishReadinessPathFixtures,
  },
  {
    name: "DENALI_PUBLISH_PAYLOAD_UNBUILDABLE resolves path even when omitted on issue",
    verify: verifyPublishReadinessPayloadUnbuildableResolves,
  },
  {
    name: "geo readiness from publish gate includes path and maps to wizard steps in review views",
    verify: (config) => verifyPublishReadinessGeoMapsToSteps(config, identityT),
  },
  {
    name: "active publish gate issues always resolve paths",
    verify: verifyPublishReadinessActiveIssuesResolve,
  },
]);
