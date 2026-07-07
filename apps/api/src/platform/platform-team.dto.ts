import type { PlatformOpsUserRow } from "./platform-ops-user.repository.ts";

export type PlatformTeamMemberDto = {
  readonly phone: string;
  readonly role: string;
  readonly createdAt: string;
};

export function toPlatformTeamMemberDto(row: PlatformOpsUserRow): PlatformTeamMemberDto {
  return {
    phone: row.phone,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}
