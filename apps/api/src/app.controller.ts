import {
  Controller,
  Get,
  ServiceUnavailableException
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { LoggerService } from "./common/logger/logger.service";
import { RequestContextService } from "./common/request-context/request-context.service";

@Controller()
export class AppController {
  constructor(
    private readonly requestContextService: RequestContextService,
    private readonly loggerService: LoggerService,
    @InjectDataSource() private readonly dataSource: DataSource
  ) {}

  @Get("health")
  health() {
    this.loggerService.info("health check requested");

    return {
      status: "ok",
      requestId: this.requestContextService.getRequestId()
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
      await this.dataSource.query("SELECT 1 AS ok");
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
