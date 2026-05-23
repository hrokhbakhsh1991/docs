import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";
import type { OptimisticUsersRollbackHandlers, WorkspaceUserDto } from "@/lib/services/users.service";
import { withOptimisticUsersRollback } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";
import { WORKSPACE_REWARD_BADGE_IDS, type WorkspaceRewardBadgeId } from "@repo/shared";

export type WorkspaceUserRewardsPayload = {
  /** Omit to leave unchanged; `null` clears `membership_metadata.permanentDiscountPercentage`. */
  permanentDiscountPercentage?: number | null;
  badges?: WorkspaceRewardBadgeId[];
  isSelectableLeader?: boolean;
  /** Replaces `user_tenants.labels` when provided (including `[]` to clear). */
  labels?: string[];
};

export type UserBookingTripRow = {
  tourTitle: string;
  departureDate: string | null;
  registrationStatus: string;
  paymentStatus: string;
};

export type UserBookingSummaryResponse = {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  trips: UserBookingTripRow[];
};

export async function getWorkspaceUserBookingSummary(
  userId: string
): Promise<UserBookingSummaryResponse> {
  return bffBrowserClient.get<UserBookingSummaryResponse>(
    BFF.workspaceUserBookingSummary(userId)
  );
}

export { WORKSPACE_REWARD_BADGE_IDS };
export type { WorkspaceRewardBadgeId };

export async function patchWorkspaceUserRole(
  userId: string,
  role: UserRole,
  optimistic?: OptimisticUsersRollbackHandlers<unknown, WorkspaceUserDto>
): Promise<WorkspaceUserDto> {
  const run = () =>
    bffBrowserClient.patch<WorkspaceUserDto>(
      BFF.workspaceUserRole(userId),
      { role },
      { idempotencyKey: true }
    );
  if (!optimistic) {
    return run();
  }
  return withOptimisticUsersRollback(run, optimistic);
}

export async function postWorkspaceUserRewards(
  userId: string,
  payload: WorkspaceUserRewardsPayload,
  optimistic?: OptimisticUsersRollbackHandlers<unknown, WorkspaceUserDto>
): Promise<WorkspaceUserDto> {
  const run = () =>
    bffBrowserClient.post<WorkspaceUserDto>(
      BFF.workspaceUserRewards(userId),
      payload,
      { idempotencyKey: true }
    );
  if (!optimistic) {
    return run();
  }
  return withOptimisticUsersRollback(run, optimistic);
}

export async function postWorkspaceUserSelectableLeader(
  userId: string,
  enabled: boolean,
  optimistic?: OptimisticUsersRollbackHandlers<unknown, WorkspaceUserDto>
): Promise<WorkspaceUserDto> {
  const run = () =>
    bffBrowserClient.post<WorkspaceUserDto>(
      BFF.workspaceUserSelectableLeader(userId),
      { enabled },
      { idempotencyKey: true }
    );
  if (!optimistic) {
    return run();
  }
  return withOptimisticUsersRollback(run, optimistic);
}
