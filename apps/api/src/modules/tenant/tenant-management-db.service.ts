import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, QueryRunner } from "typeorm";
import { LoggerService } from "../../common/logger/logger.service";
import { RequestContextService } from "../../common/request-context/request-context.service";

@Injectable()
export class TenantManagementDbService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService) private readonly loggerService: LoggerService
  ) {}

  async listUserWorkspacesForAuth(userId: string): Promise<
    Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_subdomain: string;
      role: string;
      session_version: number;
    }>
  > {
    return this.runWithRowSecurityBypass(
      "list_user_workspaces_for_auth",
      async (queryRunner) =>
        queryRunner.query(
          `SELECT ut.tenant_id::text AS tenant_id,
                  t.name::text AS tenant_name,
                  COALESCE(NULLIF(trim(t.subdomain), ''), '')::text AS tenant_subdomain,
                  ut.role::text AS role,
                  ut.session_version::integer AS session_version
             FROM user_tenants ut
             INNER JOIN tenants t ON t.id = ut.tenant_id AND t.deleted_at IS NULL
            WHERE ut.user_id = $1::uuid
              AND ut.deleted_at IS NULL`,
          [userId]
        )
    );
  }

  private async runWithRowSecurityBypass<T>(
    operation: string,
    fn: (_queryRunner: QueryRunner) => Promise<T>
  ): Promise<T> {
    const requestId = this.requestContextService.tryGetRequestId();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Local transaction-only bypass for legacy bootstrap/auth flows.
      await queryRunner.query("SET LOCAL row_security = off");
      this.loggerService.warn("tenant management row_security bypass opened", {
        operation,
        requestId
      });
      const result = await fn(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.loggerService.error("tenant management row_security bypass failed", {
        operation,
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
