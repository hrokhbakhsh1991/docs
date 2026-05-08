import type { WorkspaceUserDto } from "@/lib/services/users.service";

export type RoleFilter = "all" | "owner" | "admin" | "member" | "viewer";
export type UserSortColumn = "name" | "email";
export type UserSortDirection = "asc" | "desc";

export function normalizeRole(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "owner") return "owner";
  if (r === "admin") return "admin";
  if (r === "member") return "member";
  if (r === "viewer") return "viewer";
  if (r === "operator") return "member";
  return r || "member";
}

export function roleLabel(role: string): string {
  const r = normalizeRole(role);
  if (r === "owner") return "Owner";
  if (r === "admin") return "Admin";
  if (r === "member") return "Member";
  if (r === "viewer") return "Viewer";
  return role;
}

export function roleVariant(role: string): "info" | "warning" | "neutral" {
  if (normalizeRole(role) === "owner") return "info";
  if (normalizeRole(role) === "admin") return "warning";
  if (normalizeRole(role) === "viewer") return "neutral";
  return "neutral";
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
    if (options.sortColumn === "name") {
      return factor * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
    return factor * a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
  });
  return rows;
}
