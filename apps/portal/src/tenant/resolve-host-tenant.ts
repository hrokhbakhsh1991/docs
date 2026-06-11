import { isDevWebSessionAllowed } from "./auth-env";

const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const URBAN_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000004";

const PHASE_43_HOST_TENANT_IDS: Record<string, string> = {
  "tenant-a": "00000000-0000-4000-8000-000000000001",
  "tenant-b": "00000000-0000-4000-8000-000000000002",
  denali: DENALI_SMOKE_TENANT_ID,
  urban: URBAN_SMOKE_TENANT_ID,
  "urban-owner": URBAN_SMOKE_TENANT_ID,
  "urban-member": URBAN_SMOKE_TENANT_ID,
  operator: "00000000-0000-4000-8000-000000000014",
};

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
