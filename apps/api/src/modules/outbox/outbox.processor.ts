import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { ConfigService } from "../../config/config.service";
import { AuditService } from "../../common/audit/audit.service";
import { SchedulerLockService } from "../../jobs/scheduler-lock.service";
import { SchedulerRuntimeMetricsService } from "../../jobs/scheduler-runtime-metrics.service";
import {
  OutboxEventEntity,
  OutboxEventStatus
} from "./entities/outbox-event.entity";
import { OutboxMetricsService } from "./outbox-metrics.service";
import { TenantDbContextService } from "../../database/tenant-db-context.service";

/**
 * Transactional outbox dispatcher.
 *
 * Idempotency: if the process crashes after a successful publish() but before the row is
 * marked DELIVERED, the next poll may deliver the same event again. Downstream consumers
 * (webhooks, analytics) MUST dedupe on aggregateId + eventType or a stable idempotency key.
 */
@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private interval?: NodeJS.Timeout;
  private readonly jobName = "outbox_dispatch";
  private readonly lockName = "scheduler:outbox_dispatch";

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(OutboxMetricsService) private readonly metrics: OutboxMetricsService,
    @Inject(TenantDbContextService)
    private readonly tenantDbContext: TenantDbContextService,
    @Inject(SchedulerLockService) private readonly schedulerLock: SchedulerLockService,
    @Inject(SchedulerRuntimeMetricsService)
    private readonly schedulerMetrics: SchedulerRuntimeMetricsService
  ) {}

  onModuleInit(): void {
    if (!this.configService.shouldRunSchedulers()) {
      this.logger.log("job_skipped_runtime_role outbox_dispatch");
      return;
    }
    if (this.configService.getOutboxProcessorEnabled() === false) {
      this.logger.log("job_disabled outbox_dispatch");
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

  async processBatch(): Promise<void> {
    const started = Date.now();
    const maxRetry = this.configService.getOutboxMaxRetry();
    const batchSize = this.configService.getOutboxBatchSize();

    const rows = await this.dataSource.transaction(async (manager) => {
      const pendingTotal = await manager.count(OutboxEventEntity, {
        where: { status: OutboxEventStatus.PENDING }
      });
      this.metrics.setPendingTotal(pendingTotal);

      return manager
        .createQueryBuilder(OutboxEventEntity, "o")
        .where("o.status = :status", { status: OutboxEventStatus.PENDING })
        .andWhere("(o.nextRetryAt IS NULL OR o.nextRetryAt <= :now)", {
          now: new Date()
        })
        .orderBy("o.createdAt", "ASC")
        .take(batchSize)
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getMany();
    });

    for (const row of rows) {
      try {
        const tenantId = row.tenantId.trim().toLowerCase();
        await this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
          this.auditService.deliverFromOutbox({
            tenant_id: tenantId,
            event_id: row.id,
            event_type: row.eventType,
            payload: row.payload as Record<string, unknown>,
            created_at: row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : String(row.createdAt)
          });
          row.status = OutboxEventStatus.DELIVERED;
          row.processedAt = new Date();
          await manager.save(row);
        });
      } catch (error: unknown) {
        await this.dataSource.transaction(async (manager) => {
          const fresh = await manager.findOne(OutboxEventEntity, { where: { id: row.id } });
          if (!fresh) {
            return;
          }
          fresh.retryCount += 1;
          if (fresh.retryCount >= maxRetry) {
            fresh.status = OutboxEventStatus.FAILED;
            fresh.nextRetryAt = null;
            this.metrics.incrementFailed();
            this.logger.warn(`Outbox event ${fresh.id} reached max retry attempts`);
          } else {
            fresh.nextRetryAt = new Date(
              Date.now() + 2 ** fresh.retryCount * 60 * 1000
            );
          }
          await manager.save(fresh);
        });
      }
    }

    this.metrics.setProcessingLatencyMs(Date.now() - started);
    this.metrics.setLastBatchProcessedAt(new Date().toISOString());
  }

  private async runOnceWithLock(): Promise<void> {
    const started = Date.now();
    this.schedulerMetrics.noteStarted(this.jobName);
    this.logger.log("job_started outbox_dispatch");
    try {
      const lock = await this.schedulerLock.runWithGlobalLock(this.lockName, async () => {
        await this.processBatch();
      });
      if (!lock.acquired) {
        this.schedulerMetrics.noteSkippedDueLock(this.jobName);
        this.logger.log("job_skipped_due_lock outbox_dispatch");
        return;
      }
      this.schedulerMetrics.noteFinished(this.jobName, Date.now() - started);
      this.logger.log("job_finished outbox_dispatch");
    } catch (error: unknown) {
      this.schedulerMetrics.noteFailed(this.jobName);
      this.logger.warn(`outbox batch failed: ${String(error)}`);
    }
  }
}
