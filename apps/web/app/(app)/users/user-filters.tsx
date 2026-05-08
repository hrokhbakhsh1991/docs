"use client";

import { Button, FormField, Input, Select } from "@tour/ui";

import type { RoleFilter } from "./users-page-logic";
import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";

const copy = USERS_ROUTE_COPY.list;

type UserFiltersProps = {
  searchQuery: string;
  roleFilter: RoleFilter;
  isRefreshing: boolean;
  exportDisabled: boolean;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
  onExportCsv: () => void;
  onInviteUser: () => void;
};

export function UserFilters({
  searchQuery,
  roleFilter,
  isRefreshing,
  exportDisabled,
  onSearchChange,
  onRoleFilterChange,
  onExportCsv,
  onInviteUser
}: UserFiltersProps) {
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
          <Select value={roleFilter} onChange={(e) => onRoleFilterChange(e.target.value as RoleFilter)}>
            <option value="all">All</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </Select>
        </FormField>
      </div>
      <div className={styles.toolbarAction}>
        <Button type="button" variant="primary" onClick={onInviteUser}>
          Invite User
        </Button>
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
