import type {
  FlowEvent,
  FlowRuntimeState,
  IntakeFlowDefinition,
  RegistrationFlowContext,
  WorkspaceCatalogRegistrationFlowSurface,
} from "@app-tour/workspace-sdk";

const STEPS = ["phone", "otp", "profile", "intake", "done"] as const;

const DEFINITION: IntakeFlowDefinition = Object.freeze({
  initialStep: "phone",
  steps: STEPS,
});

function createEmptyData(): Readonly<Record<string, unknown>> {
  return Object.freeze({ fullName: "", email: "", partySize: "1", notes: "" });
}

export const guestClubCatalogRegistrationFlowSurface: WorkspaceCatalogRegistrationFlowSurface =
  Object.freeze({
    definition: DEFINITION,
    createInitialState: (_context: RegistrationFlowContext): FlowRuntimeState =>
      Object.freeze({ currentStep: DEFINITION.initialStep, data: createEmptyData() }),
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
    successDataAttributes: () => Object.freeze({ "data-guest-club-registration-success": true }),
  });
