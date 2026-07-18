/**
 * Workspace type → TourCreated finance event reaction (Phase 1.7 C2).
 * Unregistered / non-Denali finance types get a no-op (no Denali consumer).
 */

import { DenaliTourCreatedFinanceReactionAdapter } from "./infrastructure/denali-tour-created-finance-reaction.adapter";
import type { WorkspaceFinanceEventReactionPort } from "./ports/workspace-finance-event-reaction.port";

const DENALI_WORKSPACE_TYPE = "denali";

const NOOP_TOUR_CREATED_FINANCE_REACTION: WorkspaceFinanceEventReactionPort = {
  async consumePendingForTenant() {
    return { handled: 0, skipped: 0 };
  },
  async reactToPublishedRow() {
    return false;
  },
};

const FINANCE_EVENT_REACTION_REGISTRY: ReadonlyMap<string, () => WorkspaceFinanceEventReactionPort> =
  new Map([[DENALI_WORKSPACE_TYPE, () => new DenaliTourCreatedFinanceReactionAdapter()]]);

function normalizeWorkspaceType(workspaceType: string): string {
  return workspaceType.trim().toLowerCase();
}

export function resolveWorkspaceFinanceEventReaction(
  workspaceType: string
): WorkspaceFinanceEventReactionPort {
  const normalized = normalizeWorkspaceType(workspaceType);
  const factory = FINANCE_EVENT_REACTION_REGISTRY.get(normalized);
  if (factory === undefined) {
    return NOOP_TOUR_CREATED_FINANCE_REACTION;
  }
  return factory();
}
