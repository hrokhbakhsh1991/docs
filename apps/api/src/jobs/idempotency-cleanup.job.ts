import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { IdempotencyService } from "../modules/idempotency/idempotency.service";
import { SchedulerLockService } from "./scheduler-lock.service";
import { SchedulerRuntimeMetricsService } from "./scheduler-runtime-metrics.service";

const IDEMPOTENCY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class IdempotencyCleanupJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdempotencyCleanupJob.name);
  private interval?: NodeJS.Timeout;
  private readonly jobName = "idempotency_cleanup";
  private readonly lockName = "scheduler:idempotency_cleanup";

  constructor(
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SchedulerLockService) private readonly schedulerLock: SchedulerLockService,
    @Inject(SchedulerRuntimeMetricsService)
    private readonly schedulerMetrics: SchedulerRuntimeMetricsService
  ) {}

  onModuleInit(): void {
    if (!this.configService.shouldRunSchedulers()) {
      this.logger.log("job_skipped_runtime_role idempotency_cleanup");
      return;
    }
    const jitterMs = Math.floor(Math.random() * (this.configService.getSchedulerJitterMs() + 1));
    setTimeout(() => {
      void this.runOnceWithLock();
      this.interval = setInterval(() => {
        void this.runOnceWithLock();
      }, IDEMPOTENCY_CLEANUP_INTERVAL_MS);
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
    this.logger.log("job_started idempotency_cleanup");
    try {
      const lock = await this.schedulerLock.runWithGlobalLock(this.lockName, async () => {
        const deleted = await this.idempotencyService.deleteExpired();
        this.logger.log(`IdempotencyCleanupJob: deleted ${deleted} expired keys`);
      });
      if (!lock.acquired) {
        this.schedulerMetrics.noteSkippedDueLock(this.jobName);
        this.logger.log("job_skipped_due_lock idempotency_cleanup");
        return;
      }
      this.schedulerMetrics.noteFinished(this.jobName, Date.now() - started);
      this.logger.log("job_finished idempotency_cleanup");
    } catch (error: unknown) {
      this.schedulerMetrics.noteFailed(this.jobName);
      this.logger.warn(`idempotency cleanup failed: ${String(error)}`);
    }
  }
}
