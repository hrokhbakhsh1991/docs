import {
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
} from "@app-tour/tenant-kernel";

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

function mapSubdomain(subdomain: string): string | null {
  return PHASE_43_HOST_TENANT_IDS[subdomain] ?? null;
}

export function resolveTenantIdFromDevHost(host: string): string | null {
  if (!isDevWebSessionAllowed()) {
    return null;
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  const outcome = parseMultiLevelTenantHost(hostname, "localhost", reserved);
  if (outcome.kind === "club_portal" || outcome.kind === "club_apex") {
    return mapSubdomain(outcome.subdomain);
  }

  return null;
}
