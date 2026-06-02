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
import { PaymentsService } from "./payments.service";

@Injectable()
export class PaymentsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsProcessor.name);
  private interval?: NodeJS.Timeout;
  private readonly jobName = "payments_timeout";
  private readonly lockName = "scheduler:payments_timeout";

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
    @Inject(SchedulerLockService) private readonly schedulerLock: SchedulerLockService,
    @Inject(SchedulerRuntimeMetricsService)
    private readonly schedulerMetrics: SchedulerRuntimeMetricsService
  ) {}

  onModuleInit(): void {
    if (!this.configService.shouldRunSchedulers()) {
      this.logger.log("job_skipped_runtime_role payments_timeout");
      return;
    }
    if (!this.configService.getPaymentsTimeoutEnabled()) {
      this.logger.log("job_disabled payments_timeout");
      return;
    }
    const ms = this.configService.getPaymentsTimeoutIntervalMs();
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
    this.logger.log("job_started payments_timeout");
    try {
      const lock = await this.schedulerLock.runWithGlobalLock(this.lockName, async () => {
        await this.paymentsService.failTimedOutPendingPayments();
      });
      if (!lock.acquired) {
        this.schedulerMetrics.noteSkippedDueLock(this.jobName);
        this.logger.log("job_skipped_due_lock payments_timeout");
        return;
      }
      this.schedulerMetrics.noteFinished(this.jobName, Date.now() - started);
      this.logger.log("job_finished payments_timeout");
    } catch (error: unknown) {
      this.schedulerMetrics.noteFailed(this.jobName);
      this.logger.warn(`payments timeout run failed: ${String(error)}`);
    }
  }
}
