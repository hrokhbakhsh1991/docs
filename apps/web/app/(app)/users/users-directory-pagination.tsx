"use client";

import { Button } from "@tour/ui";

import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";

const copy = USERS_ROUTE_COPY.list;

export type UsersDirectoryPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  hasUnloadedPages: boolean;
  isLoadingMore: boolean;
  onPrev: () => void;
  onNext: () => void;
};

/** Cursor-based load-more footer for directory list. */
export function UsersDirectoryPagination({
  currentPage,
  totalPages,
  totalUsers,
  hasUnloadedPages,
  isLoadingMore,
  onPrev,
  onNext,
}: UsersDirectoryPaginationProps) {
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages || hasUnloadedPages;

  if (!canPrev && !canNext) {
    return null;
  }

  return (
    <nav className={styles.paginationBar} aria-label={copy.paginationNavAriaLabel}>
      <span className={styles.pageIndicator}>
        Page {currentPage} of {hasUnloadedPages ? `${totalPages}+` : totalPages}
        <span> · {hasUnloadedPages ? `${totalUsers}+` : totalUsers} users</span>
        {isLoadingMore ? <span> · {copy.loadingMoreUsersLabel}</span> : null}
      </span>
      <span className={styles.sortCellInner}>
        <Button type="button" variant="secondary" onClick={onPrev} disabled={!canPrev || isLoadingMore}>
          Previous
        </Button>
        <Button type="button" variant="secondary" onClick={onNext} disabled={!canNext || isLoadingMore}>
          Next
        </Button>
      </span>
    </nav>
  );
}
