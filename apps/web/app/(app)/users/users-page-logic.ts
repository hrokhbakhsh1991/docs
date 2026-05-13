import type { WorkspaceUserDto } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";
import { ROLE_RANK, type WorkspaceRole } from "@repo/shared-rbac";

export type RoleFilter = "all" | UserRole;
export type UserSortColumn = "name" | "email";
export type UserSortDirection = "asc" | "desc";

export function normalizeRole(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "owner") return "owner";
  if (r === "leader") return "leader";
  if (r === "admin") return "admin";
  if (r === "member") return "member";
  if (r === "viewer") return "viewer";
  if (r === "operator") return "member";
  return r || "member";
}

function workspaceRoleRank(role: string): number {
  const key = normalizeRole(role) as WorkspaceRole;
  return ROLE_RANK[key] ?? 0;
}

export function roleLabel(role: string): string {
  const r = normalizeRole(role);
  if (r === "owner") return "Owner";
  if (r === "leader") return "Leader";
  if (r === "admin") return "Admin";
  if (r === "member") return "Member";
  if (r === "viewer") return "Viewer";
  return role;
}

export function roleVariant(role: string): "info" | "warning" | "neutral" {
  if (normalizeRole(role) === "owner") return "info";
  if (normalizeRole(role) === "leader") return "warning";
  if (normalizeRole(role) === "admin") return "warning";
  if (normalizeRole(role) === "viewer") return "neutral";
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
    const hay = `${user.name}\n${user.email}`.toLowerCase();
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
      cmp = a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
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
