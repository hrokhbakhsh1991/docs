"use client";

import { useQuery } from "@tanstack/react-query";

import { UserRole } from "@/lib/auth/user-role";
import { getUsers, usersUseLiveApi, type WorkspaceUserDto } from "@/lib/services/users.service";

const TOUR_CREW_ROLES = new Set<string>([UserRole.Owner, UserRole.Admin, UserRole.Leader]);

function isTourCrewMember(user: WorkspaceUserDto): boolean {
  return user.status === "ACTIVE" && TOUR_CREW_ROLES.has(user.role);
}

/** Active workspace staff eligible as tour leaders (owner / admin / leader). */
export function useWorkspaceTourCrewMembers() {
  const liveApi = usersUseLiveApi();
  return useQuery({
    queryKey: ["workspace-tour-crew-members"],
    queryFn: async () => {
      const res = await getUsers({ limit: 100, status: "ACTIVE" });
      return res.data.filter(isTourCrewMember);
    },
    enabled: liveApi,
    staleTime: 60_000,
  });
}
