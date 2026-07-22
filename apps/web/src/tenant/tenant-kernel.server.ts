import {
  bindWorkspaceThemeAccess,
  createTenantAuthz,
} from "@app-tour/workspace-sdk/auth";
import type { TenantThemeConfig } from "@app-tour/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import type { AppSession } from "@/session/app-session";

import { isDevWebSessionAllowed } from "./auth-env";
import { resolveAdminBootstrapForWebHost } from "./resolve-admin-bootstrap.server";
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
export async function resolveBootstrapAppSessionForHost(host: string): Promise<ResolvedBootstrapSession> {
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
 * Root layout bootstrap — static dev map, then ASB-001 admin bootstrap (fail-closed in prod).
 * @see docs/standards/platform-surface-cohesion.mdoc § ASB-001
 */
export async function resolveBootstrapAppSessionForHostAsync(
  host: string
): Promise<ResolvedBootstrapSession> {
  const hostTenantId = resolveTenantIdFromDevHost(host);
  if (hostTenantId) {
    return resolveBootstrapAppSessionForHost(host);
  }

  const adminBootstrap = await resolveAdminBootstrapForWebHost(host);
  const base = resolveContextFromEnv();
  const profile = resolveDevSessionProfileForHost(host);
  const withProfile = profile ? { ...base, ...profile } : base;
  return resolveBootstrapAppSession(
    { ...withProfile, tenantId: adminBootstrap.tenantId },
    host,
    { pluginId: adminBootstrap.pluginId }
  );
}

/** Per-request bootstrap (call from Server Components only). */
export async function resolveBootstrapAppSession(
  input: TenantKernelResolveInput = resolveContextFromEnv(),
  host?: string,
  options?: { readonly pluginId?: string }
): Promise<ResolvedBootstrapSession> {
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
    plugin: await loadBootstrapWorkspacePlugin(pluginId),
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
