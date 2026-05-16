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
import { OutboxProcessor } from "../../modules/outbox/outbox.processor";

/**
 * Durable second-stage outbox relay: global advisory lock + bounded batch dispatch
 * (same semantics as the historical {@link OutboxProcessor} timer, moved here for a clear
 * **worker** boundary vs enqueue helpers).
 *
 * **Activation:** the interval runs only when {@link ConfigService.shouldRunSchedulers}
 * is true **and** {@link ConfigService.getOutboxProcessorEnabled} is not `false` (env
 * `OUTBOX_PROCESSOR_ENABLED`, default `true`). API-only deployments (`APP_RUNTIME_ROLE=api`)
 * skip schedulers — run a **worker** process or `all` for dispatch.
 *
 * Downstream handlers remain idempotent — redelivery is expected after crashes.
 */
@Injectable()
export class OutboxRelayWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayWorker.name);
  private interval?: NodeJS.Timeout;
  private readonly jobName = "outbox_dispatch";
  private readonly lockName = "scheduler:outbox_dispatch";

  constructor(
    @Inject(OutboxProcessor) private readonly outboxProcessor: OutboxProcessor,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SchedulerLockService) private readonly schedulerLock: SchedulerLockService,
    @Inject(SchedulerRuntimeMetricsService)
    private readonly schedulerMetrics: SchedulerRuntimeMetricsService
  ) {}

  onModuleInit(): void {
    if (!this.configService.shouldRunSchedulers()) {
      this.logger.log("job_skipped_runtime_role outbox_relay");
      return;
    }
    if (this.configService.getOutboxProcessorEnabled() === false) {
      this.logger.log("job_disabled outbox_relay");
      return;
    }
    const ms = this.configService.getOutboxPollIntervalMs();
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
    this.logger.log("job_started outbox_relay");
    try {
      const lock = await this.schedulerLock.runWithGlobalLock(this.lockName, async () => {
        await this.outboxProcessor.processBatch();
      });
      if (!lock.acquired) {
        this.schedulerMetrics.noteSkippedDueLock(this.jobName);
        this.logger.log("job_skipped_due_lock outbox_relay");
        return;
      }
      this.schedulerMetrics.noteFinished(this.jobName, Date.now() - started);
      this.logger.log("job_finished outbox_relay");
    } catch (error: unknown) {
      this.schedulerMetrics.noteFailed(this.jobName);
      this.logger.warn(`outbox relay batch failed: ${String(error)}`);
    }
  }
}
