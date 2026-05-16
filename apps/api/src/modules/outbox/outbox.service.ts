import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { FinancialMutationAuditService } from "../../common/audit/financial-mutation-audit.service";
import { isFinancialOutboxEventType } from "../../common/audit/financial-outbox-event-types";
import { enqueueOutboxEvent } from "../../common/outbox/enqueue-outbox-event";
import { OutboxMetricsService } from "./outbox-metrics.service";

export type OutboxEventInput = {
  /** Workspace tenant for worker dispatch and RLS alignment during processing. */
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  /** Stable domain id for enqueue dedupe (optional). */
  domainEventId?: string | null;
  /**
   * Optional domain row snapshots for `tenant_audit_events` when {@link eventType} is financial
   * (see `isFinancialOutboxEventType`). Omitted callers still get an audit row with `state_after`
   * defaulting to the outbox payload.
   */
  financialAudit?: {
    stateBefore: Record<string, unknown> | null;
    stateAfter: Record<string, unknown> | null;
  } | null;
};

@Injectable()
export class OutboxService {
  constructor(
    @Inject(OutboxMetricsService) private readonly metrics: OutboxMetricsService,
    @Inject(FinancialMutationAuditService)
    private readonly financialMutationAudit: FinancialMutationAuditService
  ) {}

  /**
   * Inserts an outbox row using the caller's EntityManager so the write commits
   * or rolls back with the same transaction as domain mutations (AUDIT-RULE-004).
   *
   * Financial `eventType` values also append `tenant_audit_events` in the same transaction when
   * the outbox row is newly inserted (skipped duplicate `domainEventId` → no second audit row).
   */
  async addEvent(manager: EntityManager, event: OutboxEventInput): Promise<void> {
    const correlationId = (event.correlationId?.trim() || randomUUID()) as string;
    const inserted = await enqueueOutboxEvent(
      manager,
      {
        tenantId: event.tenantId,
        eventType: event.eventType,
        payload: event.payload,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        correlationId,
        domainEventId: event.domainEventId
      },
      { onEnqueued: () => this.metrics.noteEnqueued() }
    );
    if (inserted && isFinancialOutboxEventType(event.eventType)) {
      await this.financialMutationAudit.recordOutboxFinancialMutation(manager, {
        tenantId: event.tenantId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        correlationId,
        payload: { ...event.payload, correlation_id: correlationId },
        financialAudit: event.financialAudit
      });
    }
  }
}
