import type { PublicCatalogTransportSnapshot } from "../tour/public-catalog-transport";

export type RegistrationFlowTourRequirements = {
  readonly nationalIdRequired?: boolean;
  readonly fatherNameRequired?: boolean;
  readonly birthDateRequired?: boolean;
};

export type RegistrationFlowContext = {
  readonly pluginId: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly tourPoliciesText?: string | null;
  readonly tourPriceAmount?: number | null;
  readonly tourTransport?: PublicCatalogTransportSnapshot;
  readonly tourRequirements?: RegistrationFlowTourRequirements;
  readonly backHref: string;
  /** GSH-resolved member module URL — workspace done steps MUST use this (DL-38). */
  readonly memberModuleHref: string;
};

export type IntakeFlowDefinition = {
  readonly initialStep: string;
  readonly steps: readonly string[];
};

export type FlowRuntimeState = {
  readonly currentStep: string;
  readonly data: Readonly<Record<string, unknown>>;
};

export type FlowEvent =
  | { readonly type: "transition"; readonly to: string }
  | { readonly type: "merge"; readonly patch: Readonly<Record<string, unknown>> };

export type FlowValidationIssue = {
  readonly stepId: string;
  readonly code: string;
};

export type FlowSubmitPayload = Readonly<Record<string, unknown>>;

export type RegistrationFlowDispatch = (event: FlowEvent) => void;

export type RegistrationFlowStepProps = {
  readonly context: RegistrationFlowContext;
  readonly state: FlowRuntimeState;
  readonly dispatch: RegistrationFlowDispatch;
  readonly resolveError: (code: string) => string;
};

export function mergeFlowState(
  _state: FlowRuntimeState,
  dispatch: RegistrationFlowDispatch,
  patch: Readonly<Record<string, unknown>>
): void {
  dispatch({ type: "merge", patch });
}

export function transitionFlowStep(dispatch: RegistrationFlowDispatch, stepId: string): void {
  dispatch({ type: "transition", to: stepId });
}

/** Workspace-owned catalog registration interaction flow (state machine — no React). */
export type WorkspaceCatalogRegistrationFlowSurface = {
  readonly definition: IntakeFlowDefinition;
  readonly createInitialState: (context: RegistrationFlowContext) => FlowRuntimeState;
  readonly resolveNextStep: (
    state: FlowRuntimeState,
    event: FlowEvent,
    context: RegistrationFlowContext
  ) => FlowRuntimeState;
  readonly validateStep?: (
    stepId: string,
    state: FlowRuntimeState,
    context: RegistrationFlowContext
  ) => readonly FlowValidationIssue[];
  readonly submitTransform?: (
    state: FlowRuntimeState,
    context: RegistrationFlowContext
  ) => FlowSubmitPayload;
  readonly successDataAttributes?: (
    state: FlowRuntimeState,
    context: RegistrationFlowContext
  ) => Readonly<Record<string, boolean>>;
};
