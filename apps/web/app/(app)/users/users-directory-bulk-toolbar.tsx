"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  INVITABLE_ROLES,
  USERS_DIRECTORY_TEST_IDS,
  type InvitableWorkspaceRole,
} from "@/features/users/users-directory-types";

type UsersDirectoryBulkToolbarProps = {
  readonly selectedCount: number;
  readonly busy: boolean;
  readonly onClearSelection: () => void;
  readonly onApplyRole: (role: InvitableWorkspaceRole) => void;
  readonly onSuspend: () => void;
  readonly onReactivate: () => void;
  readonly onRemove: () => void;
};

export function UsersDirectoryBulkToolbar({
  selectedCount,
  busy,
  onClearSelection,
  onApplyRole,
  onSuspend,
  onReactivate,
  onRemove,
}: UsersDirectoryBulkToolbarProps) {
  const t = useTranslations("users");
  const [roleDraft, setRoleDraft] = useState<InvitableWorkspaceRole>("member");

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3"
      data-testid={USERS_DIRECTORY_TEST_IDS.bulkToolbar}
    >
      <p className="text-sm font-medium">
        {t("bulk.selectedCount", { count: selectedCount })}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <span>{t("bulk.changeRoleLabel")}</span>
        <select
          className="rounded-md border bg-background px-2 py-1"
          value={roleDraft}
          disabled={busy}
          data-testid={USERS_DIRECTORY_TEST_IDS.bulkRoleSelect}
          onChange={(event) => setRoleDraft(event.target.value as InvitableWorkspaceRole)}
        >
          {INVITABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          data-testid={USERS_DIRECTORY_TEST_IDS.bulkApplyRole}
          onClick={() => onApplyRole(roleDraft)}
        >
          {t("bulk.applyRole")}
        </Button>
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        data-testid={USERS_DIRECTORY_TEST_IDS.bulkSuspend}
        onClick={onSuspend}
      >
        {t("bulk.suspend")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        data-testid={USERS_DIRECTORY_TEST_IDS.bulkReactivate}
        onClick={onReactivate}
      >
        {t("bulk.reactivate")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={busy}
        data-testid={USERS_DIRECTORY_TEST_IDS.bulkRemove}
        onClick={onRemove}
      >
        {t("bulk.remove")}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onClearSelection}>
        {t("bulk.clearSelection")}
      </Button>
    </div>
  );
}
