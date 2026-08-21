"use client";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  USERS_DIRECTORY_TEST_IDS,
  type InvitableWorkspaceRole,
  type UsersDirectoryRow,
} from "@/features/users/users-directory-types";
import {
  assignableRolesForActor,
  canEditUserRewards,
  canManageUserRow,
} from "@/features/users/users-page-logic";
import { collectUserRowMicroBadges } from "@/features/users/users-rewards-logic";
import { formatOperatorProfileGenderLabel } from "@/features/operator-profile/gender";

import { UserMicroBadges } from "./users-directory-user-micro-badges";
import { UsersDirectoryAvatar } from "./users-directory-avatar";

type UsersDirectoryRowActionsSheetProps = {
  readonly user: UsersDirectoryRow | null;
  readonly session: OperatorSessionContext;
  readonly busy: boolean;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPatchRole: (role: InvitableWorkspaceRole) => void;
  readonly onRemove: () => void;
  readonly onSuspend: () => void;
  readonly onReactivate: () => void;
  readonly onOpenRewards: () => void;
  readonly onOpenDetails: () => void;
};

export function UsersDirectoryRowActionsSheet({
  user,
  session,
  busy,
  open,
  onOpenChange,
  onPatchRole,
  onRemove,
  onSuspend,
  onReactivate,
  onOpenRewards,
  onOpenDetails,
}: UsersDirectoryRowActionsSheetProps) {
  const t = useTranslations("users");
  if (user === null) {
    return null;
  }

  const manageable = canManageUserRow(session.role, session.userId, user);
  const canRewards = canEditUserRewards(session.role, session.userId, user);
  const roleOptions = assignableRolesForActor(session.role).filter((role) => role !== user.role);
  const isSuspended = user.status === "SUSPENDED";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-xl"
        data-testid={USERS_DIRECTORY_TEST_IDS.rowActionsSheet}
      >
        <SheetHeader>
          <SheetTitle>{user.displayName}</SheetTitle>
          <SheetDescription>{user.phone ?? "—"}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <UserMicroBadges user={user} />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            data-testid={USERS_DIRECTORY_TEST_IDS.rowDetails}
            onClick={() => {
              onOpenDetails();
              onOpenChange(false);
            }}
          >
            {t("actions.details")}
          </Button>
          {canRewards ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              data-testid={USERS_DIRECTORY_TEST_IDS.rowRewards}
              onClick={() => {
                onOpenRewards();
                onOpenChange(false);
              }}
            >
              {t("actions.rewards")}
            </Button>
          ) : null}
          {manageable ? (
            <div className="flex flex-col gap-2" data-testid={USERS_DIRECTORY_TEST_IDS.rowActions}>
              {roleOptions.map((role) => (
                <Button
                  key={role}
                  type="button"
                  variant="outline"
                  disabled={busy}
                  data-testid={USERS_DIRECTORY_TEST_IDS.rowRole}
                  onClick={() => {
                    onPatchRole(role);
                    onOpenChange(false);
                  }}
                >
                  {t("actions.setRole", { role: t(`roles.${role}`) })}
                </Button>
              ))}
              {isSuspended ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  data-testid={USERS_DIRECTORY_TEST_IDS.rowReactivate}
                  onClick={() => {
                    onReactivate();
                    onOpenChange(false);
                  }}
                >
                  {t("actions.reactivate")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  data-testid={USERS_DIRECTORY_TEST_IDS.rowSuspend}
                  onClick={() => {
                    onSuspend();
                    onOpenChange(false);
                  }}
                >
                  {t("actions.suspend")}
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                data-testid={USERS_DIRECTORY_TEST_IDS.rowRemove}
                onClick={() => {
                  onRemove();
                  onOpenChange(false);
                }}
              >
                {t("actions.remove")}
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

type UsersDirectoryMobileCardProps = {
  readonly user: UsersDirectoryRow;
  readonly session: OperatorSessionContext;
  readonly busy: boolean;
  readonly selected: boolean;
  readonly onToggleSelected: (selected: boolean) => void;
  readonly onOpenActions: () => void;
  readonly onOpenDetails: () => void;
};

export function UsersDirectoryMobileCard({
  user,
  session,
  busy,
  selected,
  onToggleSelected,
  onOpenActions,
  onOpenDetails,
}: UsersDirectoryMobileCardProps) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const manageable = canManageUserRow(session.role, session.userId, user);
  const canRewards = canEditUserRewards(session.role, session.userId, user);
  const isSuspended = user.status === "SUSPENDED";
  const microBadges = collectUserRowMicroBadges(user);
  const genderLabel = formatOperatorProfileGenderLabel(user.gender, tCommon);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        {manageable ? (
          <Checkbox
            checked={selected}
            disabled={busy}
            aria-label={t("bulk.selectRow", { name: user.displayName })}
            data-testid={USERS_DIRECTORY_TEST_IDS.rowSelect}
            onChange={(event) => onToggleSelected(event.target.checked)}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <UsersDirectoryAvatar user={user} size="md" />
            <div className="min-w-0">
              <p className="truncate font-medium">{user.displayName}</p>
              <p className="truncate text-sm text-muted-foreground">{user.phone ?? "—"}</p>
              {genderLabel !== null ? (
                <p
                  className="truncate text-sm text-muted-foreground"
                  data-testid={USERS_DIRECTORY_TEST_IDS.rowGender}
                >
                  {genderLabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary">{t(`roles.${user.role}`)}</Badge>
          {isSuspended ? (
            <Badge variant="destructive" data-testid={USERS_DIRECTORY_TEST_IDS.rowStatusSuspended}>
              {t("status.suspended")}
            </Badge>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            data-testid={USERS_DIRECTORY_TEST_IDS.rowDetails}
            onClick={onOpenDetails}
          >
            {t("actions.details")}
          </Button>
          {manageable || canRewards ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={busy}
              aria-label={t("actions.openRowMenu")}
              data-testid={USERS_DIRECTORY_TEST_IDS.rowActionsMenu}
              onClick={onOpenActions}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
      {microBadges.length > 0 ? (
        <div className="mt-3">
          <UserMicroBadges user={user} />
        </div>
      ) : null}
    </div>
  );
}
