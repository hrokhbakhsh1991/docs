import {
  createDenaliFinanceOutboxConsumer,
  handleTourCreatedLedgerEvent,
  type DenaliOutboxDomainEvent,
  type FinanceOutboxConsumerResult,
  type TourCreatedLedgerPayload,
} from "@app-tour/workspace-denali";

import {
  createDenaliFinanceProcessedStore,
  tryClaimDenaliFinanceProcessedEvent,
} from "./denali-finance-processed-log";
import { createPrismaDenaliOutboxReader } from "./prisma-denali-outbox-reader";
import { createPrismaDenaliOutboxWriter } from "./prisma-denali-outbox-writer";
import { logger } from "../observability/logger";

export type DenaliFinanceTourCreatedRow = {
  readonly tenantId: string;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: unknown;
};

function tourCreatedHasFinancePayload(payload: Record<string, unknown>): boolean {
  const finance = payload as TourCreatedLedgerPayload;
  return Boolean(finance.registrationId?.trim() && finance.paidAmountMinor?.trim());
}

function mapTourCreatedRow(row: DenaliFinanceTourCreatedRow): DenaliOutboxDomainEvent {
  const payload =
    typeof row.payload === "object" && row.payload !== null
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    tenantId: row.tenantId,
    domainEventId: row.domainEventId,
    eventType: row.eventType,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payload,
  };
}

/**
 * Processes one relayed TourCreated row — enqueues finance.ledger outbox when payload qualifies.
 */
export async function processDenaliFinanceTourCreatedRow(
  row: DenaliFinanceTourCreatedRow
): Promise<boolean> {
  if (row.eventType !== "TourCreated" || !row.domainEventId.trim()) {
    return false;
  }

  const event = mapTourCreatedRow(row);
  if (!tourCreatedHasFinancePayload(event.payload)) {
    return false;
  }

  const claimed = await tryClaimDenaliFinanceProcessedEvent(row.tenantId, row.domainEventId);
  if (!claimed) {
    return false;
  }

  try {
    return await handleTourCreatedLedgerEvent({
      tenantId: row.tenantId,
      event,
      outboxWriter: createPrismaDenaliOutboxWriter(),
    });
  } catch (error: unknown) {
    logger.warn({
      event: "denali.finance.tour_created_failed",
      tenant_id: row.tenantId,
      domain_event_id: row.domainEventId,
      err: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

/** Batch tick — reads unprocessed TourCreated rows for a tenant via Prisma OutboxReader. */
export async function processDenaliFinanceOutboxForTenant(
  tenantId: string
): Promise<FinanceOutboxConsumerResult> {
  const consumer = createDenaliFinanceOutboxConsumer({
    reader: createPrismaDenaliOutboxReader(tenantId),
    writer: createPrismaDenaliOutboxWriter(),
    processedStore: createDenaliFinanceProcessedStore(tenantId),
  });
  return consumer.consumePending();
}
