import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import { SchedulerLockService } from "../../jobs/scheduler-lock.service";
import { SchedulerRuntimeMetricsService } from "../../jobs/scheduler-runtime-metrics.service";
import { ReconciliationService } from "./reconciliation.service";

@Injectable()
export class ReconciliationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationProcessor.name);
  private interval?: NodeJS.Timeout;
  private readonly jobName = "reconciliation_cycle";
  private readonly lockName = "scheduler:reconciliation_cycle";

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(ReconciliationService)
    private readonly reconciliationService: ReconciliationService,
    @Inject(SchedulerLockService) private readonly schedulerLock: SchedulerLockService,
    @Inject(SchedulerRuntimeMetricsService)
    private readonly schedulerMetrics: SchedulerRuntimeMetricsService
  ) {}

  onModuleInit(): void {
    if (!this.configService.shouldRunSchedulers()) {
      this.logger.log("job_skipped_runtime_role reconciliation_cycle");
      return;
    }
    if (!this.configService.getReconciliationEnabled()) {
      this.logger.log("job_disabled reconciliation_cycle");
      return;
    }
    const ms = this.configService.getReconciliationIntervalMs();
    const jitterMs = Math.floor(Math.random() * (this.configService.getSchedulerJitterMs() + 1));
    setTimeout(() => {
      void this.runOnceWithLock();
      this.interval = setInterval(() => {
        void this.runOnceWithLock();
      }, ms);
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
    this.logger.log("job_started reconciliation_cycle");
    try {
      const lock = await this.schedulerLock.runWithGlobalLock(this.lockName, async () => {
        await this.reconciliationService.runReconciliationCycle();
      });
      if (!lock.acquired) {
        this.schedulerMetrics.noteSkippedDueLock(this.jobName);
        this.logger.log("job_skipped_due_lock reconciliation_cycle");
        return;
      }
      this.schedulerMetrics.noteFinished(this.jobName, Date.now() - started);
      this.logger.log("job_finished reconciliation_cycle");
    } catch (error: unknown) {
      this.schedulerMetrics.noteFailed(this.jobName);
      this.logger.warn(`reconciliation cycle failed: ${String(error)}`);
    }
  }
}
