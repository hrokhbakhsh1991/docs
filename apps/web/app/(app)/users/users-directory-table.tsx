"use client";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { useTranslations } from "next-intl";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  USERS_DIRECTORY_TEST_IDS,
  type InvitableWorkspaceRole,
  type UsersDirectoryRow,
} from "@/features/users/users-directory-types";
import { formatUserLastActive } from "@/features/users/users-directory-list-logic";
import { assignableRolesForActor, canManageUserRow } from "@/features/users/users-page-logic";

import { UserMicroBadges } from "./users-directory-user-micro-badges";

type UsersDirectoryTableProps = {
  readonly users: readonly UsersDirectoryRow[];
  readonly session: OperatorSessionContext;
  readonly busyUserId: string | null;
  readonly locale: string;
  readonly onPatchRole: (userId: string, role: InvitableWorkspaceRole) => void;
  readonly onRemove: (userId: string) => void;
  readonly onSuspend: (userId: string) => void;
  readonly onReactivate: (userId: string) => void;
  readonly onOpenRewards: (user: UsersDirectoryRow) => void;
  readonly onOpenDetails: (user: UsersDirectoryRow) => void;
  readonly selectedUserIds: ReadonlySet<string>;
  readonly onToggleUserSelected: (userId: string, selected: boolean) => void;
  readonly onToggleSelectAll: (selected: boolean) => void;
};

export function UsersDirectoryTable({
  users,
  session,
  busyUserId,
  locale,
  onPatchRole,
  onRemove,
  onSuspend,
  onReactivate,
  onOpenRewards,
  onOpenDetails,
  selectedUserIds,
  onToggleUserSelected,
  onToggleSelectAll,
}: UsersDirectoryTableProps) {
  const t = useTranslations("users");
  const selectableUsers = users.filter((user) =>
    canManageUserRow(session.role, session.userId, user)
  );
  const allSelectableSelected =
    selectableUsers.length > 0 &&
    selectableUsers.every((user) => selectedUserIds.has(user.userId));

  return (
    <div
      className="hidden overflow-x-auto rounded-xl border md:block"
      data-testid={USERS_DIRECTORY_TEST_IDS.tableDesktop}
    >
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-muted/40 text-start text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">
              <Checkbox
                checked={allSelectableSelected}
                disabled={selectableUsers.length === 0}
                aria-label={t("bulk.selectAll")}
                data-testid={USERS_DIRECTORY_TEST_IDS.rowSelectAll}
                onChange={(event) => onToggleSelectAll(event.target.checked)}
              />
            </th>
            <th className="px-4 py-3 font-medium">{t("table.name")}</th>
            <th className="px-4 py-3 font-medium">{t("table.phone")}</th>
            <th className="px-4 py-3 font-medium">{t("table.role")}</th>
            <th className="px-4 py-3 font-medium">{t("table.status")}</th>
            <th className="px-4 py-3 font-medium">{t("table.badges")}</th>
            <th className="px-4 py-3 font-medium">{t("table.lastActive")}</th>
            <th className="px-4 py-3 font-medium">{t("table.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const manageable = canManageUserRow(session.role, session.userId, user);
            const roleOptions = assignableRolesForActor(session.role).filter(
              (role) => role !== user.role
            );
            const isSuspended = user.status === "SUSPENDED";
            const busy = busyUserId === user.userId;

            return (
              <tr key={user.userId} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  {manageable ? (
                    <Checkbox
                      checked={selectedUserIds.has(user.userId)}
                      disabled={busy}
                      aria-label={t("bulk.selectRow", { name: user.displayName })}
                      data-testid={USERS_DIRECTORY_TEST_IDS.rowSelect}
                      onChange={(event) =>
                        onToggleUserSelected(user.userId, event.target.checked)
                      }
                    />
                  ) : null}
                </td>
                <td className="px-4 py-3 font-medium">{user.displayName}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{t(`roles.${user.role}`)}</Badge>
                </td>
                <td className="px-4 py-3">
                  {isSuspended ? (
                    <Badge variant="destructive" data-testid={USERS_DIRECTORY_TEST_IDS.rowStatusSuspended}>
                      {t("status.suspended")}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{t("status.active")}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <UserMicroBadges user={user} compact />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatUserLastActive(user.lastActiveAt, locale)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      data-testid={USERS_DIRECTORY_TEST_IDS.rowDetails}
                      onClick={() => onOpenDetails(user)}
                    >
                      {t("actions.details")}
                    </Button>
                    {manageable ? (
                      <div
                        className="flex flex-wrap gap-1.5"
                        data-testid={USERS_DIRECTORY_TEST_IDS.rowActions}
                      >
                      {roleOptions.map((role) => (
                        <Button
                          key={role}
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          data-testid={USERS_DIRECTORY_TEST_IDS.rowRole}
                          onClick={() => onPatchRole(user.userId, role)}
                        >
                          {t("actions.setRole", { role: t(`roles.${role}`) })}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        data-testid={USERS_DIRECTORY_TEST_IDS.rowRewards}
                        onClick={() => onOpenRewards(user)}
                      >
                        {t("actions.rewards")}
                      </Button>
                      {isSuspended ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          data-testid={USERS_DIRECTORY_TEST_IDS.rowReactivate}
                          onClick={() => onReactivate(user.userId)}
                        >
                          {t("actions.reactivate")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          data-testid={USERS_DIRECTORY_TEST_IDS.rowSuspend}
                          onClick={() => onSuspend(user.userId)}
                        >
                          {t("actions.suspend")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        data-testid={USERS_DIRECTORY_TEST_IDS.rowRemove}
                        onClick={() => onRemove(user.userId)}
                      >
                        {t("actions.remove")}
                      </Button>
                    </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
