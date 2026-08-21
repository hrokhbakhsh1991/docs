import type { ActorRole } from "@app-tour/workspace-sdk";

import { normalizeNumericInputValue } from "@/i18n/format-localized-digits";

import type {
  InvitableWorkspaceRole,
  UsersDirectoryRow,
  UsersDirectoryStatus,
} from "./users-directory-types";

/** Product gate — hide ownership transfer panel until flow is explicitly enabled. */
export const USERS_OWNERSHIP_TRANSFER_UI_ENABLED = false;

export type InviteRequestBody = {
  readonly phone: string;
  readonly role: InvitableWorkspaceRole;
  readonly nameNote?: string;
};

export function buildInviteRequestBody(input: {
  readonly phone: string;
  readonly role: InvitableWorkspaceRole;
  readonly nameNote?: string;
}): InviteRequestBody {
  const phone = normalizeNumericInputValue(input.phone.trim(), "phone");
  const body: InviteRequestBody = { phone, role: input.role };
  const nameNote = input.nameNote?.trim();
  if (nameNote && nameNote.length > 0) {
    return { ...body, nameNote };
  }
  return body;
}

export type UsersCsvRow = {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly gender: string;
  readonly role: string;
  readonly status: string;
};

export function assignableRolesForActor(actorRole: ActorRole): readonly InvitableWorkspaceRole[] {
  if (actorRole === "owner") {
    return ["admin", "member", "viewer"];
  }
  if (actorRole === "admin") {
    return ["member", "viewer"];
  }
  return [];
}

export function canManageUserRow(
  actorRole: ActorRole,
  actorUserId: string,
  target: UsersDirectoryRow
): boolean {
  if (target.userId === actorUserId) {
    return false;
  }
  if (target.role === "owner") {
    return false;
  }
  const rank: Record<ActorRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
    none: 0,
  };
  return rank[actorRole] > rank[target.role as ActorRole];
}

/** Rewards editing follows the backend protected-role contract: owner rewards are immutable here. */
export function canEditUserRewards(
  actorRole: ActorRole,
  actorUserId: string,
  target: UsersDirectoryRow
): boolean {
  if (target.role === "owner") {
    return false;
  }
  return canManageUserRow(actorRole, actorUserId, target);
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildUsersCsvContent(rows: readonly UsersCsvRow[]): string {
  const headers = ["name", "phone", "email", "gender", "role", "status"];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [row.name, row.phone, row.email, row.gender, row.role, row.status]
        .map(escapeCsvCell)
        .join(",")
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export function toUsersCsvRows(items: readonly UsersDirectoryRow[]): readonly UsersCsvRow[] {
  return items.map((row) => ({
    name: row.displayName,
    phone: row.phone ?? "",
    email: row.email ?? "",
    gender: row.gender ?? "",
    role: row.role,
    status: row.status,
  }));
}

export function buildUsersCsvFilename(tenantSlug: string, date: Date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  const slug = tenantSlug.trim().length > 0 ? tenantSlug.trim() : "workspace";
  return `users-${slug}-${stamp}.csv`;
}

export function filterUsersDirectoryByStatus(
  items: readonly UsersDirectoryRow[],
  status: UsersDirectoryStatus
): readonly UsersDirectoryRow[] {
  if (status === "all") {
    return items;
  }
  if (status === "active") {
    return items.filter((row) => row.status !== "SUSPENDED");
  }
  return items.filter((row) => row.status === "SUSPENDED");
}
