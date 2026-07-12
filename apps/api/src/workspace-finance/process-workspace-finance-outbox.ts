import "./register-workspace-finance-deps";
import {
  createDenaliFinanceOutboxConsumer,
  type FinanceOutboxConsumerResult,
} from "@app-tour/workspace-denali";

import { createWorkspaceFinanceProcessedStore } from "./workspace-finance-processed-log";
import { createWorkspaceOutboxReader } from "./prisma-workspace-outbox-reader";
import { createPrismaWorkspaceOutboxWriter } from "./prisma-workspace-outbox-writer";
import {
  runTourCreatedFinanceSideEffect,
  type TourCreatedFinanceSideEffectRow,
} from "../workspace/workspace-outbox-side-effects.generated.ts";

export type WorkspaceFinanceTourCreatedRow = TourCreatedFinanceSideEffectRow;

/**
 * Processes one relayed TourCreated row — enqueues finance.ledger outbox when payload qualifies.
 */
export async function processWorkspaceFinanceTourCreatedRow(
  row: WorkspaceFinanceTourCreatedRow
): Promise<boolean> {
  return runTourCreatedFinanceSideEffect(row);
}

/** Batch tick — reads unprocessed TourCreated rows for a tenant via Prisma OutboxReader. */
export async function processWorkspaceFinanceOutboxForTenant(
  tenantId: string
): Promise<FinanceOutboxConsumerResult> {
  const consumer = createDenaliFinanceOutboxConsumer({
    reader: createWorkspaceOutboxReader(tenantId),
    writer: createPrismaWorkspaceOutboxWriter(),
    processedStore: createWorkspaceFinanceProcessedStore(tenantId),
  });
  return consumer.consumePending();
}
