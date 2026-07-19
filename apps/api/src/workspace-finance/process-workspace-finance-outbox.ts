import { resolveFinanceWorkspaceTypeForTenant } from "./resolve-finance-workspace-type-for-tenant";
import { resolveWorkspaceFinanceEventReaction } from "./finance-event-reaction-registry";
import type {
  WorkspaceFinancePublishedOutboxRow,
  WorkspaceFinanceReactionBatchResult,
} from "./ports/workspace-finance-event-reaction.port";

export type WorkspaceFinanceTourCreatedRow = WorkspaceFinancePublishedOutboxRow;

/**
 * Single published TourCreated row — finance capability entry (Phase 1.13).
 * Relay dispatcher and tests call this; registry is fail-closed for unknown workspace types.
 * No workspace package boot registration — HostIo is injected at resolve time.
 */
export async function processWorkspaceFinanceTourCreatedRow(
  row: WorkspaceFinanceTourCreatedRow
): Promise<boolean> {
  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(row.tenantId);
  return resolveWorkspaceFinanceEventReaction(workspaceType).reactToPublishedRow(row);
}

/**
 * Batch tick — host resolves workspace reaction port; no Denali consumer names.
 */
export async function processWorkspaceFinanceOutboxForTenant(
  tenantId: string
): Promise<WorkspaceFinanceReactionBatchResult> {
  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(tenantId);
  return resolveWorkspaceFinanceEventReaction(workspaceType).consumePendingForTenant(tenantId);
}
