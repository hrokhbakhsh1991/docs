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

export const URBAN_REGISTRATION_FLOW_STEPS = [
  "phone",
  "otp",
  "profile",
  "intake",
  "done",
] as const;

/** @deprecated Use CatalogRegistrationFlowState from @app-tour/catalog-registration-auth */
export type UrbanFlowData = CatalogRegistrationFlowState;

const DEFINITION: IntakeFlowDefinition = Object.freeze({
  initialStep: "phone",
  steps: URBAN_REGISTRATION_FLOW_STEPS,
});

export const urbanCatalogRegistrationFlowSurface = defineCatalogRegistrationFlowSurface({
  definition: DEFINITION,
  resolveNextStep: (
    state: FlowRuntimeState,
    event: FlowEvent,
    _context: RegistrationFlowContext
  ): FlowRuntimeState => applyCatalogRegistrationFlowEvent(state, event),
  successDataAttributes: (_state, context) =>
    resolveIntakeSchema(context.pluginId).features.successDataAttributes ?? {},
});

export function readUrbanFlowData(state: FlowRuntimeState): UrbanFlowData {
  return readCatalogRegistrationFlowState(state.data);
}
