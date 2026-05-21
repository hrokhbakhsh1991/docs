import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";
import type { OptimisticUsersRollbackHandlers, WorkspaceUserDto } from "@/lib/services/users.service";
import { withOptimisticUsersRollback } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";
import { WORKSPACE_REWARD_BADGE_IDS, type WorkspaceRewardBadgeId } from "@repo/shared";

export type WorkspaceUserRewardsPayload = {
  permanentDiscountPercentage?: number;
  badges?: WorkspaceRewardBadgeId[];
};

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
