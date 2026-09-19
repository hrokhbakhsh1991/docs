import type { TourExecutionStatus } from "./tour-execution-types";

const ALLOWED: Readonly<Record<TourExecutionStatus, readonly TourExecutionStatus[]>> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionTourExecution(
  from: TourExecutionStatus,
  to: TourExecutionStatus
): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTourExecutionTransition(
  from: TourExecutionStatus,
  to: TourExecutionStatus
): void {
  if (!canTransitionTourExecution(from, to)) {
    throw new Error(`TOUR_EXECUTION_TRANSITION_INVALID: ${from} → ${to}`);
  }
}
