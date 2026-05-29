"use client";

import { useQuery } from "@tanstack/react-query";

import {
  isEligibleTourLeaderMembership,
  SELECTABLE_LEADER_CAPABILITY,
} from "@repo/shared";

import { getUsers, usersUseLiveApi, type WorkspaceUserDto } from "@/lib/services/users.service";

import { useAuthBffQueryGate } from "./use-auth-bff-query-gate";

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
  const liveApi = usersUseLiveApi();
  const { authBffQueryEnabled } = useAuthBffQueryGate();
  return useQuery({
    queryKey: ["workspace-tour-crew-members"],
    queryFn: async () => {
      // Server-side leaderUserIds assertion is authoritative; client filter is defense in depth.
      const res = await getUsers({ limit: 100, status: "ACTIVE" });
      return res.data.filter(isTourLeaderPickerEligible);
    },
    enabled: liveApi && authBffQueryEnabled,
    staleTime: 60_000,
  });
}
