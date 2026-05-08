import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
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

  async resolveTenantFromTourId(tourId: string): Promise<string | null> {
    return this.requestContextService.runWithoutTenantBinding(
      "public_tour_bootstrap_lookup",
      async () => {
        const rows = (await this.dataSource.query(
          `SELECT tenant_id::text AS tenant_id
             FROM tours
            WHERE id = $1::uuid
              AND deleted_at IS NULL`,
          [tourId]
        )) as Array<{ tenant_id: string | null }>;
        return rows[0]?.tenant_id ?? null;
      }
    );
  }
}
