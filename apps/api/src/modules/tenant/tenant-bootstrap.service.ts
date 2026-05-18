import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { parseTenantEnabledModules } from "../../common/rbac/parse-tenant-enabled-modules";
import { RequestContextService } from "../../common/request-context/request-context.service";

/**
 * Resolves `tenant_id` for a tour **before** `app.tenant_id` session binding exists.
 *
 * Used **only** for anonymous “public bootstrap” HTTP flows (e.g. `POST …/tours/:tourId/register`,
 * `POST …/tours/:tourId/waitlist`) where RLS would otherwise block reading `tours`.
 * Do **not** use for authenticated
 * routes — those must rely on JWT-bound tenant context.
 */
@Injectable()
export class TenantBootstrapService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService
  ) {}

  async resolvePublicTourBootstrapContext(
    tourId: string
  ): Promise<{ tenantId: string; enabledModules: readonly string[] } | null> {
    return this.requestContextService.runWithoutTenantBinding(
      "public_tour_bootstrap_lookup",
      async () => {
        const rows = (await this.dataSource.query(
          `SELECT t.tenant_id::text AS tenant_id, tn.enabled_modules
             FROM tours t
             INNER JOIN tenants tn ON tn.id = t.tenant_id AND tn.deleted_at IS NULL
            WHERE t.id = $1::uuid
              AND t.deleted_at IS NULL`,
          [tourId]
        )) as Array<{ tenant_id: string | null; enabled_modules: unknown }>;
        const row = rows[0];
        if (!row?.tenant_id) {
          return null;
        }
        return {
          tenantId: row.tenant_id,
          enabledModules: parseTenantEnabledModules(row.enabled_modules)
        };
      }
    );
  }

  async resolveTenantFromTourId(tourId: string): Promise<string | null> {
    const context = await this.resolvePublicTourBootstrapContext(tourId);
    return context?.tenantId ?? null;
  }
}
