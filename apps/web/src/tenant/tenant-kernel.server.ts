import {
  bindWorkspaceThemeAccess,
  createTenantAuthz,
} from "@app-tour/workspace-sdk/auth";
import type { TenantThemeConfig } from "@app-tour/workspace-sdk";

import { resolveBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import type { AppSession } from "@/session/app-session";

import { isDevWebSessionAllowed } from "./auth-env";
import { fetchPublicTenantContextForHost } from "./fetch-public-tenant-context.server";
import { resolveDevSessionProfileFromHost } from "./dev-host-session-profiles";
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

function resolveDevSessionProfileForHost(host: string) {
  if (!isDevWebSessionAllowed()) {
    return null;
  }
  return resolveDevSessionProfileFromHost(host);
}

/** Per-request bootstrap with optional Host-based tenant override (dev e2e / TH-1). */
export function resolveBootstrapAppSessionForHost(host: string): ResolvedBootstrapSession {
  const base = resolveContextFromEnv();
  const profile = resolveDevSessionProfileForHost(host);
  const withProfile = profile ? { ...base, ...profile } : base;
  const hostTenantId = resolveTenantIdFromDevHost(host);
  if (hostTenantId) {
    return resolveBootstrapAppSession({ ...withProfile, tenantId: hostTenantId }, host);
  }
  return resolveBootstrapAppSession(withProfile, host);
}

/**
 * Root layout bootstrap — static dev map, then public tenant-context for provisioned club hosts.
 * @see docs/phase-15/platform-host-multilevel.mdoc § Session bind vs BFF tenant resolution
 */
export async function resolveBootstrapAppSessionForHostAsync(
  host: string
): Promise<ResolvedBootstrapSession> {
  const hostTenantId = resolveTenantIdFromDevHost(host);
  if (hostTenantId) {
    return resolveBootstrapAppSessionForHost(host);
  }

  const publicContext = await fetchPublicTenantContextForHost(host);
  if (publicContext !== null) {
    const base = resolveContextFromEnv();
    const profile = resolveDevSessionProfileForHost(host);
    const withProfile = profile ? { ...base, ...profile } : base;
    return resolveBootstrapAppSession(
      { ...withProfile, tenantId: publicContext.tenantId },
      host,
      { pluginId: publicContext.pluginId }
    );
  }

  return resolveBootstrapAppSessionForHost(host);
}

/** Per-request bootstrap (call from Server Components only). */
export function resolveBootstrapAppSession(
  input: TenantKernelResolveInput = resolveContextFromEnv(),
  host?: string,
  options?: { readonly pluginId?: string }
): ResolvedBootstrapSession {
  const context = resolveTenantContext(input);
  const scoped = createTenantAuthz(context);
  const pluginId = options?.pluginId ?? resolveBootstrapPluginIdForTenant(context.tenantId, host);
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
