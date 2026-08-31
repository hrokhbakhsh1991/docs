import { isMemberPortalEnabled } from "@app-tour/workspace-sdk";

import { resolvePluginIdFromIngressHost } from "./resolve-plugin-id-from-ingress-host";

function readValidatedPluginIdOverride(pluginIdOverride?: string): string | null {
  if (pluginIdOverride === undefined) {
    return null;
  }
  const trimmed = pluginIdOverride.trim();
  if (trimmed.length === 0 || !isMemberPortalEnabled(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Host-derived pluginId wins; bootstrap override is fallback only when ingress cannot resolve.
 * Override must be a member-portal-enabled workspace plugin (fail-closed on unknown/disabled).
 */
export function resolveEffectivePluginIdForMemberEgress(
  host: string,
  pluginIdOverride?: string
): string | null {
  const fromHost = resolvePluginIdFromIngressHost(host);
  if (fromHost !== null) {
    return fromHost;
  }
  return readValidatedPluginIdOverride(pluginIdOverride);
}
