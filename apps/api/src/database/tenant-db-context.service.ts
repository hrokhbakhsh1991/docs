import { Inject, Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { TenantSessionBindingService } from "./tenant-session-binding.service";

@Injectable()
export class TenantDbContextService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    private readonly tenantSessionBindingService: TenantSessionBindingService
  ) {}

  async runInTenantScope<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    if (!normalizedTenantId) {
      throw new Error("TENANT_CONTEXT_MISSING");
    }
    return this.tenantSessionBindingService.runInTenantContext(normalizedTenantId, async () =>
      this.dataSource.transaction(async (manager) => {
        await manager.query("SELECT set_config('app.tenant_id', $1, true)", [
          normalizedTenantId
        ]);
        return fn(manager);
      })
    );
  }
}
