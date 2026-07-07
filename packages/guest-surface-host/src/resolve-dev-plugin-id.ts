import { DEV_PLUGIN_ID_BY_TENANT_ID } from "./workspace-dev-plugin-ids.generated";

export class DevPluginIdUnresolvedError extends Error {
  readonly code = "DEV_PLUGIN_ID_UNRESOLVED" as const;

  constructor(tenantId: string) {
    super(`DEV_PLUGIN_ID_UNRESOLVED:${tenantId}`);
    this.name = "DevPluginIdUnresolvedError";
  }
}

export const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";

/** P9-2 — no hostname.includes; dev pluginId from tenant UUID map only. */
export function resolveDevPluginIdForTenantId(tenantId: string): string {
  const pluginId = DEV_PLUGIN_ID_BY_TENANT_ID[tenantId];
  if (pluginId === undefined) {
    throw new DevPluginIdUnresolvedError(tenantId);
  }
  return pluginId;
}
