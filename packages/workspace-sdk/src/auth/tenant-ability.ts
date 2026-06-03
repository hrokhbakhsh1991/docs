import { buildTenantAuthz, type TenantAuthz } from "./tenant-authz";
import { assertAuthScopeId } from "./auth-id-format";
import type { TenantAuthContext } from "./auth-context";
import { parseTenantAuthContext } from "./auth-schemas";
import type { WorkspaceThemeSubject } from "./subjects";

/**
 * Authorization bound to the validated context used to build it.
 */
export type ScopedTenantAuthz = {
  readonly authz: TenantAuthz;
  readonly context: Readonly<TenantAuthContext>;
};

/** @deprecated Use {@link ScopedTenantAuthz} */
export type ScopedTenantAbility = ScopedTenantAuthz;

export function createTenantAuthz(context: TenantAuthContext): ScopedTenantAuthz {
  const parsed = parseTenantAuthContext(context);
  return {
    authz: buildTenantAuthz(parsed),
    context: Object.freeze(parsed),
  };
}

/** @deprecated Use {@link createTenantAuthz} */
export const createTenantAbility = createTenantAuthz;

export function bindWorkspaceThemeAccess(
  context: TenantAuthContext,
  params: { readonly workspaceId: string; readonly pluginId: string },
): WorkspaceThemeSubject {
  const parsed = parseTenantAuthContext(context);
  assertAuthScopeId("workspaceId", params.workspaceId.trim(), "AUTH_SCOPE_ID_INVALID");
  assertAuthScopeId("pluginId", params.pluginId.trim(), "AUTH_SCOPE_ID_INVALID");
  return {
    tenantId: parsed.tenantId,
    workspaceId: params.workspaceId.trim(),
    pluginId: params.pluginId.trim(),
  };
}
