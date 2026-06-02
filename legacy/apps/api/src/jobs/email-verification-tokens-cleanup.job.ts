import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DeleteResult } from "typeorm";
import { DataSource } from "typeorm";

import { ConfigService } from "../config/config.service";
import { EmailVerificationTokenEntity } from "../modules/identity/entities/email-verification-token.entity";
import { SchedulerLockService } from "./scheduler-lock.service";
import { SchedulerRuntimeMetricsService } from "./scheduler-runtime-metrics.service";

const EMAIL_VERIFICATION_TOKENS_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class EmailVerificationTokensCleanupJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailVerificationTokensCleanupJob.name);
  private interval?: NodeJS.Timeout;
  private readonly jobName = "email_verification_tokens_cleanup";
  private readonly lockName = "scheduler:email_verification_tokens_cleanup";

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SchedulerLockService) private readonly schedulerLock: SchedulerLockService,
    @Inject(SchedulerRuntimeMetricsService)
    private readonly schedulerMetrics: SchedulerRuntimeMetricsService
  ) {}

  onModuleInit(): void {
    if (!this.configService.shouldRunSchedulers()) {
      this.logger.log(`job_skipped_runtime_role ${this.jobName}`);
      return;
    }
    const jitterMs = Math.floor(Math.random() * (this.configService.getSchedulerJitterMs() + 1));
    setTimeout(() => {
      void this.runOnceWithLock();
      this.interval = setInterval(() => {
        void this.runOnceWithLock();
      }, EMAIL_VERIFICATION_TOKENS_CLEANUP_INTERVAL_MS);
      this.interval.unref?.();
    }, jitterMs).unref?.();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async runOnceWithLock(): Promise<void> {
    const started = Date.now();
    this.schedulerMetrics.noteStarted(this.jobName);
    this.logger.log(`job_started ${this.jobName}`);
    try {
      const lock = await this.schedulerLock.runWithGlobalLock(this.lockName, async () => {
        // tenant-isolation:qb-exempt — scheduler janitor; tokens are not tenant-partitioned in SQL here.
        const qb = this.dataSource.manager
          .createQueryBuilder()
          .delete()
          .from(EmailVerificationTokenEntity)
          .where("expires_at < NOW()");
        const result: DeleteResult = await qb.execute();
        const deleted = result.affected ?? 0;
        this.logger.log(`EmailVerificationTokensCleanupJob: deleted ${deleted} expired token row(s)`);
      });
      if (!lock.acquired) {
        this.schedulerMetrics.noteSkippedDueLock(this.jobName);
        this.logger.log(`job_skipped_due_lock ${this.jobName}`);
        return;
      }
      this.schedulerMetrics.noteFinished(this.jobName, Date.now() - started);
      this.logger.log(`job_finished ${this.jobName}`);
    } catch (error: unknown) {
      this.schedulerMetrics.noteFailed(this.jobName);
      this.logger.warn(`email_verification_tokens cleanup failed: ${String(error)}`);
    }
  }
}
