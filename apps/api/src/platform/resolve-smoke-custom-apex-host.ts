/**
 * WRS smoke — in-memory custom apex map when DATABASE_URL is absent (Playwright portal smoke).
 * @see docs/phase-19/p6/runbooks/denali-club-cutover.md
 */
export const WRS_SMOKE_DENALI_TENANT_ID = "00000000-0000-4000-8000-000000000003";

export type SmokeCustomApexResolution = {
  readonly tenantId: string;
  readonly subdomain: string;
  readonly surface: string;
};

const WRS_SMOKE_CUSTOM_APEX_MAP: Readonly<Record<string, SmokeCustomApexResolution>> = {
  "denali.club": {
    tenantId: WRS_SMOKE_DENALI_TENANT_ID,
    subdomain: "denali",
    surface: "marketing",
  },
  "portal.denali.club": {
    tenantId: WRS_SMOKE_DENALI_TENANT_ID,
    subdomain: "denali",
    surface: "portal",
  },
  "admin.denali.club": {
    tenantId: WRS_SMOKE_DENALI_TENANT_ID,
    subdomain: "denali",
    surface: "admin",
  },
};

export function isWrsSmokeCustomApexEnabled(): boolean {
  return process.env.WRS_SMOKE_CUSTOM_APEX?.trim() === "1";
}

export function resolveSmokeCustomApexHost(hostname: string): SmokeCustomApexResolution | null {
  if (!isWrsSmokeCustomApexEnabled()) {
    return null;
  }
  const normalized = hostname.split(":")[0]?.trim().toLowerCase() ?? "";
  if (normalized.length === 0) {
    return null;
  }
  return WRS_SMOKE_CUSTOM_APEX_MAP[normalized] ?? null;
}
