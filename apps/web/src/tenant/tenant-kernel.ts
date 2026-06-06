import { DENALI_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-sdk";
import {
  bindWorkspaceThemeAccess,
  createTenantAuthz,
  type ScopedTenantAuthz,
} from "@app-tour/workspace-sdk/auth";
import type {
  TenantAuthContext,
  TenantThemeConfig,
  WorkspacePlugin,
  WorkspaceThemeSubject,
} from "@app-tour/workspace-sdk";
import { listBootstrapWorkspacePlugins } from "@/bootstrap/workspace-plugins";

/** Phase 6.6 smoke — sync with `@app-tour/workspace-denali` DENALI_SMOKE_TENANT_ID. */
const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
import type { AppSession } from "@/session/app-session";

import { isDevWebSessionAllowed } from "./auth-env";
import { resolveTenantIdFromDevHost } from "./resolve-host-tenant";

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
  readonly tenantTheme?: TenantThemeConfig;
  readonly pluginId: string;
};

function resolveBootstrapPluginId(tenantId: string, host?: string): string {
  if (tenantId === DENALI_SMOKE_TENANT_ID) {
    return DENALI_WORKSPACE_PLUGIN_ID;
  }
  const hostname = host?.split(":")[0]?.trim().toLowerCase() ?? "";
  if (hostname.startsWith("denali.")) {
    return DENALI_WORKSPACE_PLUGIN_ID;
  }
  return bootstrapPlugin.id;
}

function resolveContextFromEnv(): TenantKernelResolveInput {
  if (!isDevWebSessionAllowed()) {
    throw new Error("WEB_SESSION_NOT_CONFIGURED");
  }

  return {
    userId: process.env.TOUR_OPS_DEV_USER_ID ?? process.env.NEXT_PUBLIC_DEV_USER_ID ?? "dev-user",
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
  input: TenantKernelResolveInput = resolveContextFromEnv()
): TenantAuthContext {
  return {
    userId: input.userId,
    tenantId: input.tenantId,
    role: input.role,
    status: input.status,
    workspaceId: input.workspaceId,
  };
}

/** Per-request bootstrap with optional Host-based tenant override (dev e2e / TH-1). */
export function resolveBootstrapAppSessionForHost(host: string): ResolvedBootstrapSession {
  const base = resolveContextFromEnv();
  const hostTenantId = resolveTenantIdFromDevHost(host);
  if (hostTenantId) {
    return resolveBootstrapAppSession({ ...base, tenantId: hostTenantId }, host);
  }
  return resolveBootstrapAppSession(base, host);
}

/** Per-request bootstrap (call from Server Components only). */
export function resolveBootstrapAppSession(
  input: TenantKernelResolveInput = resolveContextFromEnv(),
  host?: string
): ResolvedBootstrapSession {
  const context = resolveTenantContext(input);
  const scoped = createTenantAuthz(context);
  const pluginId = resolveBootstrapPluginId(context.tenantId, host);
  const workspaceThemeAccess = bindWorkspaceThemeAccess(scoped.context, {
    workspaceId: context.workspaceId!,
    pluginId,
  });

  const session: AppSession = {
    authz: scoped,
    tenantId: context.tenantId,
    workspaceId: context.workspaceId!,
    pluginId,
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
  tenantTheme?: TenantThemeConfig
): SerializableBootstrap {
  return {
    context: resolved.context,
    pluginId: resolved.session.pluginId,
    ...(tenantTheme ? { tenantTheme } : {}),
  };
}

export function hydrateBootstrapSession(
  serializable: SerializableBootstrap
): ResolvedBootstrapSession {
  const context = resolveTenantContext({
    userId: serializable.context.userId,
    tenantId: serializable.context.tenantId,
    workspaceId: serializable.context.workspaceId ?? "default",
    role: serializable.context.role,
    status: serializable.context.status,
  });
  const scoped = createTenantAuthz(context);
  const pluginId = serializable.pluginId ?? bootstrapPlugin.id;
  const plugin = bootstrapPlugin;
  const workspaceThemeAccess = bindWorkspaceThemeAccess(scoped.context, {
    workspaceId: context.workspaceId!,
    pluginId,
  });
  const session: AppSession = {
    authz: scoped,
    tenantId: context.tenantId,
    workspaceId: context.workspaceId!,
    pluginId,
  };
  return {
    session,
    context,
    scopedAuthz: scoped,
    workspaceThemeAccess,
    plugin,
  };
}

export { bootstrapPlugin };
