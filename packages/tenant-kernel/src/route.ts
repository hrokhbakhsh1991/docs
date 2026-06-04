/** Hybrid routing design stub — pool default; silo implemented in Phase 7. */
export type TenantTier = "pool" | "silo";

export interface TenantRoute {
  readonly tenantId: string;
  readonly tier: TenantTier;
  readonly databaseUrl: string;
}
