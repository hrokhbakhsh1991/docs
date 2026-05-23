import { Inject, Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ConfigService } from "../../config/config.service";
import { AuditService } from "../../common/audit/audit.service";
import {
  OutboxEventEntity,
  OutboxEventStatus
} from "./entities/outbox-event.entity";
import { OutboxMetricsService } from "./outbox-metrics.service";
import { TenantDbContextService } from "../../database/tenant-db-context.service";
import { EmailService } from "../../common/email/email.service";
import { OUTBOX_EVENT_TYPE_IDENTITY_EMAIL_VERIFICATION_SEND } from "./identity-email-outbox.constants";
import {
  dispatchRegistrationAcceptedSmsGateIfEligible,
  REGISTRATION_ACCEPTED_OUTBOX_EVENT_TYPE
} from "./registration-accepted-sms-outbox.handler";

/**
 * Transactional outbox dispatcher.
 *
 * **Enqueue:** domain-critical events must be inserted via {@link enqueueOutboxEvent} in the same
 * transaction as aggregate writes. Optional `domainEventId` enables DB-level dedupe (unique per tenant).
 *
 * **Publish / retry:** failed deliveries increment `retry_count` and set `next_retry_at` with exponential
 * backoff until `OUTBOX_MAX_RETRY`, then `FAILED`.
 *
 * **Idempotency:** at-least-once delivery — the same row may be processed again after a crash before
 * `DELIVERED`. Downstream handlers MUST dedupe on `event_id` (outbox PK) and/or stable domain ids in payload.
 */
@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(OutboxMetricsService) private readonly metrics: OutboxMetricsService,
    @Inject(TenantDbContextService)
    private readonly tenantDbContext: TenantDbContextService
  ) {}

  async processBatch(): Promise<void> {
    const started = Date.now();
    const maxRetry = this.configService.getOutboxMaxRetry();
    const batchSize = this.configService.getOutboxBatchSize();

    const rows = await this.dataSource.transaction(async (manager) => {
      const pendingTotal = await manager.count(OutboxEventEntity, {
        where: { status: OutboxEventStatus.PENDING }
      });
      this.metrics.setPendingTotal(pendingTotal);

      // tenant-isolation:qb-exempt — pending queue is global; each row dispatched under runInTenantScope.
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
          const payload = row.payload as Record<string, unknown>;
          if (row.eventType === OUTBOX_EVENT_TYPE_IDENTITY_EMAIL_VERIFICATION_SEND) {
            const to = typeof payload.to === "string" ? payload.to : "";
            const tok = typeof payload.token === "string" ? payload.token : "";
            await this.emailService.sendVerificationEmailOutboundStrict(to, tok);
          } else {
            if (row.eventType === REGISTRATION_ACCEPTED_OUTBOX_EVENT_TYPE) {
              await dispatchRegistrationAcceptedSmsGateIfEligible({
                manager,
                metrics: this.metrics,
                logger: this.logger,
                tenantId,
                outboxEventId: row.id,
                payload
              });
            }
            this.auditService.deliverFromOutbox({
              tenant_id: tenantId,
              event_id: row.id,
              event_type: row.eventType,
              payload,
              created_at: row.createdAt instanceof Date
                ? row.createdAt.toISOString()
                : String(row.createdAt)
            });
          }
          row.status = OutboxEventStatus.DELIVERED;
          row.processedAt = new Date();
          await manager.save(row);
        });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `outbox_delivery_failed eventType=${row.eventType} id=${row.id}: ${errMsg}`
        );
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
}
