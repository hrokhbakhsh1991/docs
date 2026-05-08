"use client";

import { Button, Card, CardBody, Select } from "@tour/ui";

import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";

export type BulkAssignableRole = "admin" | "member" | "viewer";
const copy = USERS_ROUTE_COPY.list;

type UsersDirectoryBulkToolbarProps = {
  selectedCount: number;
  selectedRole: "" | BulkAssignableRole;
  onSelectedRoleChange: (role: "" | BulkAssignableRole) => void;
  onApplyRole: () => void;
  onSuspendUsers: () => void;
  onReactivateUsers: () => void;
  onRemoveUsers: () => void;
  isApplying: boolean;
  isSuspending: boolean;
  isReactivating: boolean;
  isRemoving: boolean;
  onClearSelection: () => void;
};

export function UsersDirectoryBulkToolbar({
  selectedCount,
  selectedRole,
  onSelectedRoleChange,
  onApplyRole,
  onSuspendUsers,
  onReactivateUsers,
  onRemoveUsers,
  isApplying,
  isSuspending,
  isReactivating,
  isRemoving,
  onClearSelection,
}: UsersDirectoryBulkToolbarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <Card>
      <CardBody>
        <div className={styles.bulkToolbar} aria-label={copy.bulkActionsAriaLabel}>
          <p className={styles.bulkSelectionSummary} aria-live="polite">
            {`${selectedCount} ${copy.bulkSelectedCountSuffix}`}
          </p>
          <div className={styles.bulkActionControls}>
            <label className={styles.bulkRoleLabel}>
              <span>{copy.bulkChangeRoleLabel}</span>
              <Select
                aria-label={copy.bulkChangeRoleAriaLabel}
                value={selectedRole}
                onChange={(event) => onSelectedRoleChange(event.target.value as "" | BulkAssignableRole)}
              >
                <option value="">{copy.bulkChangeRolePlaceholder}</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </Select>
            </label>
            <Button type="button" variant="ghost" onClick={onClearSelection}>
              {copy.bulkClearSelectionButton}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onSuspendUsers}
              loading={isSuspending}
            >
              Suspend users
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onReactivateUsers}
              loading={isReactivating}
            >
              Reactivate users
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onRemoveUsers}
              loading={isRemoving}
            >
              Remove users
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onApplyRole}
              disabled={!selectedRole}
              loading={isApplying}
            >
              {copy.bulkApplyRoleButton}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
