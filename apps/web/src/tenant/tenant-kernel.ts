import {
  bindWorkspaceThemeAccess,
  createTenantAuthz,
  type ScopedTenantAuthz,
} from "@app-tour/workspace-sdk/auth";
import type {
  TenantAuthContext,
  WorkspacePlugin,
  WorkspaceThemeSubject,
} from "@app-tour/workspace-sdk";

import { listBootstrapWorkspacePlugins } from "@/bootstrap/workspace-plugins";
import type { AppSession } from "@/session/app-session";

import { isDevWebSessionAllowed } from "./auth-env";

const bootstrapPlugin = listBootstrapWorkspacePlugins()[0];

if (!bootstrapPlugin) {
  throw new Error("BOOTSTRAP_WORKSPACE_PLUGIN_MISSING");
}

export type TenantKernelResolveInput = {
  readonly userId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly role: TenantAuthContext["role"];
  readonly status: TenantAuthContext["status"];
};

export type ResolvedBootstrapSession = {
  readonly session: AppSession;
  readonly context: TenantAuthContext;
  readonly scopedAuthz: ScopedTenantAuthz;
  readonly workspaceThemeAccess: WorkspaceThemeSubject;
  readonly plugin: WorkspacePlugin;
};

export type SerializableBootstrap = {
  readonly context: TenantAuthContext;
  readonly plugin: WorkspacePlugin;
};

function resolveContextFromEnv(): TenantKernelResolveInput {
  if (!isDevWebSessionAllowed()) {
    throw new Error("WEB_SESSION_NOT_CONFIGURED");
  }

  return {
    userId:
      process.env.TOUR_OPS_DEV_USER_ID ??
      process.env.NEXT_PUBLIC_DEV_USER_ID ??
      "dev-user",
    tenantId:
      process.env.TOUR_OPS_DEV_TENANT_ID ??
      process.env.NEXT_PUBLIC_DEV_TENANT_ID ??
      "dev-tenant-local",
    workspaceId:
      process.env.TOUR_OPS_DEV_WORKSPACE_ID ??
      process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID ??
      "default",
    role: (process.env.TOUR_OPS_DEV_ACTOR_ROLE ??
      process.env.NEXT_PUBLIC_DEV_ACTOR_ROLE ??
      "admin") as TenantAuthContext["role"],
    status: (process.env.TOUR_OPS_DEV_MEMBERSHIP_STATUS ??
      process.env.NEXT_PUBLIC_DEV_MEMBERSHIP_STATUS ??
      "ACTIVE") as TenantAuthContext["status"],
  };
}

export function resolveTenantContext(
  input: TenantKernelResolveInput = resolveContextFromEnv(),
): TenantAuthContext {
  return {
    userId: input.userId,
    tenantId: input.tenantId,
    role: input.role,
    status: input.status,
    workspaceId: input.workspaceId,
  };
}

/** Per-request bootstrap (call from Server Components only). */
export function resolveBootstrapAppSession(
  input: TenantKernelResolveInput = resolveContextFromEnv(),
): ResolvedBootstrapSession {
  const context = resolveTenantContext(input);
  const scoped = createTenantAuthz(context);
  const workspaceThemeAccess = bindWorkspaceThemeAccess(scoped.context, {
    workspaceId: context.workspaceId!,
    pluginId: bootstrapPlugin.id,
  });

  const session: AppSession = {
    authz: scoped,
    tenantId: context.tenantId,
    workspaceId: context.workspaceId!,
    pluginId: bootstrapPlugin.id,
  };

  return {
    session,
    context,
    scopedAuthz: scoped,
    workspaceThemeAccess,
    plugin: bootstrapPlugin,
  };
}

/** Props passed from server layout into client providers. */
export function toSerializableBootstrap(
  resolved: ResolvedBootstrapSession,
): SerializableBootstrap {
  return {
    context: resolved.context,
    plugin: resolved.plugin,
  };
}

export function hydrateBootstrapSession(serializable: SerializableBootstrap): ResolvedBootstrapSession {
  const context = resolveTenantContext({
    userId: serializable.context.userId,
    tenantId: serializable.context.tenantId,
    workspaceId: serializable.context.workspaceId ?? "default",
    role: serializable.context.role,
    status: serializable.context.status,
  });
  const scoped = createTenantAuthz(context);
  const workspaceThemeAccess = bindWorkspaceThemeAccess(scoped.context, {
    workspaceId: context.workspaceId!,
    pluginId: serializable.plugin.id,
  });
  const session: AppSession = {
    authz: scoped,
    tenantId: context.tenantId,
    workspaceId: context.workspaceId!,
    pluginId: serializable.plugin.id,
  };
  return {
    session,
    context,
    scopedAuthz: scoped,
    workspaceThemeAccess,
    plugin: serializable.plugin,
  };
}

export { bootstrapPlugin };
