"use client";

import { formatIranMobileForDisplay } from "@app-tour/iran-mobile";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { useTranslations } from "next-intl";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  USERS_DIRECTORY_TEST_IDS,
  type UsersDirectoryRow,
} from "@/features/users/users-directory-types";
import { canManageUserRow } from "@/features/users/users-page-logic";
import { collectUserRowMicroBadges } from "@/features/users/users-rewards-logic";

import { UserMicroBadges } from "./users-directory-user-micro-badges";
import { UsersDirectoryAvatar } from "./users-directory-avatar";

type UsersDirectoryMobileCardProps = {
  readonly user: UsersDirectoryRow;
  readonly session: OperatorSessionContext;
  readonly busy: boolean;
  readonly selected: boolean;
  readonly onToggleSelected: (selected: boolean) => void;
  readonly onOpenDetails: () => void;
};

export function UsersDirectoryMobileCard({
  user,
  session,
  busy,
  selected,
  onToggleSelected,
  onOpenDetails,
}: UsersDirectoryMobileCardProps) {
  const t = useTranslations("users");
  const manageable = canManageUserRow(session.role, session.userId, user);
  const isSuspended = user.status === "SUSPENDED";
  const microBadges = collectUserRowMicroBadges(user);

  return (
    <div
      className="rounded-xl border bg-card p-4 shadow-sm"
      data-testid={USERS_DIRECTORY_TEST_IDS.memberCard}
    >
      <div className="flex items-start gap-3">
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
              <p className="break-words font-medium leading-6">{user.displayName}</p>
              <p className="truncate text-sm text-muted-foreground">
                {user.phone ? formatIranMobileForDisplay(user.phone) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={user.role === "owner" ? "default" : "secondary"}>
          {t(`roles.${user.role}`)}
        </Badge>
        {isSuspended ? (
          <Badge variant="destructive" data-testid={USERS_DIRECTORY_TEST_IDS.rowStatusSuspended}>
            {t("status.suspended")}
          </Badge>
        ) : (
          <Badge variant="outline">{t("status.active")}</Badge>
        )}
      </div>
      {microBadges.length > 0 ? (
        <div className="mt-3">
          <UserMicroBadges user={user} />
        </div>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3 w-full"
        disabled={busy}
        data-testid={USERS_DIRECTORY_TEST_IDS.rowDetails}
        onClick={onOpenDetails}
      >
        {t("actions.openMember")}
      </Button>
    </div>
  );
}
