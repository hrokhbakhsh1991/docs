/**
 * Workspace directory roles — values must match `UserRole` in Tour-Ops API (`apps/api/src/common/auth/user-role.enum.ts`).
 */
export const WORKSPACE_USER_ROLES = ["owner", "leader", "admin", "member", "viewer"] as const;

export type UserRole = (typeof WORKSPACE_USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return (WORKSPACE_USER_ROLES as readonly string[]).includes(value.trim().toLowerCase());
}
