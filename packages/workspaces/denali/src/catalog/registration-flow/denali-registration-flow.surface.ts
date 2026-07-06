import {
  readCatalogRegistrationFlowState,
  type CatalogRegistrationFlowState,
} from "@app-tour/catalog-registration-auth";
import type {
  FlowEvent,
  FlowRuntimeState,
  IntakeFlowDefinition,
  RegistrationFlowContext,
} from "@app-tour/workspace-sdk";
import { defineCatalogRegistrationFlowSurface, applyCatalogRegistrationFlowEvent, resolveIntakeSchema } from "@app-tour/workspace-sdk";

export const DENALI_REGISTRATION_FLOW_STEPS = [
  "phone",
  "otp",
  "profile",
  "intake",
  "done",
] as const;

export type DenaliRegistrationFlowStepId = (typeof DENALI_REGISTRATION_FLOW_STEPS)[number];

/** @deprecated Use CatalogRegistrationFlowState from @app-tour/catalog-registration-auth */
export type DenaliFlowData = CatalogRegistrationFlowState;

const DEFINITION: IntakeFlowDefinition = Object.freeze({
  initialStep: "phone",
  steps: DENALI_REGISTRATION_FLOW_STEPS,
});

export const denaliCatalogRegistrationFlowSurface = defineCatalogRegistrationFlowSurface({
  definition: DEFINITION,
  resolveNextStep: (
    state: FlowRuntimeState,
    event: FlowEvent,
    _context: RegistrationFlowContext
  ): FlowRuntimeState => applyCatalogRegistrationFlowEvent(state, event),
  successDataAttributes: (_state, context) =>
    resolveIntakeSchema(context.pluginId).features.successDataAttributes ?? {},
});

export function readDenaliFlowData(state: FlowRuntimeState): DenaliFlowData {
  return readCatalogRegistrationFlowState(state.data);
}
