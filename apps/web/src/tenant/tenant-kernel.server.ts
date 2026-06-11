import {
  bindWorkspaceThemeAccess,
  createTenantAuthz,
} from "@app-tour/workspace-sdk/auth";
import type { TenantThemeConfig } from "@app-tour/workspace-sdk";

import { resolveBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import type { AppSession } from "@/session/app-session";

import { isDevWebSessionAllowed } from "./auth-env";
import { resolveTenantIdFromDevHost } from "./resolve-host-tenant";
import {
  bootstrapPlugin,
  resolveBootstrapPluginIdForTenant,
  resolveContextFromEnv,
  resolveTenantContext,
} from "./tenant-kernel.shared";
import type {
  ResolvedBootstrapSession,
  SerializableBootstrap,
  TenantKernelResolveInput,
} from "./tenant-kernel.types";

export type {
  ResolvedBootstrapSession,
  SerializableBootstrap,
  TenantKernelResolveInput,
} from "./tenant-kernel.types";

export {
  bootstrapPlugin,
  resolveBootstrapPluginIdForTenant,
  resolveContextFromEnv,
  resolveTenantContext,
};

const URBAN_SMOKE_E2E_WORKSPACE_ID = "00000000-0000-4000-8000-000000000403";
const URBAN_SMOKE_E2E_OWNER_USER_ID = "00000000-0000-4000-8000-000000000401";
const URBAN_SMOKE_E2E_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000402";

const DEV_HOST_SESSION_PROFILES: Readonly<Record<string, Partial<TenantKernelResolveInput>>> = {
  "deny-theme": {
    userId: "deny-theme-user",
    role: "member",
    status: "SUSPENDED",
  },
  "urban-owner": {
    userId: URBAN_SMOKE_E2E_OWNER_USER_ID,
    workspaceId: URBAN_SMOKE_E2E_WORKSPACE_ID,
    role: "owner",
    status: "ACTIVE",
  },
  "urban-member": {
    userId: URBAN_SMOKE_E2E_MEMBER_USER_ID,
    workspaceId: URBAN_SMOKE_E2E_WORKSPACE_ID,
    role: "member",
    status: "ACTIVE",
  },
};

function resolveDevSessionProfileFromHost(host: string): Partial<TenantKernelResolveInput> | null {
  if (!isDevWebSessionAllowed()) {
    return null;
  }
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const match = /^([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (!match?.[1]) {
    return null;
  }
  return DEV_HOST_SESSION_PROFILES[match[1]] ?? null;
}

/** Per-request bootstrap with optional Host-based tenant override (dev e2e / TH-1). */
export function resolveBootstrapAppSessionForHost(host: string): ResolvedBootstrapSession {
  const base = resolveContextFromEnv();
  const profile = resolveDevSessionProfileFromHost(host);
  const withProfile = profile ? { ...base, ...profile } : base;
  const hostTenantId = resolveTenantIdFromDevHost(host);
  if (hostTenantId) {
    return resolveBootstrapAppSession({ ...withProfile, tenantId: hostTenantId }, host);
  }
  return resolveBootstrapAppSession(withProfile, host);
}

/** Per-request bootstrap (call from Server Components only). */
export function resolveBootstrapAppSession(
  input: TenantKernelResolveInput = resolveContextFromEnv(),
  host?: string
): ResolvedBootstrapSession {
  const context = resolveTenantContext(input);
  const scoped = createTenantAuthz(context);
  const pluginId = resolveBootstrapPluginIdForTenant(context.tenantId, host);
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
    plugin: resolveBootstrapWorkspacePlugin(pluginId),
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
