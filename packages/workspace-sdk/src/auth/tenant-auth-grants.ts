import type { TenantAuthContext } from "./auth-context";

export function isActiveMember(context: TenantAuthContext): boolean {
  return context.status === "ACTIVE" && context.role !== "none";
}

export function isAdminOrOwner(context: TenantAuthContext): boolean {
  return context.role === "admin" || context.role === "owner";
}

/** Urban Single-Owner (DEC-P8-001) — admin is not elevated on urban owner surfaces. */
export function isWorkspaceOwner(context: TenantAuthContext): boolean {
  return isActiveMember(context) && context.role === "owner";
}

export function memberHasRequiredWorkspaceBinding(context: TenantAuthContext): boolean {
  if (context.role !== "member") {
    return true;
  }
  return context.workspaceId !== undefined && context.workspaceId.length > 0;
}

export function isAuthzGranted(context: TenantAuthContext): boolean {
  return isActiveMember(context) && memberHasRequiredWorkspaceBinding(context);
}

export function tenantScopeMatches(context: TenantAuthContext, tenantId: string): boolean {
  return context.tenantId === tenantId;
}

export function workspaceScopeMatches(
  context: TenantAuthContext,
  tenantId: string,
  workspaceId: string
): boolean {
  if (!tenantScopeMatches(context, tenantId)) {
    return false;
  }
  if (context.workspaceId !== undefined) {
    return context.workspaceId === workspaceId;
  }
  return true;
}
