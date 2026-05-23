"use client";

import { Button, Card, CardBody, Select } from "@tour/ui";

import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";

import { UserRole } from "@/lib/auth/user-role";

import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";

export type BulkAssignableRole =
  | typeof UserRole.Leader
  | typeof UserRole.Admin
  | typeof UserRole.Member
  | typeof UserRole.Viewer;
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
  const ability = useAbility();
  const canMutateMembership = ability.can(AbilityAction.Update, "UserMembership");

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
                disabled={!canMutateMembership}
                onChange={(event) => onSelectedRoleChange(event.target.value as "" | BulkAssignableRole)}
              >
                <option value="">{copy.bulkChangeRolePlaceholder}</option>
                <option value={UserRole.Leader}>{copy.roleFilterLeader}</option>
                <option value={UserRole.Admin}>{copy.roleFilterAdmin}</option>
                <option value={UserRole.Member}>{copy.roleFilterMember}</option>
                <option value={UserRole.Viewer}>{copy.roleFilterViewer}</option>
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
              disabled={!canMutateMembership}
            >
              {copy.bulkSuspendUsersButton}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onReactivateUsers}
              loading={isReactivating}
              disabled={!canMutateMembership}
            >
              {copy.bulkReactivateUsersButton}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onRemoveUsers}
              loading={isRemoving}
              disabled={!canMutateMembership}
            >
              {copy.bulkRemoveUsersButton}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onApplyRole}
              disabled={!selectedRole || !canMutateMembership}
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
