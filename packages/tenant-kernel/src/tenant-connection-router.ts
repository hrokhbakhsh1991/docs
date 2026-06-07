import { resolveTenantRoute } from "./resolve-tenant-route";
import type { TenantRoute } from "./route";
import type { TenantRouteRow } from "./tenant-route-row";

export type TenantRouteLookup = (tenantId: string) => Promise<TenantRouteRow | null>;

/**
 * Resolves per-tenant DB route from injected lookup (no Prisma in this package).
 */
export class TenantConnectionRouter {
  constructor(
    private readonly lookup: TenantRouteLookup,
    private readonly poolDatabaseUrl: string
  ) {}

  async resolveRoute(tenantId: string): Promise<TenantRoute> {
    const row = await this.lookup(tenantId);
    return resolveTenantRoute(tenantId, row, { poolDatabaseUrl: this.poolDatabaseUrl });
  }
}
