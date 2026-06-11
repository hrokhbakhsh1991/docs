import type { UsersDirectoryRow } from "./users-directory-types";

export type OwnershipTransferCandidate = Pick<
  UsersDirectoryRow,
  "userId" | "displayName" | "role" | "phone" | "status"
>;

export function eligibleOwnershipTransferTargets(
  items: readonly UsersDirectoryRow[],
  actorUserId: string
): readonly OwnershipTransferCandidate[] {
  return items
    .filter(
      (row) =>
        row.userId !== actorUserId &&
        row.status === "ACTIVE" &&
        (row.role === "admin" || row.role === "member")
    )
    .map((row) => ({
      userId: row.userId,
      displayName: row.displayName,
      role: row.role,
      phone: row.phone,
      status: row.status,
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export type TransferWorkspaceOwnershipRequest = {
  readonly newOwnerUserId: string;
};

export type TransferWorkspaceOwnershipResponse = {
  readonly tenantId: string;
  readonly previousOwnerUserId: string;
  readonly newOwnerUserId: string;
};
