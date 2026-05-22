"use client";

import { Can } from "@casl/react";
import { Button, FormField, Input, Select } from "@tour/ui";

import type { AppAbility } from "@repo/shared";

import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";

import type { RoleFilter } from "./users-page-logic";
import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";

const copy = USERS_ROUTE_COPY.list;

function ExportCsvIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M12 16 7 11h3V4h4v7h3l-5 5Zm-7 4h14v2H5v-2Z"
      />
    </svg>
  );
}

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
  onInviteUser,
}: UserFiltersProps) {
  const ability = useAbility();

  return (
    <div className={styles.toolbarRow} role="group" aria-label={copy.membersToolbarAriaLabel}>
      <div className={styles.toolbarFilters}>
        <FormField label={copy.searchLabel} className={styles.toolbarSearchField}>
          <Input
            type="search"
            placeholder={copy.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
          />
        </FormField>
        <FormField label={copy.filterRoleLabel} className={styles.toolbarRoleField}>
          <Select value={roleFilter} onChange={(e) => onRoleFilterChange(e.target.value as RoleFilter)}>
            <option value="all">All</option>
            <option value="owner">Owner</option>
            <option value="leader">Leader</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </Select>
        </FormField>
        {isRefreshing ? <small className={styles.toolbarRefreshing}>{copy.refreshingLabel}</small> : null}
      </div>
      <div className={styles.toolbarActions}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={styles.toolbarIconButton}
          aria-label={copy.exportCsvAriaLabel}
          title={copy.exportCsvAriaLabel}
          disabled={exportDisabled}
          onClick={onExportCsv}
        >
          <ExportCsvIcon />
        </Button>
        <Can<AppAbility> ability={ability} I={AbilityAction.Create} a="UserMembership">
          {(allowed) => (
            <Button type="button" variant="primary" onClick={onInviteUser} disabled={!allowed}>
              {copy.inviteUserButton}
            </Button>
          )}
        </Can>
      </div>
    </div>
  );
}
