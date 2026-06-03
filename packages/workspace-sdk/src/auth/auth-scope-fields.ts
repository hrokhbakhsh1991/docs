/**
 * CASL Mongo condition field names — single source of truth.
 * Changing tenant/workspace identity shape updates this module + {@link assertTenantAuthContext}.
 */
export const AuthScopeField = {
  TenantId: "tenantId",
  WorkspaceId: "workspaceId",
  PluginId: "pluginId",
  DocumentId: "documentId",
} as const;

export type AuthScopeFieldName = (typeof AuthScopeField)[keyof typeof AuthScopeField];

/** Tenant-only CASL condition object. */
export type TenantScopeConditions = {
  readonly [AuthScopeField.TenantId]: string;
};

/** Tenant + workspace CASL condition object. */
export type WorkspaceScopeConditions = {
  readonly [AuthScopeField.TenantId]: string;
  readonly [AuthScopeField.WorkspaceId]: string;
};

export function tenantScopeConditions(tenantId: string): TenantScopeConditions {
  return { [AuthScopeField.TenantId]: tenantId };
}

export function workspaceScopeConditions(
  tenantId: string,
  workspaceId: string,
): WorkspaceScopeConditions {
  return {
    [AuthScopeField.TenantId]: tenantId,
    [AuthScopeField.WorkspaceId]: workspaceId,
  };
}
