import { Module } from "@nestjs/common";
import Redis from "ioredis";
import { ConfigModule } from "../../config/config.module";
import { ConfigService } from "../../config/config.service";
import { TENANT_RATE_LIMIT_POLICY } from "../contracts/tenant-runtime.contract";
import { LoggerModule } from "../logger/logger.module";
import { RequestContextModule } from "../request-context/request-context.module";
import { TENANT_ABUSE_REDIS } from "./tenant-abuse.constants";
import { TenantAbuseMetricsService } from "./tenant-abuse-metrics.service";
import { TenantRateLimitMiddleware } from "./tenant-rate-limit.middleware";
import { TenantRateLimitService } from "./tenant-rate-limit.service";

@Module({
  imports: [ConfigModule, LoggerModule, RequestContextModule],
  providers: [
    TenantAbuseMetricsService,
    {
      provide: TENANT_ABUSE_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.getRedisConfig();
        return new Redis({
          host: redis.host,
          port: redis.port,
          maxRetriesPerRequest: 2,
          lazyConnect: true
        });
      }
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
