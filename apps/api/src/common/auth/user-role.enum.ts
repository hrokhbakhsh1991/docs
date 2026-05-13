/**
 * Workspace membership role carried on JWT `role` and `user_tenants.role` (lowercase).
 * Phase 1: replaces untyped `role: string` on request context after JWT verification.
 *
 * Additional values are **non-JWT** actors (workers, OpenAPI build, CASL placeholders).
 */
export enum UserRole {
  Owner = "owner",
  Leader = "leader",
  Admin = "admin",
  Member = "member",
  Viewer = "viewer",
  /** Synthetic OpenAPI / documentation actor */
  System = "SYSTEM",
  /** CASL fail-closed placeholder */
  None = "none",
  /** Background worker jobs */
  Worker = "worker",
  /** Internal API / ops actor */
  Api = "api"
}

const JWT_WORKSPACE_ROLES = new Set<string>([
  UserRole.Owner,
  UserRole.Leader,
  UserRole.Admin,
  UserRole.Member,
  UserRole.Viewer
]);

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
