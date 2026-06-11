import {
  createDenaliFinanceOutboxConsumer,
  type FinanceOutboxConsumerResult,
} from "@app-tour/workspace-denali";

import { createDenaliFinanceProcessedStore } from "./denali-finance-processed-log";
import { createPrismaDenaliOutboxReader } from "./prisma-denali-outbox-reader";
import { createPrismaDenaliOutboxWriter } from "./prisma-denali-outbox-writer";
import {
  runTourCreatedFinanceSideEffect,
  type TourCreatedFinanceSideEffectRow,
} from "./tour-created-finance-side-effect";

export type DenaliFinanceTourCreatedRow = TourCreatedFinanceSideEffectRow;

/**
 * Processes one relayed TourCreated row — enqueues finance.ledger outbox when payload qualifies.
 */
export async function processDenaliFinanceTourCreatedRow(
  row: DenaliFinanceTourCreatedRow
): Promise<boolean> {
  return runTourCreatedFinanceSideEffect(row);
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
