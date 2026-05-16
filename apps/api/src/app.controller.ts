import {
  Controller,
  Get,
  Inject,
  Optional,
  ServiceUnavailableException
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { LoggerService } from "./common/logger/logger.service";
import { RequestContextService } from "./common/request-context/request-context.service";
import { RuntimeSchemaGuardService } from "./database/runtime-schema-guard.service";

@Controller()
export class AppController {
  constructor(
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService) private readonly loggerService: LoggerService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() private readonly runtimeSchemaGuardService?: RuntimeSchemaGuardService
  ) {}

  @Get("health")
  health() {
    this.loggerService.info("health check requested");

    const degraded = this.runtimeSchemaGuardService?.isDegraded() ?? false;
    return {
      status: degraded ? "degraded" : "ok",
      requestId: this.requestContextService.getRequestId(),
      ...(degraded
        ? { degraded_reasons: { missing_columns: this.runtimeSchemaGuardService?.getMissingColumns() ?? [] } }
        : {})
    };
  }

  /** Process is running (no dependency checks). */
  @Get("health/live")
  healthLive() {
    return { status: "live" };
  }

  /** PostgreSQL reachable. */
  @Get("health/ready")
  async healthReady() {
    try {
      await this.requestContextService.runWithoutTenantBinding(
        "health_ready_probe",
        async () => {
          await this.dataSource.query("SELECT 1 AS ok");
        },
      );
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException({
        error: {
          code: "DEPENDENCY_TEMPORARY_UNAVAILABLE",
          message: "Service is not ready",
          retryability: "RETRY_WITH_BACKOFF",
          details: {
            reason: "database_unreachable"
          }
        }
      });
    }
  }

  /** Alias for readiness probe naming used by some clients. */
  @Get("health/readiness")
  async healthReadiness() {
    return this.healthReady();
  }
}
