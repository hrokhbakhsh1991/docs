import type { TourDetailDto } from "@/lib/services/tours.service";
import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";

export type LeaderWorkspaceAggregateResponse = {
  tours: TourDetailDto[];
  meta: {
    /** True when backend indicates truncation/partial aggregation. */
    partial: boolean;
    total: number;
  };
};

export async function getLeaderWorkspaceAggregate(): Promise<LeaderWorkspaceAggregateResponse> {
  return bffBrowserClient.get<LeaderWorkspaceAggregateResponse>(BFF.dashboardLeaderWorkspace);
}

