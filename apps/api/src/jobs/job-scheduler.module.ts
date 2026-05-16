import { Global, Module } from "@nestjs/common";
import { EmailVerificationTokensCleanupJob } from "./email-verification-tokens-cleanup.job";
import { DatabaseModule } from "../database/database.module";
import { IdempotencyModule } from "../modules/idempotency/idempotency.module";
import { IdempotencyCleanupJob } from "./idempotency-cleanup.job";
import { SchedulerLockService } from "./scheduler-lock.service";
import { SchedulerRuntimeMetricsService } from "./scheduler-runtime-metrics.service";

@Global()
@Module({
  imports: [DatabaseModule, IdempotencyModule],
  providers: [
    IdempotencyCleanupJob,
    EmailVerificationTokensCleanupJob,
    SchedulerLockService,
    SchedulerRuntimeMetricsService
  ],
  exports: [SchedulerLockService, SchedulerRuntimeMetricsService]
})
export class JobSchedulerModule {}
