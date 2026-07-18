import "./register-workspace-finance-deps";

import { resolveFinanceWorkspaceTypeForTenant } from "./resolve-finance-workspace-type-for-tenant";
import { resolveWorkspaceFinanceEventReaction } from "./finance-event-reaction-registry";
import type {
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "./ports/workspace-finance-event-reaction.port";

export type WorkspaceFinanceTourCreatedRow = WorkspaceFinancePublishedOutboxRow;

/**
 * Single published TourCreated row — delegates to workspace reaction port (Phase 1.7 C2).
 */
export async function processWorkspaceFinanceTourCreatedRow(
  row: WorkspaceFinanceTourCreatedRow
): Promise<boolean> {
  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(row.tenantId);
  return resolveWorkspaceFinanceEventReaction(workspaceType).reactToPublishedRow(row);
}

/**
 * Batch tick — host resolves workspace reaction port; no Denali consumer names (Phase 1.7 C2).
 */
export async function processWorkspaceFinanceOutboxForTenant(
  tenantId: string
): Promise<WorkspaceFinanceReactionBatchResult> {
  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(tenantId);
  return resolveWorkspaceFinanceEventReaction(workspaceType).consumePendingForTenant(tenantId);
}
