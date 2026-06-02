import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { ConfigService } from "../config/config.service";
import { PendingStorageDeletionCleanupService } from "../modules/tours/services/pending-storage-deletion-cleanup.service";
import { SchedulerLockService } from "./scheduler-lock.service";
import { SchedulerRuntimeMetricsService } from "./scheduler-runtime-metrics.service";

/** Runs orphan MinIO cleanup on the same cadence as other hourly janitors. */
const PENDING_STORAGE_DELETION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class PendingStorageDeletionCleanupJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PendingStorageDeletionCleanupJob.name);
  private interval?: NodeJS.Timeout;
  private readonly jobName = "pending_storage_deletion_cleanup";
  private readonly lockName = "scheduler:pending_storage_deletion_cleanup";

  constructor(
    @Inject(PendingStorageDeletionCleanupService)
    private readonly cleanupService: PendingStorageDeletionCleanupService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SchedulerLockService) private readonly schedulerLock: SchedulerLockService,
    @Inject(SchedulerRuntimeMetricsService)
    private readonly schedulerMetrics: SchedulerRuntimeMetricsService,
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
      }, PENDING_STORAGE_DELETION_CLEANUP_INTERVAL_MS);
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
        const result = await this.cleanupService.cleanupOrphanedCloneObjects();
        this.logger.log(
          `PendingStorageDeletionCleanupJob: removed ${result.deletedObjects} object(s), ${result.deletedRows} row(s)`,
        );
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
      this.logger.warn(`pending_storage_deletion cleanup failed: ${String(error)}`);
    }
  }
}
