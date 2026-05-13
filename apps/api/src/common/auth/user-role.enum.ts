/**
 * Workspace membership roles (JWT `role` and `user_tenants.role`, lowercase).
 * Product hierarchy (highest first): owner > leader > admin > member > viewer.
 */
export enum UserRole {
  Owner = "owner",
  Leader = "leader",
  Admin = "admin",
  Member = "member",
  Viewer = "viewer"
}

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

const JWT_WORKSPACE_ROLES = new Set<string>(Object.values(UserRole));

/**
 * Returns a {@link UserRole} when `raw` matches a known **workspace JWT** role (case-insensitive).
 */
export function tryParseWorkspaceUserRole(raw: string): UserRole | undefined {
  const normalized = raw.trim().toLowerCase();
  if (!JWT_WORKSPACE_ROLES.has(normalized)) {
    return undefined;
  }
  return normalized as UserRole;
}

export function isWorkspaceUserRole(role: RequestActorRole | undefined): role is UserRole {
  return role !== undefined && JWT_WORKSPACE_ROLES.has(String(role).trim().toLowerCase());
}
