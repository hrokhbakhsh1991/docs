/**
 * Workspace type → TourCreated finance event reaction (Phase 1.7 C2 / Phase 1.8 Step 1).
 * Resolve is fail-closed: unregistered workspace types throw (no silent no-op).
 */

import { DenaliTourCreatedFinanceReactionAdapter } from "./infrastructure/denali-tour-created-finance-reaction.adapter";
import type { WorkspaceFinanceEventReactionPort } from "./ports/workspace-finance-event-reaction.port";

const DENALI_WORKSPACE_TYPE = "denali";

const FINANCE_EVENT_REACTION_REGISTRY: ReadonlyMap<string, () => WorkspaceFinanceEventReactionPort> =
  new Map([[DENALI_WORKSPACE_TYPE, () => new DenaliTourCreatedFinanceReactionAdapter()]]);

function normalizeWorkspaceType(workspaceType: string): string {
  return workspaceType.trim().toLowerCase();
}

/** True when a workspace type has a registered TourCreated → finance reaction adapter. */
export function isWorkspaceFinanceEventReactionRegistered(workspaceType: string): boolean {
  const normalized = normalizeWorkspaceType(workspaceType);
  return normalized.length > 0 && FINANCE_EVENT_REACTION_REGISTRY.has(normalized);
}

/**
 * Resolve workspace finance event reaction capability.
 * @throws `FINANCE_EVENT_REACTION_UNSUPPORTED` when workspaceType is not registered.
 */
export function resolveWorkspaceFinanceEventReaction(
  workspaceType: string
): WorkspaceFinanceEventReactionPort {
  const normalized = normalizeWorkspaceType(workspaceType);
  if (normalized.length === 0) {
    throw new Error(
      "FINANCE_EVENT_REACTION_UNSUPPORTED: workspaceType is required to resolve finance event reaction"
    );
  }
  const factory = FINANCE_EVENT_REACTION_REGISTRY.get(normalized);
  if (factory === undefined) {
    throw new Error(
      `FINANCE_EVENT_REACTION_UNSUPPORTED: no finance event reaction for workspaceType=${workspaceType}`
    );
  }
  return factory();
}
