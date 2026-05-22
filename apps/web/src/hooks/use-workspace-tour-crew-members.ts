"use client";

import { useQuery } from "@tanstack/react-query";

import { UserRole } from "@/lib/auth/user-role";
import { getUsers, usersUseLiveApi, type WorkspaceUserDto } from "@/lib/services/users.service";

const TOUR_CREW_ROLES = new Set<string>([UserRole.Owner, UserRole.Admin, UserRole.Leader]);

function isTourLeaderPickerEligible(user: WorkspaceUserDto): boolean {
  if (user.status !== "ACTIVE") {
    return false;
  }
  if (TOUR_CREW_ROLES.has(user.role)) {
    return true;
  }
  return Boolean(user.isSelectableLeader);
}

/** Active workspace members eligible as tour leaders (crew roles + selectable-leader micro-capability). */
export function useWorkspaceTourCrewMembers() {
  const liveApi = usersUseLiveApi();
  return useQuery({
    queryKey: ["workspace-tour-crew-members"],
    queryFn: async () => {
      const res = await getUsers({ limit: 100, status: "ACTIVE" });
      return res.data.filter(isTourLeaderPickerEligible);
    },
    enabled: liveApi,
    staleTime: 60_000,
  });
}
