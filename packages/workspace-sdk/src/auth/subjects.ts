/** CASL subject type names (Phase 3.0). */
export type AuthSubjectType =
  | "Workspace"
  | "Tenant"
  | "Plugin"
  | "WorkspaceTheme"
  | "CanonicalDocument";

export type WorkspaceSubject = {
  readonly tenantId: string;
  readonly workspaceId: string;
};

export type TenantSubject = {
  readonly tenantId: string;
};

export type PluginSubject = {
  readonly tenantId: string;
  readonly pluginId: string;
};

export type WorkspaceThemeSubject = {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly pluginId: string;
};

export type CanonicalDocumentSubject = {
  readonly tenantId: string;
  readonly documentId?: string;
};

export function workspaceSubject(params: WorkspaceSubject): WorkspaceSubject {
  return params;
}

export function tenantSubject(params: TenantSubject): TenantSubject {
  return params;
}

export function pluginSubject(params: PluginSubject): PluginSubject {
  return params;
}

export function workspaceThemeSubject(params: WorkspaceThemeSubject): WorkspaceThemeSubject {
  return params;
}

export function canonicalDocumentSubject(
  params: CanonicalDocumentSubject,
): CanonicalDocumentSubject {
  return params;
}
