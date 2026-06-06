import { isDevWebSessionAllowed } from "./auth-env";

/** Phase 6.6 smoke — sync with `@app-tour/workspace-denali` DENALI_SMOKE_TENANT_ID. */
const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";

/** MAP 4.3 stable seed UUIDs — must match ProvisioningService / tenant-registry. */
const PHASE_43_HOST_TENANT_IDS: Record<string, string> = {
  "tenant-a": "00000000-0000-4000-8000-000000000001",
  "tenant-b": "00000000-0000-4000-8000-000000000002",
  denali: DENALI_SMOKE_TENANT_ID,
};

/**
 * Dev-only: map `{label}.localhost` host to seeded tenant UUID for TH-1 e2e.
 * Production ingress resolves tenant via auth — not host env alone.
 */
export function resolveTenantIdFromDevHost(host: string): string | null {
  if (!isDevWebSessionAllowed()) {
    return null;
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const match = /^([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (!match?.[1]) {
    return null;
  }

  return PHASE_43_HOST_TENANT_IDS[match[1]] ?? null;
}
