import "../workspace-finance/register-workspace-finance-deps";
import {
  isWorkspaceFinanceEventReactionRegistered,
} from "../workspace-finance/finance-event-reaction-registry";
import { processWorkspaceFinanceTourCreatedRow } from "../workspace-finance/process-workspace-finance-outbox";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { WORKSPACE_OUTBOX_SIDE_EFFECT_BINDINGS } from "./workspace-outbox-side-effects.generated";
import type { WorkspaceOutboxPublishedRow } from "./workspace-outbox-row-context";

/**
 * Post-publish outbox side effects (DEC-P10-002 / Phase 1.8 Step 1).
 * Relay calls this only.
 *
 * Finance TourCreated reactions: finance event reaction registry (single driver).
 * Other manifest bindings (non–financeEventReaction): generated WORKSPACE_OUTBOX_SIDE_EFFECT_BINDINGS.
 */
export async function dispatchTourCreatedOutboxSideEffects(
  row: WorkspaceOutboxPublishedRow
): Promise<void> {
  if (!row.domainEventId.trim()) {
    return;
  }

  const workspaceType = await resolveWorkspaceTypeForTenant(row.tenantId);

  if (
    row.eventType === "TourCreated" &&
    isWorkspaceFinanceEventReactionRegistered(workspaceType)
  ) {
    await processWorkspaceFinanceTourCreatedRow(row);
  }

  for (const binding of WORKSPACE_OUTBOX_SIDE_EFFECT_BINDINGS) {
    if (row.eventType !== binding.eventType) {
      continue;
    }
    if (!binding.workspaceTypes.includes(workspaceType)) {
      continue;
    }
    await binding.run(row);
  }
}
