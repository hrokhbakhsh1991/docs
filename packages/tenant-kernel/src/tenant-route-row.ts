import type { TenantTier } from "./route";

/** Row shape from tenant_routes lookup (apps/api Prisma adapter). */
export type TenantRouteRow = {
  readonly tier: TenantTier;
  readonly databaseUrl: string | null;
  readonly schemaName: string | null;
};
