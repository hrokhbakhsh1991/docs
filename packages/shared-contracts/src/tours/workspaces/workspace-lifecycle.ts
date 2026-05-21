import type { TourWorkspaceDefinition } from "../workspace-definition";

/**
 * Workspace Lifecycle Transition Guard (map.md §Phase 4).
 * 
 * Central authority for state transitions. Ensures that no tour
 * bypasses workspace-specific business rules during status changes.
 */

export interface LifecycleTransitionRequest {
  from: string;
  to: string;
}

/**
 * Asserts that a lifecycle transition is allowed by the workspace contract.
 * Throws an error if the transition is illegal.
 */
export function assertWorkspaceLifecycleTransition(
  workspace: TourWorkspaceDefinition,
  transition: LifecycleTransitionRequest,
): void {
  const allowed = workspace.lifecycle.allowedTransitions.some(
    (t) => t.from === transition.from && t.to === transition.to
  );

  if (!allowed) {
    throw new Error(
      `WORKSPACE_LIFECYCLE_ILLEGAL_TRANSITION: ${workspace.profile} cannot transition from ${transition.from} to ${transition.to}`
    );
  }
}

/**
 * Validates if a tour is ready for a specific status (e.g. OPEN).
 * (Placeholder for more complex readiness checks).
 */
export function assertWorkspaceStatusReadiness(
  workspace: TourWorkspaceDefinition,
  targetStatus: string,
  tourData: any
): void {
  if (targetStatus === workspace.lifecycle.publishStatus) {
    // Run full invariant check before allowing "OPEN"
    const violation = workspace.validation.checkTripDetails(
      tourData.tripDetails,
      tourData.transportModes
    );
    if (violation) {
      throw new Error(`WORKSPACE_LIFECYCLE_READINESS_FAILED: ${violation.message}`);
    }
  }
}
