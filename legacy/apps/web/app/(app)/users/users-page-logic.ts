import type { WorkspaceUserDto } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";
import { ROLE_RANK, tryParseWorkspaceRole, WorkspaceRole } from "@repo/shared";

export type RoleFilter = "all" | UserRole;
export type UserSortColumn = "name" | "email";
export type UserSortDirection = "asc" | "desc";

export function normalizeRole(role: string): string {
  return tryParseWorkspaceRole(role) ?? WorkspaceRole.Member;
}

function workspaceRoleRank(role: string): number {
  const key = tryParseWorkspaceRole(normalizeRole(role));
  if (!key) {
    return 0;
  }
  return ROLE_RANK[key] ?? 0;
}

export function systemRoleBadgeLabel(role: string): string {
  return roleLabel(role);
}

const INVITE_ROLE_LABELS_FA: Record<string, string> = {
  admin: "مدیر",
  member: "عضو عادی",
  viewer: "بیننده"
};

export function inviteRoleLabelFa(role: string): string {
  const key = normalizeRole(role);
  return INVITE_ROLE_LABELS_FA[key] ?? roleLabel(role);
}

export function roleLabel(role: string): string {
  const parsed = tryParseWorkspaceRole(normalizeRole(role));
  switch (parsed) {
    case WorkspaceRole.Owner:
      return "مالک";
    case WorkspaceRole.Leader:
      return "راهبر";
    case WorkspaceRole.Admin:
      return "مدیر";
    case WorkspaceRole.Member:
      return "عضو عادی";
    case WorkspaceRole.Viewer:
      return "بیننده";
    default:
      return role;
  }
}

export function roleVariant(role: string): "info" | "warning" | "neutral" {
  const parsed = tryParseWorkspaceRole(normalizeRole(role));
  if (parsed === WorkspaceRole.Owner) return "info";
  if (parsed === WorkspaceRole.Leader || parsed === WorkspaceRole.Admin) return "warning";
  if (parsed === WorkspaceRole.Viewer) return "neutral";
  return "neutral";
}

/** Display slug for membership labels (e.g. `club_member` → "Club Member"). */
export function formatMembershipLabelDisplay(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return t
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function statusVariant(status: WorkspaceUserDto["status"]): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "Active":
      return "success";
    case "Invited":
      return "warning";
    default:
      return "neutral";
  }
}

export function filterAndSortUsers(
  users: WorkspaceUserDto[],
  options: {
    roleFilter: RoleFilter;
    queryNorm: string;
    sortColumn: UserSortColumn;
    sortDir: UserSortDirection;
  }
): WorkspaceUserDto[] {
  const byRole = filterUsers(users, {
    roleFilter: options.roleFilter,
    queryNorm: options.queryNorm
  });
  return sortUsers(byRole, {
    sortColumn: options.sortColumn,
    sortDir: options.sortDir
  });
}

export function filterUsers(
  users: WorkspaceUserDto[],
  options: {
    roleFilter: RoleFilter;
    queryNorm: string;
  }
): WorkspaceUserDto[] {
  const byRole = users.filter((user) => {
    if (options.roleFilter === "all") return true;
    return normalizeRole(user.role) === options.roleFilter;
  });

  return byRole.filter((user) => {
    if (!options.queryNorm) return true;
    const hay = `${user.name}\n${user.email ?? ""}`.toLowerCase();
    return hay.includes(options.queryNorm);
  });
}

export function sortUsers(
  users: WorkspaceUserDto[],
  options: {
    sortColumn: UserSortColumn;
    sortDir: UserSortDirection;
  }
): WorkspaceUserDto[] {
  const factor = options.sortDir === "asc" ? 1 : -1;
  const rows = [...users];
  rows.sort((a, b) => {
    let cmp = 0;
    if (options.sortColumn === "name") {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    } else {
      cmp = (a.email ?? "").localeCompare(b.email ?? "", undefined, { sensitivity: "base" });
    }
    if (cmp !== 0) {
      return factor * cmp;
    }
    /** Tie-break: higher workspace privilege first (uses shared {@link ROLE_RANK}). */
    const ra = workspaceRoleRank(a.role);
    const rb = workspaceRoleRank(b.role);
    return factor * (rb - ra);
  });
  return rows;
}
