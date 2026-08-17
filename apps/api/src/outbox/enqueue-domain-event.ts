import { Prisma } from "@prisma/client";

import { isPrismaUniqueConstraintError } from "../db/prisma-error-instance";
import { shouldAbortAtomicTx } from "../test-hooks/atomic-tx-test-abort";

function isUniqueViolation(error: unknown): boolean {
  return isPrismaUniqueConstraintError(error);
}

export type EnqueueOutboxEventInput = {
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Prisma.InputJsonValue;
  readonly domainEventId: string;
  readonly correlationId?: string;
  /** DEC-077 — DB-sourced enqueue time; relay maps `occurredAt` from this column. */
  readonly createdAt?: Date;
};

/**
 * DEC-004 — insert outbox row inside the same Prisma TX as the aggregate write.
 */
/**
 * @returns true when a new row was inserted; false when duplicate `(tenant_id, domain_event_id)`.
 */
export async function enqueueOutboxEvent(
  tx: Prisma.TransactionClient,
  input: EnqueueOutboxEventInput
): Promise<boolean> {
  if (shouldAbortAtomicTx("outbox")) {
    throw new Error("P5_ATOMIC_TX_TEST_ABORT");
  }

  try {
    await tx.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload,
        status: "pending",
        domainEventId: input.domainEventId,
        correlationId: input.correlationId ?? null,
        ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
      },
    });
    return true;
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return false;
    }
    throw error;
  }
}
