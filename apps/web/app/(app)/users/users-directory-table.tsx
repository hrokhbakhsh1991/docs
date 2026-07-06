"use client";

import type { ReactNode } from "react";
import type { OperatorProfileGender } from "@app-tour/workspace-sdk";
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
import { formatOperatorProfileGenderLabel } from "@/features/operator-profile/gender";
import {
  assignableRolesForActor,
  canEditUserRewards,
  canManageUserRow,
} from "@/features/users/users-page-logic";

import { UserMicroBadges } from "./users-directory-user-micro-badges";
import { UsersDirectoryAvatar } from "./users-directory-avatar";

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

const HEAD_CELL =
  "px-4 py-3 text-start align-middle font-medium whitespace-nowrap text-muted-foreground";
const BODY_CELL = "px-4 py-3 text-start align-middle";
const SELECT_HEAD_CELL = "w-11 px-3 py-3 text-start align-middle";
const SELECT_BODY_CELL = "w-11 px-3 py-3 text-start align-middle";

function formatPhoneCell(phone: string | null): ReactNode {
  if (phone === null || phone.trim().length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span dir="ltr" className="inline-block tabular-nums text-muted-foreground">
      {phone}
    </span>
  );
}

function formatGenderCell(
  gender: OperatorProfileGender | null,
  translate: (key: "gender.male" | "gender.female" | "gender.other") => string
): ReactNode {
  const label = formatOperatorProfileGenderLabel(gender, translate);
  if (label === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="whitespace-nowrap">{label}</span>;
}

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
  const tCommon = useTranslations("common");
  const selectableUsers = users.filter((user) =>
    canManageUserRow(session.role, session.userId, user)
  );
  const allSelectableSelected =
    selectableUsers.length > 0 && selectableUsers.every((user) => selectedUserIds.has(user.userId));

  return (
    <div
      className="hidden overflow-x-auto rounded-xl border md:block"
      data-testid={USERS_DIRECTORY_TEST_IDS.tableDesktop}
    >
      <table className="w-full min-w-[52rem] border-collapse text-sm" data-operator-users-table>
        <thead className="border-b bg-muted/40">
          <tr>
            <th className={SELECT_HEAD_CELL} scope="col">
              <Checkbox
                checked={allSelectableSelected}
                disabled={selectableUsers.length === 0}
                aria-label={t("bulk.selectAll")}
                data-testid={USERS_DIRECTORY_TEST_IDS.rowSelectAll}
                onChange={(event) => onToggleSelectAll(event.target.checked)}
              />
            </th>
            <th className={`${HEAD_CELL} min-w-[9rem]`} scope="col">
              {t("table.name")}
            </th>
            <th className={`${HEAD_CELL} w-[10rem]`} scope="col">
              {t("table.phone")}
            </th>
            <th className={`${HEAD_CELL} w-[6.5rem]`} scope="col">
              {t("table.gender")}
            </th>
            <th className={`${HEAD_CELL} w-[6.5rem]`} scope="col">
              {t("table.role")}
            </th>
            <th className={`${HEAD_CELL} w-[6.5rem]`} scope="col">
              {t("table.status")}
            </th>
            <th className={`${HEAD_CELL} min-w-[7rem]`} scope="col">
              {t("table.badges")}
            </th>
            <th className={`${HEAD_CELL} w-[8.5rem]`} scope="col">
              {t("table.lastActive")}
            </th>
            <th className={`${HEAD_CELL} min-w-[14rem]`} scope="col">
              {t("table.actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const manageable = canManageUserRow(session.role, session.userId, user);
            const canRewards = canEditUserRewards(session.role, session.userId, user);
            const roleOptions = assignableRolesForActor(session.role).filter(
              (role) => role !== user.role
            );
            const isSuspended = user.status === "SUSPENDED";
            const busy = busyUserId === user.userId;

            return (
              <tr key={user.userId} className="border-b last:border-b-0">
                <td className={SELECT_BODY_CELL}>
                  {manageable ? (
                    <Checkbox
                      checked={selectedUserIds.has(user.userId)}
                      disabled={busy}
                      aria-label={t("bulk.selectRow", { name: user.displayName })}
                      data-testid={USERS_DIRECTORY_TEST_IDS.rowSelect}
                      onChange={(event) => onToggleUserSelected(user.userId, event.target.checked)}
                    />
                  ) : null}
                </td>
                <td className={`${BODY_CELL} font-medium`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <UsersDirectoryAvatar user={user} size="sm" />
                    <span className="truncate">{user.displayName}</span>
                  </div>
                </td>
                <td className={BODY_CELL}>{formatPhoneCell(user.phone)}</td>
                <td className={BODY_CELL} data-testid={USERS_DIRECTORY_TEST_IDS.rowGender}>
                  {formatGenderCell(user.gender, tCommon)}
                </td>
                <td className={BODY_CELL}>
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {t(`roles.${user.role}`)}
                  </Badge>
                </td>
                <td className={BODY_CELL}>
                  {isSuspended ? (
                    <Badge
                      variant="destructive"
                      className="whitespace-nowrap"
                      data-testid={USERS_DIRECTORY_TEST_IDS.rowStatusSuspended}
                    >
                      {t("status.suspended")}
                    </Badge>
                  ) : (
                    <span className="whitespace-nowrap text-muted-foreground">
                      {t("status.active")}
                    </span>
                  )}
                </td>
                <td className={BODY_CELL}>
                  <UserMicroBadges user={user} compact />
                </td>
                <td className={`${BODY_CELL} tabular-nums text-muted-foreground`}>
                  {formatUserLastActive(user.lastActiveAt, locale)}
                </td>
                <td className={BODY_CELL}>
                  <div
                    className="flex flex-wrap items-center justify-start gap-1.5"
                    data-testid={manageable ? USERS_DIRECTORY_TEST_IDS.rowActions : undefined}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 whitespace-nowrap"
                      data-testid={USERS_DIRECTORY_TEST_IDS.rowDetails}
                      onClick={() => onOpenDetails(user)}
                    >
                      {t("actions.details")}
                    </Button>
                    {canRewards ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 whitespace-nowrap"
                        disabled={busy}
                        data-testid={USERS_DIRECTORY_TEST_IDS.rowRewards}
                        onClick={() => onOpenRewards(user)}
                      >
                        {t("actions.rewards")}
                      </Button>
                    ) : null}
                    {manageable
                      ? roleOptions.map((role) => (
                          <Button
                            key={role}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 whitespace-nowrap"
                            disabled={busy}
                            data-testid={USERS_DIRECTORY_TEST_IDS.rowRole}
                            onClick={() => onPatchRole(user.userId, role)}
                          >
                            {t("actions.setRole", { role: t(`roles.${role}`) })}
                          </Button>
                        ))
                      : null}
                    {manageable && isSuspended ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 whitespace-nowrap"
                        disabled={busy}
                        data-testid={USERS_DIRECTORY_TEST_IDS.rowReactivate}
                        onClick={() => onReactivate(user.userId)}
                      >
                        {t("actions.reactivate")}
                      </Button>
                    ) : null}
                    {manageable && !isSuspended ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 whitespace-nowrap"
                        disabled={busy}
                        data-testid={USERS_DIRECTORY_TEST_IDS.rowSuspend}
                        onClick={() => onSuspend(user.userId)}
                      >
                        {t("actions.suspend")}
                      </Button>
                    ) : null}
                    {manageable ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-8 whitespace-nowrap"
                        disabled={busy}
                        data-testid={USERS_DIRECTORY_TEST_IDS.rowRemove}
                        onClick={() => onRemove(user.userId)}
                      >
                        {t("actions.remove")}
                      </Button>
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
