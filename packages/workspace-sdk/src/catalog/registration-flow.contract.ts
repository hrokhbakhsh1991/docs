import type { CatalogRegistrationFlowState } from "@app-tour/catalog-registration-auth";
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
  readonly memberModuleHref: string | null;
  /**
   * SSR-stable login egress — set by portal login host / login modal; never derive from `window`
   * during render (PCMS-UX-HYDRATE). Stepper: phone → otp → profile only.
   */
  readonly memberLoginEgress?: boolean;
  /**
   * When true with `memberLoginEgress`, after cookie probe call `onMemberLoginSessionReady`
   * instead of `location.assign(portalReturn)` (register-host modal — PCMS-UX-MODAL-03).
   */
  readonly memberLoginStayOnPage?: boolean;
  /** Register-host modal success — close modal + resume intake on page. */
  readonly onMemberLoginSessionReady?: () => void | Promise<void>;
  /**
   * When set, member already has an active **self** registration on this tour —
   * intake UI must not offer self again (gate to `/me/registrations/{id}`).
   */
  readonly existingSelfRegistrationId?: string | null;
};

export type IntakeFlowDefinition = {
  readonly initialStep: string;
  readonly steps: readonly string[];
};

export type FlowRuntimeState = {
  readonly currentStep: string;
  readonly data: CatalogRegistrationFlowState;
};

export type FlowEvent =
  | { readonly type: "transition"; readonly to: string }
  | { readonly type: "merge"; readonly patch: Partial<CatalogRegistrationFlowState> };

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
  patch: Partial<CatalogRegistrationFlowState>
): void {
  dispatch({ type: "merge", patch });
}

export function transitionFlowStep(dispatch: RegistrationFlowDispatch, stepId: string): void {
  dispatch({ type: "transition", to: stepId });
}

/** Canonical merge/transition reducer — workspace surfaces must not reimplement. */
export function applyCatalogRegistrationFlowEvent(
  state: FlowRuntimeState,
  event: FlowEvent
): FlowRuntimeState {
  if (event.type === "merge") {
    return Object.freeze({
      currentStep: state.currentStep,
      data: Object.freeze({ ...state.data, ...event.patch }),
    });
  }
  if (event.type === "transition") {
    return Object.freeze({
      currentStep: event.to,
      data: state.data,
    });
  }
  return state;
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
