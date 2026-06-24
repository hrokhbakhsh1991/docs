/** Dev-only pluginId from known smoke tenant UUIDs — prod uses API tenant-context. */
const SMOKE_TENANT_PLUGIN_IDS: Readonly<Record<string, string>> = {
  "00000000-0000-4000-8000-000000000003": "denali",
  "00000000-0000-4000-8000-000000000014": "denali",
  "00000000-0000-4000-8000-000000000004": "urban",
};

export const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";

/** P9-2 — no hostname.includes; dev pluginId from tenant UUID map only. */
export function resolveDevPluginIdForTenantId(tenantId: string): string {
  return SMOKE_TENANT_PLUGIN_IDS[tenantId] ?? "denali";
}
