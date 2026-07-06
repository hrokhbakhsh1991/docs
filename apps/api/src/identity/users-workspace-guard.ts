import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { operatorCapabilitySupportsUsersDirectory } from "@app-tour/workspace-sdk";

export class UsersWorkspaceForbiddenError extends Error {
  readonly code = "USERS_WORKSPACE_FORBIDDEN" as const;

  constructor() {
    super("USERS_WORKSPACE_FORBIDDEN");
    this.name = "UsersWorkspaceForbiddenError";
  }
}

/** Operator team directory — gated by manifest operatorCapabilities.usersDirectory. */
export async function assertOperatorUsersWorkspace(tenantId: string): Promise<void> {
  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  if (!operatorCapabilitySupportsUsersDirectory(workspaceType)) {
    throw new UsersWorkspaceForbiddenError();
  }
}
