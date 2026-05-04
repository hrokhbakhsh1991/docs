import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, type QueryRunner } from "typeorm";
import { LoggerService } from "../common/logger/logger.service";
import { RequestContextService } from "../common/request-context/request-context.service";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_BINDING_PATCHED = Symbol("tenantBindingPatched");
const HEALTH_PATH_PREFIXES = [
  "/health",
  "/health/live",
  "/health/ready",
  "/health/readiness"
] as const;

/**
 * Paths aligned with tenant.middleware bypass for anonymous tour flows.
 * Only POST is registered in Nest for these URLs; require POST here so a future GET on the
 * same pattern cannot skip `set_config` without going through bootstrap.
 */
const PUBLIC_TOUR_FLOW_PATH = /^\/api\/v2\/tours\/[^/]+\/(register|waitlist)$/;

@Injectable()
export class TenantSessionBindingService implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly requestContextService: RequestContextService,
    private readonly loggerService: LoggerService
  ) {}

  onModuleInit(): void {
    if (
      (this.dataSource as DataSource & { [TENANT_BINDING_PATCHED]?: boolean })[
        TENANT_BINDING_PATCHED
      ]
    ) {
      return;
    }

    const originalCreateQueryRunner =
      this.dataSource.createQueryRunner.bind(this.dataSource);

    this.dataSource.createQueryRunner = (mode) => {
      const queryRunner = originalCreateQueryRunner(mode);
      const originalConnect = queryRunner.connect.bind(queryRunner);
      let tenantBound = false;

      queryRunner.connect = async () => {
        const connected = await originalConnect();

        if (!tenantBound) {
          tenantBound = true;
          await this.bindTenantId(queryRunner);
        }

        return connected;
      };

      return queryRunner;
    };

    (
      this.dataSource as DataSource & { [TENANT_BINDING_PATCHED]?: boolean }
    )[TENANT_BINDING_PATCHED] = true;
  }

  async bindTenantId(queryRunner: QueryRunner): Promise<void> {
    const context = this.getRequestContextOrUndefined();
    if (!context) {
      return;
    }

    const requestPath = context.path;
    const requestMethod = context.method;
    if (
      typeof requestPath === "string" &&
      HEALTH_PATH_PREFIXES.some((prefix) => requestPath.startsWith(prefix))
    ) {
      return;
    }

    const tenantId = context.tenantId;

    if (!tenantId) {
      if (
        requestMethod === "POST" &&
        typeof requestPath === "string" &&
        PUBLIC_TOUR_FLOW_PATH.test(requestPath)
      ) {
        return;
      }
      this.loggerService.error("tenant session binding failed: missing tenant", {
        requestId: context.requestId
      });
      throw new Error("TENANT_CONTEXT_MISSING");
    }

    if (!UUID_V4_REGEX.test(tenantId)) {
      this.loggerService.error(
        "tenant session binding failed: malformed tenant id",
        {
          requestId: context.requestId,
          tenantId
        }
      );
      throw new Error("TENANT_CONTEXT_INVALID");
    }

    await queryRunner.query(
      "SELECT set_config('app.tenant_id', $1, false)",
      [tenantId]
    );
  }

  private getRequestContextOrUndefined():
    | { requestId: string; path?: string; method?: string; tenantId?: string }
    | undefined {
    try {
      const context = this.requestContextService.getContext();
      return {
        requestId: context.requestId,
        path: context.path,
        method: context.method,
        tenantId: context.tenantId
      };
    } catch {
      return undefined;
    }
  }
}
