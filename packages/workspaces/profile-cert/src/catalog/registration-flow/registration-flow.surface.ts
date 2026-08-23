import type {
  FlowEvent,
  FlowRuntimeState,
  IntakeFlowDefinition,
  RegistrationFlowContext,
} from "@app-tour/workspace-sdk";
import { defineCatalogRegistrationFlowSurface } from "@app-tour/workspace-sdk";

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
  ): FlowRuntimeState => {
    if (event.type === "merge") {
      return Object.freeze({
        currentStep: state.currentStep,
        data: Object.freeze({ ...state.data, ...event.patch }),
      });
    }
    if (event.type === "transition") {
      return Object.freeze({ currentStep: event.to, data: state.data });
    }
    return state;
  },
  successDataAttributes: () => Object.freeze({ "data-profile-cert-registration-success": true }),
});
