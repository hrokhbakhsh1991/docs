import { randomUUID } from "node:crypto";
import type { EntityManager } from "typeorm";
import { QueryFailedError } from "typeorm";
import { OutboxEventEntity, OutboxEventStatus } from "./entities/outbox-event.entity";

export type EnqueueOutboxEventInput = {
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  aggregateType?: string;
  aggregateId?: string;
  correlationId?: string;
  /**
   * When set, must be stable for the same logical domain occurrence (e.g. `booking.created:{registrationId}`).
   * Duplicate `(tenantId, domainEventId)` inserts are swallowed (idempotent enqueue).
   */
  domainEventId?: string | null;
};

function isPostgresUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const code = (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
  return code === "23505";
}

/**
 * Inserts one `outbox_events` row on the **caller's** `EntityManager` transaction.
 *
 * **Transactional rule:** call only inside the same `manager` / transaction as domain writes
 * so rollback drops the outbox row too.
 *
 * **Idempotency:** callers should derive `aggregateId` / `correlationId` from domain idempotency keys
 * when dedupe across redelivered HTTP requests matters. When `domainEventId` is set, duplicate enqueue
 * for the same tenant + id is a no-op (unique index).
 * @returns `true` when a new row was inserted, `false` when skipped as a duplicate `(tenant_id, domain_event_id)`.
 */
export async function enqueueOutboxEvent(
  manager: EntityManager,
  input: EnqueueOutboxEventInput,
  hooks?: { onEnqueued?: () => void }
): Promise<boolean> {
  const tenantId = input.tenantId.trim().toLowerCase();
  const correlationId = (input.correlationId?.trim() || randomUUID()) as string;
  const aggregateId = (input.aggregateId?.trim() || correlationId) as string;
  const aggregateType = input.aggregateType?.trim() || "common.foundation";
  const domainEventId =
    input.domainEventId === undefined || input.domainEventId === null
      ? null
      : (input.domainEventId.trim().slice(0, 128) || null);
  const payload = {
    ...input.payload,
    correlation_id: correlationId
  };

  const row = manager.create(OutboxEventEntity, {
    tenantId,
    aggregateType,
    aggregateId,
    eventType: input.eventType,
    payload,
    status: OutboxEventStatus.PENDING,
    retryCount: 0,
    nextRetryAt: null,
    processedAt: null,
    correlationId,
    domainEventId
  });
  try {
    await manager.save(row);
  } catch (error: unknown) {
    if (domainEventId !== null && isPostgresUniqueViolation(error)) {
      return false;
    }
    throw error;
  }
  hooks?.onEnqueued?.();
  return true;
}
