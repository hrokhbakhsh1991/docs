import { isLeaderRole as isLeaderRolePolicy } from "./routeRolePolicy";

/** Normalized JWT/workspace role strings (`owner` | `admin` | `member`, …). */
export function isLeaderRole(role?: string): boolean {
  return isLeaderRolePolicy(role);
}

/** Participant tenants use JWT claim `member` (product “participant”). */
export function isParticipantRole(role?: string): boolean {
  return (role ?? "").trim().toLowerCase() === "member";
}
