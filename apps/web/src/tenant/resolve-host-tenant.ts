import { isDevWebSessionAllowed } from "./auth-env";
import {
  isOperatorAdminHost,
  resolveClubSubdomainFromHost,
  resolveMultiLevelHost,
} from "./resolve-multi-level-host";

/** Phase 6.6 smoke — sync with `@app-tour/workspace-denali` DENALI_SMOKE_TENANT_ID. */
const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";

/** Phase 7.3 smoke — sync with `@app-tour/workspace-urban` URBAN_SMOKE_TENANT_ID. */
const URBAN_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000004";

/** MAP 4.3 stable seed UUIDs — must match ProvisioningService / tenant-registry. */
const PHASE_43_HOST_TENANT_IDS: Record<string, string> = {
  "tenant-a": "00000000-0000-4000-8000-000000000001",
  "tenant-b": "00000000-0000-4000-8000-000000000002",
  denali: DENALI_SMOKE_TENANT_ID,
  urban: URBAN_SMOKE_TENANT_ID,
  "urban-owner": URBAN_SMOKE_TENANT_ID,
  "urban-member": URBAN_SMOKE_TENANT_ID,
  alborz: DENALI_SMOKE_TENANT_ID,
  /** Phase 9.8 operator smoke — sync OPERATOR_SMOKE.tenantId */
  operator: "00000000-0000-4000-8000-000000000014",
};

function mapSubdomainToTenantId(subdomain: string): string | null {
  return PHASE_43_HOST_TENANT_IDS[subdomain] ?? null;
}

/**
 * Dev-only: map multi-level and single-level localhost hosts to seeded tenant UUID.
 * Production ingress resolves tenant via auth — not host env alone.
 */
export function resolveTenantIdFromDevHost(host: string): string | null {
  if (!isDevWebSessionAllowed()) {
    return null;
  }

  const outcome = resolveMultiLevelHost(host);
  if (
    outcome.kind === "club_admin" ||
    outcome.kind === "club_portal" ||
    outcome.kind === "club_apex"
  ) {
    return mapSubdomainToTenantId(outcome.subdomain);
  }

  const subdomain = resolveClubSubdomainFromHost(host);
  if (subdomain !== null) {
    return mapSubdomainToTenantId(subdomain);
  }

  return null;
}
