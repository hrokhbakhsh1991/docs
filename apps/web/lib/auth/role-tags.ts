import { isLeaderRole as isLeaderRolePolicy, isWorkspaceOwner as isWorkspaceOwnerPolicy } from "./routeRolePolicy";

/** Normalized JWT/workspace role strings (`owner` | `admin` | `member`, …). */
export function isLeaderRole(role?: string): boolean {
  return isLeaderRolePolicy(role);
}

export function isWorkspaceOwner(role?: string | null): boolean {
  return isWorkspaceOwnerPolicy(role);
}

/** Participant tenants use JWT claim `member` (product “participant”). */
export function isParticipantRole(role?: string): boolean {
  return (role ?? "").trim().toLowerCase() === "member";
}
