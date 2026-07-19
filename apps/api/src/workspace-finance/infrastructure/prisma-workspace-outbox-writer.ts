import type { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import { enqueueOutboxEvent } from "../../outbox/enqueue-domain-event";
import type { FinanceTransactionPort } from "../ports/booking-payment.port";
import type {
  FinanceLedgerOutboxEnqueueInput,
  FinanceOutboxWriter,
} from "../ports/finance-outbox-writer.port";

export function createPrismaWorkspaceOutboxWriter(): FinanceOutboxWriter {
  return {
    async addEvent(event: FinanceLedgerOutboxEnqueueInput): Promise<boolean> {
      return withTenantRls(event.tenantId, async (tx) => {
        return enqueueOutboxEvent(tx, {
          tenantId: event.tenantId,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventType: event.eventType,
          payload: event.payload as Prisma.InputJsonValue,
          domainEventId: event.domainEventId,
        });
      });
    },
  };
}

/**
 * Outbox writer bound to an open tenant RLS transaction (transactional outbox).
 * Accepts opaque {@link FinanceTransactionPort}; Prisma cast stays at this boundary.
 */
export function createTxScopedOutboxWriter(tx: FinanceTransactionPort): FinanceOutboxWriter {
  const prismaTx = tx as Prisma.TransactionClient;
  return {
    async addEvent(event: FinanceLedgerOutboxEnqueueInput): Promise<boolean> {
      return enqueueOutboxEvent(prismaTx, {
        tenantId: event.tenantId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
        domainEventId: event.domainEventId,
      });
    },
  };
}
