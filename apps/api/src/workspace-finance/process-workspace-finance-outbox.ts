import "./register-workspace-finance-deps";
import {
  consumeDenaliTourCreatedFinanceOutbox,
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
 * Workspace reaction runner (generated binding); finance host does not own Denali consumer composition.
 */
export async function processWorkspaceFinanceTourCreatedRow(
  row: WorkspaceFinanceTourCreatedRow
): Promise<boolean> {
  return runTourCreatedFinanceSideEffect(row);
}

/**
 * Batch tick — host supplies Prisma IO; Denali owns TourCreated→ledger consumer composition (Phase 1.7 C1).
 */
export async function processWorkspaceFinanceOutboxForTenant(
  tenantId: string
): Promise<FinanceOutboxConsumerResult> {
  return consumeDenaliTourCreatedFinanceOutbox({
    reader: createWorkspaceOutboxReader(tenantId),
    writer: createPrismaWorkspaceOutboxWriter(),
    processedStore: createWorkspaceFinanceProcessedStore(tenantId),
  });
}
