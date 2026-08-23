import type { MemberRegistrationDisplayStatus } from "../registration/member-registration-display-status";
import { WORKSPACE_MEMBER_REGISTRATION_STATUS_DISPLAY } from "./workspace-member-registration-status-display.generated";

/**
 * Map native persistence/API wire status to neutral member display semantic (DEC-CW-04 Option B).
 * Returns undefined when workspace has no manifest binding or native status is unknown.
 */
export function resolveMemberRegistrationDisplayStatus(
  workspaceId: string,
  nativeStatus: string,
): MemberRegistrationDisplayStatus | undefined {
  const map = WORKSPACE_MEMBER_REGISTRATION_STATUS_DISPLAY[workspaceId];
  if (map === undefined) {
    return undefined;
  }
  return map[nativeStatus];
}
