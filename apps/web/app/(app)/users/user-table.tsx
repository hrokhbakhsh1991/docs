"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import type { UseMutationResult } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import { Button, Checkbox, Table, TableBody, TableHead, TableHeaderCell, TableRow } from "@tour/ui";

import type { AuthUser } from "@/lib/auth/auth-context";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";

import { normalizeRole, type UserSortColumn, type UserSortDirection } from "./users-page-logic";
import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";
import { UserRow } from "./user-row";

const copy = USERS_ROUTE_COPY.list;

/** Fixed row height for virtual windowing (labels cell is clamped in CSS). */
const VIRTUAL_USER_ROW_HEIGHT_PX = 76;

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
  roleMutation: UseMutationResult<WorkspaceUserDto, unknown, { userId: string; role: UserRole }, unknown>;
  onToggleSort: (column: UserSortColumn) => void;
  onOpenProfile: (userId: string) => void;
  onSelectedUserIdsChange: (userIds: Set<string>) => void;
  onManageRewards?: (user: WorkspaceUserDto) => void;
  /** When true, more server pages can be fetched (infinite query). */
  hasMoreBelow?: boolean;
  onRequestLoadMore?: () => void;
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
  onSelectedUserIdsChange,
  onManageRewards,
  hasMoreBelow = false,
  onRequestLoadMore
}: UserTableProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRequestedRef = useRef(false);

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

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUAL_USER_ROW_HEIGHT_PX,
    overscan: 14
  });

  const requestLoadMore = useCallback(() => {
    if (!hasMoreBelow || !onRequestLoadMore) {
      return;
    }
    if (loadMoreRequestedRef.current) {
      return;
    }
    loadMoreRequestedRef.current = true;
    onRequestLoadMore();
    window.setTimeout(() => {
      loadMoreRequestedRef.current = false;
    }, 400);
  }, [hasMoreBelow, onRequestLoadMore]);

  useEffect(() => {
    virtualizer.measure();
  }, [rows, virtualizer]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return undefined;
    }
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceToBottom < 480) {
        requestLoadMore();
      }
      const items = virtualizer.getVirtualItems();
      if (items.length === 0) {
        return;
      }
      const last = items[items.length - 1];
      if (last && last.index >= rows.length - 8) {
        requestLoadMore();
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [virtualizer, rows.length, requestLoadMore]);

  const totalSize = virtualizer.getTotalSize();

  return (
    <div ref={scrollRef} className={styles.virtualScrollViewport}>
      <Table className={styles.directoryTable} aria-label={copy.tableAriaLabel}>
        <TableHead className={styles.stickyDirectoryThead}>
          <TableRow className={styles.directoryGridRow}>
            <TableHeaderCell className={styles.selectionCell}>
              <Checkbox
                bare
                aria-label="Select all loaded users"
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
            <TableHeaderCell>{copy.columnLabels}</TableHeaderCell>
            <TableHeaderCell>Role</TableHeaderCell>
            <TableHeaderCell>{copy.columnPermanentDiscount}</TableHeaderCell>
            <TableHeaderCell>{copy.columnRewardBadges}</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Last Login</TableHeaderCell>
            <TableHeaderCell>Joined At</TableHeaderCell>
            <TableHeaderCell className={styles.actionsCell}>{copy.columnActions}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody className={styles.virtualTbody} style={{ height: `${totalSize}px` }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) {
              return null;
            }
            return (
              <UserRow
                key={row.id}
                row={row}
                sessionUser={sessionUser}
                selected={selectedUserIds.has(row.id)}
                activeRoleMutationUserId={activeRoleMutationUserId}
                roleMutation={roleMutation}
                onOpenProfile={onOpenProfile}
                onToggleSelected={toggleRowSelection}
                onManageRewards={onManageRewards}
                trStyle={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
                className={`${styles.directoryGridRow} ${styles.virtualDataRow}`}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export const UserTable = memo(UserTableBase);
