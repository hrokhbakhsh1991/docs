import { Inject, Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { TenantSessionBindingService } from "./tenant-session-binding.service";

@Injectable()
export class TenantDbContextService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(TenantSessionBindingService)
    private readonly tenantSessionBindingService: TenantSessionBindingService
  ) {}

  /**
   * Runs work in ALS tenant scope; RLS GUC injection is handled automatically by
   * {@link TenantSessionBindingService} on the transaction QueryRunner.
   */
  async runInTenantScope<T>(
    tenantId: string,
    fn: (_manager: EntityManager) => Promise<T>
  ): Promise<T> {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    if (!normalizedTenantId) {
      throw new Error("TENANT_CONTEXT_MISSING");
    }
    return this.tenantSessionBindingService.runInTenantContext(normalizedTenantId, async () =>
      this.dataSource.transaction(async (manager) => fn(manager))
    );
  }
}
