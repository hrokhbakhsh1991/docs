import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmailVerificationTokensCleanupJob } from "./email-verification-tokens-cleanup.job";
import { DatabaseModule } from "../database/database.module";
import { IdempotencyModule } from "../modules/idempotency/idempotency.module";
import { IdempotencyCleanupJob } from "./idempotency-cleanup.job";
import { TourWizardDraftEntity } from "../modules/tours/entities/tour-wizard-draft.entity";
import { TourWizardDraftCleanupJob } from "./tour-wizard-draft-cleanup.job";
import { SchedulerLockService } from "./scheduler-lock.service";
import { SchedulerRuntimeMetricsService } from "./scheduler-runtime-metrics.service";

@Global()
@Module({
  imports: [DatabaseModule, IdempotencyModule, TypeOrmModule.forFeature([TourWizardDraftEntity])],
  providers: [
    IdempotencyCleanupJob,
    EmailVerificationTokensCleanupJob,
    TourWizardDraftCleanupJob,
    SchedulerLockService,
    SchedulerRuntimeMetricsService
  ],
  exports: [SchedulerLockService, SchedulerRuntimeMetricsService]
})
export class JobSchedulerModule {}
