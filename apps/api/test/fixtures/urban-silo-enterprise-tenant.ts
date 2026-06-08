/**
 * Phase 8.3 — enterprise urban silo fixture (platform ops / test only).
 * @see docs/phase-8/subphases/8.3-silo-tier.md · P8-3-A04
 */
export const URBAN_SILO_ENTERPRISE_TENANT_ID = "00000000-0000-4000-8000-000000000406" as const;

export const URBAN_SILO_ENTERPRISE_PUBLISHED_TOUR_ID =
  "00000000-0000-4000-8000-000000000412" as const;

/** Dedicated silo DB URL — resolved only via TenantConnectionRouter lookup, never env in handlers. */
export const URBAN_SILO_ENTERPRISE_DATABASE_URL =
  "postgresql://silo-enterprise:5432/urban_dedicated" as const;

export const URBAN_SILO_ENTERPRISE_ROUTE_ROW = {
  tier: "silo" as const,
  databaseUrl: URBAN_SILO_ENTERPRISE_DATABASE_URL,
  schemaName: null,
};
