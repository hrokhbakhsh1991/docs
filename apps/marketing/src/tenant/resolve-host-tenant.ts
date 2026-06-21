import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
} from "@app-tour/tenant-kernel";

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

function mapSubdomain(subdomain: string): string | null {
  return PHASE_43_HOST_TENANT_IDS[subdomain] ?? null;
}

/**
 * Dev-only: map club apex / legacy hosts to seeded tenant UUID.
 */
export function resolveTenantIdFromDevHost(host: string): string | null {
  if (!isDevMarketingHostAllowed()) {
    return null;
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  const outcome = parseMultiLevelTenantHost(hostname, "localhost", reserved);
  if (outcome.kind === "club_apex") {
    return mapSubdomain(outcome.subdomain);
  }

  const shopMatch = /^shop\.([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (shopMatch?.[1]) {
    return mapSubdomain(shopMatch[1]);
  }

  return null;
}

export { DEFAULT_TENANT_HOST_RESERVED_LABELS };
