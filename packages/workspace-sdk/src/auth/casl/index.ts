/**
 * Optional CASL bridge — not part of workspace-sdk foundation import graph.
 */
import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
  type MongoQuery,
} from "@casl/ability";

import { AbilityAction } from "../actions";
import { tenantScopeConditions, workspaceScopeConditions } from "../auth-scope-fields";
import type { TenantAuthContext } from "../auth-context";
import { parseTenantAuthContext } from "../auth-schemas";
import type {
  AuthSubjectType,
  CanonicalDocumentSubject,
  PluginSubject,
  TenantSubject,
  WorkspaceSubject,
  WorkspaceThemeSubject,
} from "../subjects";
import { caslWorkspaceThemeSubject } from "./subjects";
import {
  isActiveMember,
  isAdminOrOwner,
  memberHasRequiredWorkspaceBinding,
} from "../tenant-auth-grants";

type SubjectRecord =
  | AuthSubjectType
  | WorkspaceSubject
  | TenantSubject
  | PluginSubject
  | WorkspaceThemeSubject
  | CanonicalDocumentSubject;

export type AppAbility = MongoAbility<[AbilityAction, SubjectRecord], MongoQuery>;

function isSubjectTypeName(value: unknown): value is AuthSubjectType {
  return (
    value === "Workspace" ||
    value === "Tenant" ||
    value === "Plugin" ||
    value === "WorkspaceTheme" ||
    value === "CanonicalDocument"
  );
}

function sealAbility(ability: AppAbility): AppAbility {
  return new Proxy(ability, {
    get(target, prop, receiver) {
      if (prop === "can") {
        return (
          action: Parameters<AppAbility["can"]>[0],
          subject: Parameters<AppAbility["can"]>[1],
          field?: string,
        ) => {
          if (typeof subject === "string" && isSubjectTypeName(subject)) {
            return false;
          }
          return target.can(action, subject, field);
        };
      }
      if (prop === "cannot") {
        return (
          action: Parameters<AppAbility["cannot"]>[0],
          subject: Parameters<AppAbility["cannot"]>[1],
          field?: string,
        ) => {
          if (typeof subject === "string" && isSubjectTypeName(subject)) {
            return true;
          }
          return target.cannot(action, subject, field);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as AppAbility;
}

function resolveWorkspaceScope(context: TenantAuthContext) {
  if (context.workspaceId !== undefined) {
    return workspaceScopeConditions(context.tenantId, context.workspaceId);
  }
  return tenantScopeConditions(context.tenantId);
}

/** @deprecated Prefer {@link buildTenantAuthz} for foundation consumers. */
export function defineAbilityFor(context: TenantAuthContext): AppAbility {
  const parsed = parseTenantAuthContext(context);

  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (!isActiveMember(parsed) || !memberHasRequiredWorkspaceBinding(parsed)) {
    return sealAbility(build());
  }

  const tenantScope = tenantScopeConditions(parsed.tenantId);
  const workspaceScope = resolveWorkspaceScope(parsed);

  can(AbilityAction.Read, "Workspace", workspaceScope);
  can(AbilityAction.Update, "Workspace", workspaceScope);

  can(AbilityAction.Read, "Tenant", tenantScope);
  if (isAdminOrOwner(parsed)) {
    can(AbilityAction.Manage, "Tenant", tenantScope);
  }

  can(AbilityAction.Read, "Plugin", tenantScope);
  if (isAdminOrOwner(parsed)) {
    can(AbilityAction.Install, "Plugin", tenantScope);
  }

  can(AbilityAction.Access, "WorkspaceTheme", workspaceScope);

  can(AbilityAction.Read, "CanonicalDocument", tenantScope);
  can(AbilityAction.Create, "CanonicalDocument", tenantScope);
  can(AbilityAction.Update, "CanonicalDocument", tenantScope);

  return sealAbility(build());
}

export type CanAccessWorkspaceThemeParams = {
  readonly ability: AppAbility;
  readonly access: WorkspaceThemeSubject;
  readonly pluginId: string;
  readonly boundTenantId?: string;
};

function resolveCanAccessParams(
  abilityOrParams: AppAbility | CanAccessWorkspaceThemeParams,
  access?: WorkspaceThemeSubject,
): CanAccessWorkspaceThemeParams {
  if (
    typeof abilityOrParams === "object" &&
    abilityOrParams !== null &&
    "access" in abilityOrParams
  ) {
    return abilityOrParams;
  }
  if (access === undefined) {
    throw new Error("canAccessWorkspaceTheme requires access when passing a bare AppAbility");
  }
  return {
    ability: abilityOrParams,
    access,
    pluginId: access.pluginId,
  };
}

export function canAccessWorkspaceTheme(params: CanAccessWorkspaceThemeParams): boolean;
/** @deprecated Prefer {@link buildTenantAuthz} object form. */
export function canAccessWorkspaceTheme(
  ability: AppAbility,
  access: WorkspaceThemeSubject,
): boolean;
export function canAccessWorkspaceTheme(
  abilityOrParams: AppAbility | CanAccessWorkspaceThemeParams,
  access?: WorkspaceThemeSubject,
): boolean {
  const resolved = resolveCanAccessParams(abilityOrParams, access);

  if (resolved.boundTenantId !== undefined && resolved.access.tenantId !== resolved.boundTenantId) {
    return false;
  }
  if (resolved.access.pluginId !== resolved.pluginId) {
    return false;
  }

  return resolved.ability.can(
    AbilityAction.Access,
    caslWorkspaceThemeSubject(resolved.access),
  );
}

export function cannotAccessWorkspaceTheme(params: CanAccessWorkspaceThemeParams): boolean {
  const resolved = resolveCanAccessParams(params);
  if (resolved.boundTenantId !== undefined && resolved.access.tenantId !== resolved.boundTenantId) {
    return true;
  }
  if (resolved.access.pluginId !== resolved.pluginId) {
    return true;
  }
  return resolved.ability.cannot(
    AbilityAction.Access,
    caslWorkspaceThemeSubject(resolved.access),
  );
}

export function canAccessWorkspaceThemeScoped(
  scoped: { readonly ability: AppAbility; readonly context: Readonly<TenantAuthContext> },
  access: WorkspaceThemeSubject,
  pluginId: string,
): boolean {
  return canAccessWorkspaceTheme({
    ability: scoped.ability,
    access,
    pluginId,
    boundTenantId: scoped.context.tenantId,
  });
}
