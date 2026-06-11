import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";

export class UsersWorkspaceForbiddenError extends Error {
  readonly code = "USERS_WORKSPACE_FORBIDDEN" as const;

  constructor() {
    super("USERS_WORKSPACE_FORBIDDEN");
    this.name = "UsersWorkspaceForbiddenError";
  }
}

/** Denali operator product — Urban host must not expose team directory (RULE-P9-002). */
export async function assertOperatorUsersWorkspace(tenantId: string): Promise<void> {
  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  if (workspaceType === "urban") {
    throw new UsersWorkspaceForbiddenError();
  }
}
