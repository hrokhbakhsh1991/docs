"use client";

import { FormField, Input, Select } from "@tour/ui";
import { Button } from "@tour/ui";

import type { RoleFilter } from "./users-page-logic";
import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";

const copy = USERS_ROUTE_COPY.list;

export type UsersDirectoryToolbarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: RoleFilter;
  onRoleFilterChange: (value: RoleFilter) => void;
  onExportCsv: () => void;
  exportDisabled?: boolean;
  isRefreshing?: boolean;
};

/**
 * Client-only search and role filter for the member directory (no URL sync).
 * State lives in `UsersPageClient`; this module is presentational wiring only.
 */
export function UsersDirectoryToolbar({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  onExportCsv,
  exportDisabled = false,
  isRefreshing = false,
}: UsersDirectoryToolbarProps) {
  return (
    <div className={styles.toolbar} role="group" aria-label={copy.membersToolbarAriaLabel}>
      <div className={styles.toolbarGrow}>
        <FormField label={copy.searchLabel}>
          <Input
            type="search"
            placeholder={copy.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
          />
        </FormField>
      </div>
      <div className={styles.toolbarFixed}>
        <FormField label={copy.filterRoleLabel}>
          <Select
            value={roleFilter}
            onChange={(e) => onRoleFilterChange(e.target.value as RoleFilter)}
          >
            <option value="all">All</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </Select>
        </FormField>
      </div>
      <div className={styles.toolbarAction}>
        <Button type="button" variant="secondary" onClick={onExportCsv} disabled={exportDisabled}>
          Export CSV
        </Button>
      </div>
      {isRefreshing ? <small className={styles.toolbarMeta}>{copy.refreshingLabel}</small> : null}
    </div>
  );
}
