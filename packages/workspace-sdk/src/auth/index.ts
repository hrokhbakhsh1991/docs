export {
  buildTenantAuthz,
  canAccessWorkspaceTheme,
  cannotAccessWorkspaceTheme,
  canAccessWorkspaceThemeScoped,
  type TenantAuthz,
  type CanAccessWorkspaceThemeAuthzParams,
} from "./tenant-authz";
export type {
  WorkspaceAuthSurface,
  WorkspaceOwnerMutationPolicy,
} from "./workspace-auth-surface";
export { isWorkspaceAuthSurfaceAllowed } from "./workspace-auth-surface";

export {
  createTenantAuthz,
  bindWorkspaceThemeAccess,
  type ScopedTenantAuthz,
  /** @deprecated Use ScopedTenantAuthz */
  type ScopedTenantAbility,
  /** @deprecated Use createTenantAuthz */
  createTenantAbility,
} from "./tenant-ability";

export { AbilityAction } from "./actions";
export type { ActorRole, MembershipStatus, TenantAuthContext } from "./auth-context";
export { AuthScopeField } from "./auth-scope-fields";
export type { TenantScopeConditions, WorkspaceScopeConditions } from "./auth-scope-fields";
export { parseTenantAuthContext, parseWorkspaceThemeSubject } from "./auth-schemas";
export { parseAuthRecord, type AuthRecordFieldSpec } from "./parse-auth-record";
export {
  assertTenantAuthContext,
  tryParseTenantAuthContext,
  InvalidTenantAuthContextError,
  type AuthContextErrorCode,
} from "./validate-auth-context";
export { AbilityUsageError, type AbilityUsageErrorCode } from "./ability-usage-error";
export { isWorkspaceOwner } from "./tenant-auth-grants";
export type { OperatorSurface, CanPerformOperatorSurfaceOptions } from "./operator-surface";
export { evaluateOperatorSurfaceGrant } from "./operator-surface";
export {
  canonicalDocumentSubject,
  pluginSubject,
  tenantSubject,
  workspaceSubject,
  workspaceThemeSubject,
  type AuthSubjectType,
  type CanonicalDocumentSubject,
  type PluginSubject,
  type TenantSubject,
  type WorkspaceSubject,
  type WorkspaceThemeSubject,
} from "./subjects";
