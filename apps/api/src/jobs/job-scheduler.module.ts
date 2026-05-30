import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../database/database.module";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { IdempotencyModule } from "../modules/idempotency/idempotency.module";
import { EmailVerificationTokensCleanupJob } from "./email-verification-tokens-cleanup.job";
import { IdempotencyCleanupJob } from "./idempotency-cleanup.job";
import { SchedulerLockService } from "./scheduler-lock.service";
import { SchedulerRuntimeMetricsService } from "./scheduler-runtime-metrics.service";

@Global()
@Module({
  imports: [DatabaseModule, IdempotencyModule, TypeOrmModule.forFeature([TenantEntity])],
  providers: [
    IdempotencyCleanupJob,
    EmailVerificationTokensCleanupJob,
    SchedulerLockService,
    SchedulerRuntimeMetricsService
  ],
  exports: [SchedulerLockService, SchedulerRuntimeMetricsService]
})
export class JobSchedulerModule {}
