import type { CatalogRegistrationFlowState } from "@app-tour/catalog-registration-auth";
import { createCatalogRegistrationFlowRuntimeState } from "@app-tour/catalog-registration-auth";

import type {
  FlowEvent,
  FlowRuntimeState,
  IntakeFlowDefinition,
  RegistrationFlowContext,
  WorkspaceCatalogRegistrationFlowSurface,
} from "./registration-flow.contract";

export type DefineCatalogRegistrationFlowSurfaceInput = {
  readonly definition: IntakeFlowDefinition;
  readonly resolveNextStep: (
    state: FlowRuntimeState,
    event: FlowEvent,
    context: RegistrationFlowContext
  ) => FlowRuntimeState;
  readonly validateStep?: WorkspaceCatalogRegistrationFlowSurface["validateStep"];
  readonly submitTransform?: WorkspaceCatalogRegistrationFlowSurface["submitTransform"];
  readonly successDataAttributes?: WorkspaceCatalogRegistrationFlowSurface["successDataAttributes"];
};

/** Injects canonical createInitialState — workspaces must not define local createEmptyData(). */
export function defineCatalogRegistrationFlowSurface(
  input: DefineCatalogRegistrationFlowSurfaceInput
): WorkspaceCatalogRegistrationFlowSurface {
  return Object.freeze({
    definition: input.definition,
    createInitialState: (_context: RegistrationFlowContext): FlowRuntimeState =>
      createCatalogRegistrationFlowRuntimeState({
        initialStep: input.definition.initialStep,
      }),
    resolveNextStep: input.resolveNextStep,
    ...(input.validateStep !== undefined ? { validateStep: input.validateStep } : {}),
    ...(input.submitTransform !== undefined ? { submitTransform: input.submitTransform } : {}),
    ...(input.successDataAttributes !== undefined
      ? { successDataAttributes: input.successDataAttributes }
      : {}),
  });
}

export type { CatalogRegistrationFlowState };
