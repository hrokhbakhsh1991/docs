import { WORKSPACE_OPERATOR_CAPABILITIES } from "./workspace-operator-capabilities.generated";

export function operatorCapabilitySupportsUsersDirectory(workspaceType: string): boolean {
  return WORKSPACE_OPERATOR_CAPABILITIES[workspaceType]?.usersDirectory === true;
}

export function operatorCapabilitySupportsReconciliationTriage(workspaceType: string): boolean {
  return WORKSPACE_OPERATOR_CAPABILITIES[workspaceType]?.reconciliationTriage === true;
}

export function operatorCapabilitySupportsFieldExposureSurfaces(workspaceType: string): boolean {
  return WORKSPACE_OPERATOR_CAPABILITIES[workspaceType]?.fieldExposureSurfaces === true;
}
