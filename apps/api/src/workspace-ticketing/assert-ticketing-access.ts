import {
  FORBIDDEN_TICKETING_MODULE_DISABLED,
  TICKETING_WORKSPACE_UNSUPPORTED,
} from "@app-tour/workspace-sdk/ticketing";

import { isTicketingModuleEnabled, parseEnabledModulesFromTheme } from "./ticketing-module-enabled.ts";
import { resolveTicketingTenantWorkspaceRow } from "./resolve-ticketing-workspace-type-for-tenant.ts";
import { isTicketingSupportedWorkspace } from "./workspace-ticketing-bindings.generated.ts";

export { parseEnabledModulesFromTheme, isTicketingModuleEnabled };

export async function assertTicketingWorkspaceGate(tenantId: string): Promise<{
  readonly workspaceType: string;
  readonly theme: unknown;
}> {
  const row = await resolveTicketingTenantWorkspaceRow(tenantId);
  if (row === null) {
    throw new Error(TICKETING_WORKSPACE_UNSUPPORTED);
  }
  const workspaceType = row.workspaceType.trim().toLowerCase();
  if (workspaceType.length === 0 || !isTicketingSupportedWorkspace(workspaceType)) {
    throw new Error(TICKETING_WORKSPACE_UNSUPPORTED);
  }
  if (!isTicketingModuleEnabled(row.theme, workspaceType)) {
    throw new Error(FORBIDDEN_TICKETING_MODULE_DISABLED);
  }
  return row;
}
