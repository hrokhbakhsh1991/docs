/** Hybrid routing — pool default; silo opt-in via tenant_routes (Phase 7.7). */
export type TenantTier = "pool" | "silo";

export interface TenantRoute {
  readonly tenantId: string;
  readonly tier: TenantTier;
  readonly databaseUrl: string;
  readonly schemaName?: string;
  readonly useRls: boolean;
}
