import type { FlowRuntimeState, PublicCatalogTransportIntakeState } from "@app-tour/workspace-sdk";

export type CatalogRegistrationFlowData = {
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

export function readCatalogRegistrationFlowData(state: FlowRuntimeState): CatalogRegistrationFlowData {
  return state.data as CatalogRegistrationFlowData;
}
