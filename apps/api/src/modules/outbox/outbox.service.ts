import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import {
  OutboxEventEntity,
  OutboxEventStatus
} from "./entities/outbox-event.entity";
import { OutboxMetricsService } from "./outbox-metrics.service";

export type OutboxEventInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class OutboxService {
  constructor(private readonly metrics: OutboxMetricsService) {}

  /**
   * Inserts an outbox row using the caller's EntityManager so the write commits
   * or rolls back with the same transaction as domain mutations (AUDIT-RULE-004).
   */
  async addEvent(manager: EntityManager, event: OutboxEventInput): Promise<void> {
    const row = manager.create(OutboxEventEntity, {
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      status: OutboxEventStatus.PENDING,
      retryCount: 0,
      processedAt: null
    });
    await manager.save(row);
    this.metrics.noteEnqueued();
  }
}
