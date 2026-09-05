import type { TourListProjection } from "@/features/tours/operator-tours-types";

export type TourWorkspaceLifecyclePhase = "design" | "selling" | "running";

const RUNNING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * UX-002 — distinguish tour design vs sell vs run in workspace chrome.
 */
export function resolveTourWorkspaceLifecyclePhase(
  projection: Pick<TourListProjection, "uiStatus" | "departureAt">,
  nowMs: number = Date.now(),
): TourWorkspaceLifecyclePhase {
  if (projection.uiStatus === "draft") {
    return "design";
  }
  const departureMs = parseDepartureMs(projection.departureAt);
  if (departureMs !== null && departureMs - nowMs <= RUNNING_WINDOW_MS) {
    return "running";
  }
  return "selling";
}

function parseDepartureMs(departureAt: string | null): number | null {
  if (departureAt === null || departureAt.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(departureAt);
  return Number.isNaN(parsed) ? null : parsed;
}
