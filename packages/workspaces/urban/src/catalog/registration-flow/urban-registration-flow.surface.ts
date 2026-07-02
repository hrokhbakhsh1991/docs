import type { PublicCatalogTransportIntakeState } from "@app-tour/workspace-sdk";
import {
  initialPublicRegistrationOtp,
  initialPublicRegistrationPhone,
} from "@app-tour/catalog-registration-auth";
import type {
  FlowEvent,
  FlowRuntimeState,
  IntakeFlowDefinition,
  RegistrationFlowContext,
  WorkspaceCatalogRegistrationFlowSurface,
} from "@app-tour/workspace-sdk";
import { resolveIntakeSchema } from "@app-tour/workspace-sdk";

export const URBAN_REGISTRATION_FLOW_STEPS = [
  "phone",
  "otp",
  "profile",
  "intake",
  "done",
] as const;

export type UrbanFlowData = {
  readonly phone: string;
  readonly otp: string;
  readonly challengeId: string;
  readonly onboardingToken: string;
  readonly displayName: string;
  readonly profileEmail: string;
  readonly sessionEmail: string;
  readonly sessionNationalId: string;
  readonly sessionFatherName: string;
  readonly sessionBirthDate: string;
  readonly savedSelfIntakeDefaults: {
    readonly name: string;
    readonly nationalId: string;
    readonly fatherName: string;
    readonly birthDate: string;
  };
  readonly intakeName: string;
  readonly intakeNationalId: string;
  readonly intakeFatherName: string;
  readonly intakeBirthDate: string;
  readonly intakeEmail: string;
  readonly partySize: string;
  readonly notes: string;
  readonly registrantTarget: "self" | "other";
  readonly transportState: PublicCatalogTransportIntakeState;
};

const DEFINITION: IntakeFlowDefinition = Object.freeze({
  initialStep: "phone",
  steps: URBAN_REGISTRATION_FLOW_STEPS,
});

function emptyTransportState(): PublicCatalogTransportIntakeState {
  return {
    optInPersonalCar: false,
    hasPersonalCar: null,
    personalCarOccupants: null,
    paysDong: null,
  };
}

function createEmptyData(): UrbanFlowData {
  return {
    phone: initialPublicRegistrationPhone(),
    otp: initialPublicRegistrationOtp(),
    challengeId: "",
    onboardingToken: "",
    displayName: "",
    profileEmail: "",
    sessionEmail: "",
    sessionNationalId: "",
    sessionFatherName: "",
    sessionBirthDate: "",
    savedSelfIntakeDefaults: { name: "", nationalId: "", fatherName: "", birthDate: "" },
    intakeName: "",
    intakeNationalId: "",
    intakeFatherName: "",
    intakeBirthDate: "",
    intakeEmail: "",
    partySize: "1",
    notes: "",
    registrantTarget: "self",
    transportState: emptyTransportState(),
  };
}

export const urbanCatalogRegistrationFlowSurface: WorkspaceCatalogRegistrationFlowSurface =
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
    successDataAttributes: (_state, context) =>
      resolveIntakeSchema(context.pluginId).features.successDataAttributes ?? {},
  });

export function readUrbanFlowData(state: FlowRuntimeState): UrbanFlowData {
  return state.data as UrbanFlowData;
}
