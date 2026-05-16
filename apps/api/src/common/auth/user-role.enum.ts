import { tryParseWorkspaceRole, WorkspaceRole } from "@repo/shared";

export const UserRole = WorkspaceRole;
export type UserRole = WorkspaceRole;

export { tryParseWorkspaceRole as tryParseWorkspaceUserRole };

/**
 * Non-workspace JWT actors (OpenAPI build, workers, CASL placeholders, internal ops).
 */
export enum InternalActorRole {
  System = "SYSTEM",
  None = "none",
  Worker = "worker",
  Api = "api"
}

/** Value stored on {@link RequestContext.role} after auth or synthetic contexts. */
export type RequestActorRole = UserRole | InternalActorRole;

export function isWorkspaceUserRole(role: RequestActorRole | undefined): role is UserRole {
  if (role === undefined) {
    return false;
  }
  return tryParseWorkspaceRole(String(role)) !== undefined;
}
