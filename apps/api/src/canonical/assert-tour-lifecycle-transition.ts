import type { WorkspaceLifecycleContract } from "@app-tour/workspace-sdk";

export class TourLifecycleTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TourLifecycleTransitionError";
  }
}

export function isTourLifecycleTransitionError(
  error: unknown
): error is TourLifecycleTransitionError {
  return error instanceof TourLifecycleTransitionError;
}

const CANCELLED_TERMINAL_STATUS = "CANCELLED";

/** P5-B-N-003 — enforce workspace plugin lifecycle graph on tour status changes. */
export function assertTourLifecycleTransition(input: {
  lifecycle: WorkspaceLifecycleContract;
  fromStatus: string;
  toStatus: string;
}): void {
  const fromStatus = input.fromStatus.trim();
  const toStatus = input.toStatus.trim();

  if (fromStatus.length === 0 || toStatus.length === 0) {
    throw new TourLifecycleTransitionError("TOUR_LIFECYCLE_STATUS_REQUIRED");
  }

  if (fromStatus === toStatus) {
    return;
  }

  if (fromStatus === CANCELLED_TERMINAL_STATUS) {
    throw new TourLifecycleTransitionError("TOUR_LIFECYCLE_CANCELLED_TERMINAL");
  }

  const allowed = input.lifecycle.allowedTransitions.some(
    (transition) => transition.from === fromStatus && transition.to === toStatus
  );
  if (!allowed) {
    throw new TourLifecycleTransitionError(
      `TOUR_LIFECYCLE_TRANSITION_REJECTED:${fromStatus}->${toStatus}`
    );
  }
}
