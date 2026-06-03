import { AbilityUsageError } from "./ability-usage-error";
import type { TenantAuthContext } from "./auth-context";
import { parseTenantAuthContext } from "./auth-schemas";
import type {
  CanonicalDocumentSubject,
  PluginSubject,
  WorkspaceThemeSubject,
} from "./subjects";
import {
  isAdminOrOwner,
  isAuthzGranted,
  tenantScopeMatches,
  workspaceScopeMatches,
} from "./tenant-auth-grants";

export type TenantAuthz = {
  readonly context: Readonly<TenantAuthContext>;
  canReadWorkspace(tenantId: string, workspaceId: string): boolean;
  canUpdateWorkspace(tenantId: string, workspaceId: string): boolean;
  canReadTenant(tenantId: string): boolean;
  canManageTenant(tenantId: string): boolean;
  canReadPlugin(subject: PluginSubject): boolean;
  canInstallPlugin(subject: PluginSubject): boolean;
  canAccessWorkspaceTheme(params: {
    access: WorkspaceThemeSubject;
    pluginId: string;
    boundTenantId?: string;
  }): boolean;
  canReadCanonicalDocument(subject: CanonicalDocumentSubject): boolean;
  canCreateCanonicalDocument(subject: CanonicalDocumentSubject): boolean;
  canUpdateCanonicalDocument(subject: CanonicalDocumentSubject): boolean;
};

export type CanAccessWorkspaceThemeAuthzParams = {
  readonly authz: TenantAuthz;
  readonly access: WorkspaceThemeSubject;
  readonly pluginId: string;
  readonly boundTenantId?: string;
};

export function buildTenantAuthz(context: TenantAuthContext): TenantAuthz {
  const parsed = parseTenantAuthContext(context);
  const granted = isAuthzGranted(parsed);

  const authz: TenantAuthz = {
    context: Object.freeze(parsed),

    canReadWorkspace(tenantId, workspaceId) {
      return granted && workspaceScopeMatches(parsed, tenantId, workspaceId);
    },

    canUpdateWorkspace(tenantId, workspaceId) {
      return granted && workspaceScopeMatches(parsed, tenantId, workspaceId);
    },

    canReadTenant(tenantId) {
      return granted && tenantScopeMatches(parsed, tenantId);
    },

    canManageTenant(tenantId) {
      return granted && isAdminOrOwner(parsed) && tenantScopeMatches(parsed, tenantId);
    },

    canReadPlugin(subject) {
      return granted && tenantScopeMatches(parsed, subject.tenantId);
    },

    canInstallPlugin(subject) {
      return (
        granted && isAdminOrOwner(parsed) && tenantScopeMatches(parsed, subject.tenantId)
      );
    },

    canAccessWorkspaceTheme(params) {
      if (!granted) {
        return false;
      }
      if (
        params.boundTenantId !== undefined &&
        params.access.tenantId !== params.boundTenantId
      ) {
        return false;
      }
      if (params.access.pluginId !== params.pluginId) {
        return false;
      }
      return workspaceScopeMatches(
        parsed,
        params.access.tenantId,
        params.access.workspaceId,
      );
    },

    canReadCanonicalDocument(subject) {
      return granted && tenantScopeMatches(parsed, subject.tenantId);
    },

    canCreateCanonicalDocument(subject) {
      return granted && tenantScopeMatches(parsed, subject.tenantId);
    },

    canUpdateCanonicalDocument(subject) {
      return granted && tenantScopeMatches(parsed, subject.tenantId);
    },
  };

  return authz;
}

export function canAccessWorkspaceTheme(params: CanAccessWorkspaceThemeAuthzParams): boolean {
  return params.authz.canAccessWorkspaceTheme(params);
}

export function cannotAccessWorkspaceTheme(params: CanAccessWorkspaceThemeAuthzParams): boolean {
  return !canAccessWorkspaceTheme(params);
}

export function canAccessWorkspaceThemeScoped(
  scoped: { readonly authz: TenantAuthz; readonly context: Readonly<TenantAuthContext> },
  access: WorkspaceThemeSubject,
  pluginId: string,
): boolean {
  return canAccessWorkspaceTheme({
    authz: scoped.authz,
    access,
    pluginId,
    boundTenantId: scoped.context.tenantId,
  });
}

export function resolveCanAccessWorkspaceThemeAuthz(
  authzOrParams: TenantAuthz | CanAccessWorkspaceThemeAuthzParams,
  access?: WorkspaceThemeSubject,
  pluginId?: string,
): CanAccessWorkspaceThemeAuthzParams {
  if (
    typeof authzOrParams === "object" &&
    authzOrParams !== null &&
    "access" in authzOrParams &&
    "authz" in authzOrParams
  ) {
    return authzOrParams;
  }
  if (access === undefined || pluginId === undefined) {
    throw new AbilityUsageError(
      "MISSING_THEME_ACCESS_ARG",
      "canAccessWorkspaceTheme requires access and pluginId when passing a bare TenantAuthz",
    );
  }
  return {
    authz: authzOrParams as TenantAuthz,
    access,
    pluginId,
  };
}
