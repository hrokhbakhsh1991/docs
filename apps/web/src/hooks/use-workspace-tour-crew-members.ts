"use client";

import { useQuery } from "@tanstack/react-query";

import {
  isEligibleTourLeaderMembership,
  SELECTABLE_LEADER_CAPABILITY,
} from "@repo/shared";

import { workspaceTourCrewMembersKeys } from "@/lib/query-keys";
import { getUsers, usersUseLiveApi, type WorkspaceUserDto } from "@/lib/services/users.service";

import { useAuthBffQueryGateForTenant } from "./use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "./use-workspace-query-scope";

function isTourLeaderPickerEligible(user: WorkspaceUserDto): boolean {
  if (user.status !== "ACTIVE") {
    return false;
  }
  const metadata =
    user.isSelectableLeader === true
      ? { capabilities: [SELECTABLE_LEADER_CAPABILITY] }
      : {};
  return isEligibleTourLeaderMembership(user.role, metadata);
}

/** Active workspace members eligible as tour leaders (crew roles + selectable-leader micro-capability). */
export function useWorkspaceTourCrewMembers() {
  const tenantId = useWorkspaceQueryScope();
  const liveApi = usersUseLiveApi();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  return useQuery({
    queryKey: workspaceTourCrewMembersKeys.detail(tenantId ?? ""),
    queryFn: async () => {
      // Server-side leaderUserIds assertion is authoritative; client filter is defense in depth.
      const res = await getUsers({ limit: 100, status: "ACTIVE" });
      return res.data.filter(isTourLeaderPickerEligible);
    },
    enabled: liveApi && authBffQueryEnabled,
    staleTime: 60_000,
  });
}
