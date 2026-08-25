import type {
  FlowEvent,
  FlowRuntimeState,
  IntakeFlowDefinition,
  RegistrationFlowContext,
} from "@app-tour/workspace-sdk";
import {
  applyCatalogRegistrationFlowEvent,
  defineCatalogRegistrationFlowSurface,
} from "@app-tour/workspace-sdk";

const STEPS = ["phone", "otp", "profile", "intake", "done"] as const;

const DEFINITION: IntakeFlowDefinition = Object.freeze({
  initialStep: "phone",
  steps: STEPS,
});

export const profileCertCatalogRegistrationFlowSurface = defineCatalogRegistrationFlowSurface({
  definition: DEFINITION,
  resolveNextStep: (
    state: FlowRuntimeState,
    event: FlowEvent,
    _context: RegistrationFlowContext
  ): FlowRuntimeState => applyCatalogRegistrationFlowEvent(state, event),
  successDataAttributes: () => Object.freeze({ "data-profile-cert-registration-success": true }),
});
