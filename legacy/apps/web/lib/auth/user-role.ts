/**
 * Workspace directory roles — aligned with `@repo/shared` / API `UserRole`.
 */
import { WorkspaceRole, tryParseWorkspaceRole } from "@repo/shared";

export { WorkspaceRole as UserRole };

export function tryParseWorkspaceUserRole(raw: string): WorkspaceRole | undefined {
  return tryParseWorkspaceRole(raw);
}

export function isUserRole(value: string): value is WorkspaceRole {
  return tryParseWorkspaceRole(value) !== undefined;
}
