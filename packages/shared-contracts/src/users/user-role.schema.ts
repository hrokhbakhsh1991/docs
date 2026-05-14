import { z } from "zod";

/**
 * Workspace-scoped user role strings (aligns with `@repo/shared-rbac` / API `UserRole`).
 * Unknown roles should be rejected at the boundary; legacy `"operator"` remains a server parse concern until migrated.
 */
export const UserRoleSchema = z.enum(["owner", "leader", "admin", "member", "viewer"]);

export type UserRole = z.infer<typeof UserRoleSchema>;
