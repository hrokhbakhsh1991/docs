"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import type { UseMutationResult } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useRef } from "react";

import { Button, Table, TableBody, TableHead, TableHeaderCell, TableRow } from "@tour/ui";

import type { AuthUser } from "@/lib/auth/auth-context";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";

import { type UserSortColumn, type UserSortDirection } from "./users-page-logic";
import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";
import { UserRow } from "./user-row";

const copy = USERS_ROUTE_COPY.list;

const VIRTUAL_USER_ROW_HEIGHT_PX = 100;

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
  activeRoleMutationUserId: string | null;
  roleMutation: UseMutationResult<WorkspaceUserDto, unknown, { userId: string; role: UserRole }, unknown>;
  onToggleSort: (_column: UserSortColumn) => void;
  onManageRewards?: (_user: WorkspaceUserDto) => void;
  directoryListQueryKey?: readonly unknown[];
  hasMoreBelow?: boolean;
  onRequestLoadMore?: () => void;
};

function UserTableBase({
  rows,
  sortColumn,
  sortDir,
  sessionUser,
  activeRoleMutationUserId,
  roleMutation,
  onToggleSort,
  onManageRewards,
  directoryListQueryKey,
  hasMoreBelow = false,
  onRequestLoadMore,
}: UserTableProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRequestedRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUAL_USER_ROW_HEIGHT_PX,
    overscan: 14,
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
    <div ref={scrollRef} className={styles.virtualScrollViewport} dir="rtl">
      <Table className={styles.directoryTable} aria-label={copy.tableAriaLabel}>
        <TableHead className={styles.stickyDirectoryThead}>
          <TableRow className={styles.directoryGridRow}>
            <TableHeaderCell aria-sort={ariaSortForColumn("name", sortColumn, sortDir)}>
              <Button type="button" variant="ghost" size="sm" onClick={() => onToggleSort("name")}>
                {copy.columnUser}{" "}
                {sortColumn === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </Button>
            </TableHeaderCell>
            <TableHeaderCell>{copy.columnSystemRole}</TableHeaderCell>
            <TableHeaderCell>{copy.columnFinancialsAnalytics}</TableHeaderCell>
            <TableHeaderCell className={styles.actionsCell} aria-label={copy.columnActions}>
              <span className={styles.actionsHeaderLabel}>{copy.columnActions}</span>
            </TableHeaderCell>
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
                activeRoleMutationUserId={activeRoleMutationUserId}
                roleMutation={roleMutation}
                onManageRewards={onManageRewards}
                directoryListQueryKey={directoryListQueryKey}
                trStyle={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
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
