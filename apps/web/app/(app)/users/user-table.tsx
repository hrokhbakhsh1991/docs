"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { memo, useMemo } from "react";

import { Button, Checkbox, Table, TableBody, TableHead, TableHeaderCell, TableRow } from "@tour/ui";

import type { AuthUser } from "@/lib/auth/auth-context";
import type { WorkspaceUserDto } from "@/lib/services/users.service";

import { normalizeRole, type UserSortColumn, type UserSortDirection } from "./users-page-logic";
import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";
import { UserRow } from "./user-row";

const copy = USERS_ROUTE_COPY.list;

function ariaSortForColumn(
  column: UserSortColumn,
  activeColumn: UserSortColumn,
  sortDir: UserSortDirection
): "ascending" | "descending" | "none" {
  if (activeColumn !== column) return "none";
  return sortDir === "asc" ? "ascending" : "descending";
}

type UserTableProps = {
  rows: WorkspaceUserDto[];
  sortColumn: UserSortColumn;
  sortDir: UserSortDirection;
  sessionUser: AuthUser | null;
  selectedUserIds: ReadonlySet<string>;
  activeRoleMutationUserId: string | null;
  roleMutation: UseMutationResult<WorkspaceUserDto, unknown, { userId: string; role: string }, unknown>;
  onToggleSort: (column: UserSortColumn) => void;
  onOpenProfile: (userId: string) => void;
  onSelectedUserIdsChange: (userIds: Set<string>) => void;
};

function UserTableBase({
  rows,
  sortColumn,
  sortDir,
  sessionUser,
  selectedUserIds,
  activeRoleMutationUserId,
  roleMutation,
  onToggleSort,
  onOpenProfile,
  onSelectedUserIdsChange
}: UserTableProps) {
  const selectableVisibleIds = useMemo(() => {
    const sessionUserId = sessionUser?.userId ?? "";
    return rows
      .filter((row) => normalizeRole(row.role) !== "owner" && row.id !== sessionUserId)
      .map((row) => row.id);
  }, [rows, sessionUser?.userId]);

  const allVisibleSelected =
    selectableVisibleIds.length > 0 && selectableVisibleIds.every((userId) => selectedUserIds.has(userId));

  function toggleSelectAllVisible(checked: boolean) {
    if (checked) {
      const next = new Set(selectedUserIds);
      for (const userId of selectableVisibleIds) next.add(userId);
      onSelectedUserIdsChange(next);
      return;
    }
    const visibleIdSet = new Set(selectableVisibleIds);
    const next = new Set<string>();
    for (const userId of selectedUserIds) {
      if (!visibleIdSet.has(userId)) next.add(userId);
    }
    onSelectedUserIdsChange(next);
  }

  function toggleRowSelection(userId: string, checked: boolean) {
    const next = new Set(selectedUserIds);
    if (checked) next.add(userId);
    else next.delete(userId);
    onSelectedUserIdsChange(next);
  }

  return (
    <Table aria-label={copy.tableAriaLabel}>
      <TableHead>
        <TableRow>
          <TableHeaderCell className={styles.selectionCell}>
            <Checkbox
              bare
              aria-label="Select all visible users"
              checked={allVisibleSelected}
              disabled={selectableVisibleIds.length === 0}
              onChange={(event) => toggleSelectAllVisible(event.target.checked)}
            />
          </TableHeaderCell>
          <TableHeaderCell aria-sort={ariaSortForColumn("name", sortColumn, sortDir)}>
            <Button type="button" variant="ghost" size="sm" onClick={() => onToggleSort("name")}>
              Name {sortColumn === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </Button>
          </TableHeaderCell>
          <TableHeaderCell aria-sort={ariaSortForColumn("email", sortColumn, sortDir)}>
            <Button type="button" variant="ghost" size="sm" onClick={() => onToggleSort("email")}>
              Email {sortColumn === "email" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </Button>
          </TableHeaderCell>
          <TableHeaderCell>Phone</TableHeaderCell>
          <TableHeaderCell>Phone verification</TableHeaderCell>
          <TableHeaderCell>Role</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Last Login</TableHeaderCell>
          <TableHeaderCell>Joined At</TableHeaderCell>
          <TableHeaderCell className={styles.actionsCell}>{copy.columnActions}</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <UserRow
            key={row.id}
            row={row}
            sessionUser={sessionUser}
            selected={selectedUserIds.has(row.id)}
            activeRoleMutationUserId={activeRoleMutationUserId}
            roleMutation={roleMutation}
            onOpenProfile={onOpenProfile}
            onToggleSelected={toggleRowSelection}
          />
        ))}
      </TableBody>
    </Table>
  );
}

export const UserTable = memo(UserTableBase);
