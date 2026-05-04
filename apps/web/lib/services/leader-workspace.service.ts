import type { TourDetailDto } from "@/lib/services/tours.service";

export type LeaderWorkspaceAggregateResponse = {
  tours: TourDetailDto[];
  /** True when backend indicates truncation/partial aggregation. */
  partial: boolean;
};

/**
 * Placeholder for future aggregate endpoint integration.
 * Expected API: `GET /api/v2/dashboard/leader-workspace` (not wired yet).
 */
export async function getLeaderWorkspaceAggregate(): Promise<LeaderWorkspaceAggregateResponse> {
  throw new Error("LEADER_WORKSPACE_AGGREGATE_NOT_IMPLEMENTED");
}

