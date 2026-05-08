import type { TourDetailDto } from "@/lib/services/tours.service";
import { apiClient } from "../api-client";
import { API } from "../api-paths";

export type LeaderWorkspaceAggregateResponse = {
  tours: TourDetailDto[];
  meta: {
    /** True when backend indicates truncation/partial aggregation. */
    partial: boolean;
    total: number;
  };
};

export async function getLeaderWorkspaceAggregate(): Promise<LeaderWorkspaceAggregateResponse> {
  return apiClient.get<LeaderWorkspaceAggregateResponse>(API.dashboardLeaderWorkspace);
}

