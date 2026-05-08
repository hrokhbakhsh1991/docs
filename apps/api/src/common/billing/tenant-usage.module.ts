import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TENANT_USAGE_METERING_POLICY } from "../contracts/tenant-runtime.contract";
import { LoggerModule } from "../logger/logger.module";
import { RequestContextModule } from "../request-context/request-context.module";
import { TenantPlanLimitsEntity } from "./entities/tenant-plan-limits.entity";
import { TenantUsageDailyEntity } from "./entities/tenant-usage-daily.entity";
import { TenantUsageMeteringService } from "./tenant-usage-metering.service";
import { TenantUsageMiddleware } from "./tenant-usage.middleware";

@Global()
@Module({
  imports: [
    LoggerModule,
    RequestContextModule,
    TypeOrmModule.forFeature([TenantUsageDailyEntity, TenantPlanLimitsEntity])
  ],
  providers: [
    TenantUsageMeteringService,
    {
      provide: TENANT_USAGE_METERING_POLICY,
      useExisting: TenantUsageMeteringService
    },
    TenantUsageMiddleware
  ],
  exports: [
    TenantUsageMeteringService,
    TENANT_USAGE_METERING_POLICY,
    TenantUsageMiddleware,
    TypeOrmModule
  ]
})
export class TenantUsageModule {}

