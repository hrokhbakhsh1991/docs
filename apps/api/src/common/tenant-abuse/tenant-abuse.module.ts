import { Module } from "@nestjs/common";
import { ConfigModule } from "../../config/config.module";
import { TENANT_RATE_LIMIT_POLICY } from "../contracts/tenant-runtime.contract";
import { LoggerModule } from "../logger/logger.module";
import { RequestContextModule } from "../request-context/request-context.module";
import { TENANT_ABUSE_REDIS } from "./tenant-abuse.constants";
import { TenantAbuseMetricsService } from "./tenant-abuse-metrics.service";
import { TenantRateLimitMiddleware } from "./tenant-rate-limit.middleware";
import { TenantRateLimitService } from "./tenant-rate-limit.service";

import { REDIS_CLIENT } from "../../infra/redis/redis.constants";

@Module({
  imports: [ConfigModule, LoggerModule, RequestContextModule],
  providers: [
    TenantAbuseMetricsService,
    {
      provide: TENANT_ABUSE_REDIS,
      useExisting: REDIS_CLIENT
    },
    TenantRateLimitService,
    {
      provide: TENANT_RATE_LIMIT_POLICY,
      useExisting: TenantRateLimitService
    },
    TenantRateLimitMiddleware
  ],
  exports: [
    TenantAbuseMetricsService,
    TenantRateLimitService,
    TENANT_RATE_LIMIT_POLICY,
    TenantRateLimitMiddleware,
    TENANT_ABUSE_REDIS
  ]
})
export class TenantAbuseModule {}
