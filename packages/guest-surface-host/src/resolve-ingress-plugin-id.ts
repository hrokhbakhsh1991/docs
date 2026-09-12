import { resolveDevPluginIdForTenantId } from "./resolve-dev-plugin-id";
import { resolveTenantIdFromIngressLabel } from "./phase-43-host-tenant-ids";
import { resolvePluginIdFromIngressHost } from "./resolve-plugin-id-from-ingress-host";
import {
  readDefaultPublicTenantIdFromEnv,
  readPublicFallbackHostsFromEnv,
} from "./read-public-fallback-hosts";
import { resolveProductionIngressLabelFromHost } from "./resolve-production-ingress-label";

function tryPluginIdFromTenantId(tenantId: string): string | null {
  try {
    return resolveDevPluginIdForTenantId(tenantId);
  } catch {
    return null;
  }
}

function resolveProductionFallbackPluginId(host: string): string | null {
  const label = resolveProductionIngressLabelFromHost(host);
  if (label !== null) {
    const tenantId = resolveTenantIdFromIngressLabel(label);
    if (tenantId !== null) {
      const pluginId = tryPluginIdFromTenantId(tenantId);
      if (pluginId !== null) {
        return pluginId;
      }
    }
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const allowedHosts = readPublicFallbackHostsFromEnv();
  if (allowedHosts.size > 0 && allowedHosts.has(hostname)) {
    const tenantId = readDefaultPublicTenantIdFromEnv();
    if (tenantId !== null) {
      return tryPluginIdFromTenantId(tenantId);
    }
  }

  return null;
}

/**
 * Resolve workspace plugin id for ingress host.
 * Prefers explicit bootstrap pluginId, then host parsing, then production VPS fallback.
 */
export function resolveIngressPluginId(
  host: string,
  pluginIdOverride?: string | null
): string | null {
  const explicit = pluginIdOverride?.trim();
  if (explicit !== undefined && explicit.length > 0) {
    return explicit;
  }

  const fromHost = resolvePluginIdFromIngressHost(host);
  if (fromHost !== null) {
    return fromHost;
  }

  return resolveProductionFallbackPluginId(host);
}
