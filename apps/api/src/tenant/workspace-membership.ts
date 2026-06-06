/** Thrown when workspace id is well-formed but not registered / expired (P0). */
export class WorkspaceInvalidError extends Error {
  constructor() {
    super("WORKSPACE_INVALID");
    this.name = "WorkspaceInvalidError";
  }
}

const STALE_WORKSPACE_PREFIXES = ["ws-expired-", "ws-deleted-", "ws-never-provisioned-"] as const;

/**
 * Dev/test membership gate until Postgres workspace_memberships (Phase 6+).
 * @see docs/phase-5/appendices/workspace-membership.md
 */
export function assertWorkspaceMembership(workspaceId: string | undefined): void {
  const normalized = workspaceId?.trim() ?? "";
  if (normalized.length === 0) {
    return;
  }
  for (const prefix of STALE_WORKSPACE_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      throw new WorkspaceInvalidError();
    }
  }
}
