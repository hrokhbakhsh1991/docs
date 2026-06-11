import { isDevMarketingHostAllowed } from "./auth-env";

const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const URBAN_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";

const PHASE_43_HOST_TENANT_IDS: Record<string, string> = {
  "tenant-a": "00000000-0000-4000-8000-000000000001",
  "tenant-b": "00000000-0000-4000-8000-000000000002",
  denali: DENALI_SMOKE_TENANT_ID,
  urban: URBAN_SMOKE_TENANT_ID,
  operator: OPERATOR_SMOKE_TENANT_ID,
};

/**
 * Dev-only: map `{label}.localhost` or `shop.{label}.localhost` to seeded tenant UUID.
 */
export function resolveTenantIdFromDevHost(host: string): string | null {
  if (!isDevMarketingHostAllowed()) {
    return null;
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const shopMatch = /^shop\.([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (shopMatch?.[1]) {
    return PHASE_43_HOST_TENANT_IDS[shopMatch[1]] ?? null;
  }

  const match = /^([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (!match?.[1]) {
    return null;
  }

  return PHASE_43_HOST_TENANT_IDS[match[1]] ?? null;
}
