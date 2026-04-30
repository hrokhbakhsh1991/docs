import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { ConfigService } from "../../config/config.service";
import { AuditService } from "../../common/audit/audit.service";
import {
  OutboxEventEntity,
  OutboxEventStatus
} from "./entities/outbox-event.entity";
import { OutboxMetricsService } from "./outbox-metrics.service";

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

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly metrics: OutboxMetricsService
  ) {}

  onModuleInit(): void {
    if (this.configService.getOutboxProcessorEnabled() === false) {
      return;
    }
    const ms = this.configService.getOutboxPollIntervalMs();
    this.interval = setInterval(() => {
      void this.processBatch().catch((error: unknown) => {
        this.logger.warn(`outbox batch failed: ${String(error)}`);
      });
    }, ms);
    this.interval.unref?.();
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

    await this.dataSource.transaction(async (manager) => {
      const pendingTotal = await manager.count(OutboxEventEntity, {
        where: { status: OutboxEventStatus.PENDING }
      });
      this.metrics.setPendingTotal(pendingTotal);

      const rows = await manager
        .createQueryBuilder(OutboxEventEntity, "o")
        .where("o.status = :status", { status: OutboxEventStatus.PENDING })
        .orderBy("o.createdAt", "ASC")
        .take(batchSize)
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getMany();

      for (const row of rows) {
        try {
          this.auditService.deliverFromOutbox(row.eventType, row.payload);
          row.status = OutboxEventStatus.DELIVERED;
          row.processedAt = new Date();
          await manager.save(row);
        } catch (error: unknown) {
          row.retryCount += 1;
          if (row.retryCount > maxRetry) {
            row.status = OutboxEventStatus.FAILED;
            this.metrics.incrementFailed();
            this.logger.warn(
              `outbox event ${row.id} marked FAILED after ${row.retryCount} retries`
            );
          }
          await manager.save(row);
        }
      }
    });

    this.metrics.setProcessingLatencyMs(Date.now() - started);
    this.metrics.setLastBatchProcessedAt(new Date().toISOString());
  }
}
