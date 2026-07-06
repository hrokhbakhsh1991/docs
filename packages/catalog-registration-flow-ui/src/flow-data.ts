import {
  readCatalogRegistrationFlowState,
  type CatalogRegistrationFlowState,
} from "@app-tour/catalog-registration-auth";
import type { FlowRuntimeState } from "@app-tour/workspace-sdk";

/** @deprecated Use CatalogRegistrationFlowState from @app-tour/catalog-registration-auth */
export type CatalogRegistrationFlowData = CatalogRegistrationFlowState;

export function readCatalogRegistrationFlowData(state: FlowRuntimeState): CatalogRegistrationFlowData {
  return readCatalogRegistrationFlowState(state.data);
}
