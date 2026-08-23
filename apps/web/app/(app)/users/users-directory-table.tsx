"use client";

import type { ReactNode } from "react";
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
import {
  collectUserRowMicroBadges,
  resolveLoyaltyTierFromBadges,
} from "@/features/users/users-rewards-logic";

import { UsersDirectoryAvatar } from "./users-directory-avatar";

type UsersDirectoryTableProps = {
  readonly users: readonly UsersDirectoryRow[];
  readonly session: OperatorSessionContext;
  readonly busyUserId: string | null;
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
const COMPACT_BADGE_CLASS = "h-5 px-1.5 text-[10px]";

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

function formatDiscount(user: UsersDirectoryRow, translate: ReturnType<typeof useTranslations>) {
  const discount = user.permanentDiscountPercentage;
  const loyaltyTier = resolveLoyaltyTierFromBadges(user.rewardBadges);
  const extraBadges = collectUserRowMicroBadges(user).filter(
    (badge) => badge.kind !== "discount" && badge.kind !== "loyalty"
  );
  const hasDiscount = discount !== null && discount !== undefined && discount > 0;
  const hasBenefits = hasDiscount || loyaltyTier !== "none" || extraBadges.length > 0;

  if (!hasBenefits) {
    return <span className="text-muted-foreground">{translate("benefits.none")}</span>;
  }

  return (
    <div className="space-y-1.5">
      {hasDiscount ? (
        <p className="font-medium leading-5">{translate("benefits.discountValue", { value: discount })}</p>
      ) : null}
      {loyaltyTier !== "none" ? (
        <p className="text-xs font-medium leading-4 text-muted-foreground">
          {loyaltyTier === "VIP_MEMBER"
            ? translate("rewards.loyaltyVip")
            : translate("rewards.loyaltyGold")}
        </p>
      ) : null}
      {extraBadges.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {extraBadges.map((badge, index) => {
            if (badge.kind === "label") {
              return (
                <Badge key={`label-${badge.text}-${index}`} variant="secondary" className={COMPACT_BADGE_CLASS}>
                  {badge.text}
                </Badge>
              );
            }
            if (badge.kind === "selectableLeader") {
              return (
                <Badge key={`leader-${index}`} variant="outline" className={COMPACT_BADGE_CLASS}>
                  {translate("rewards.rowLeaderBadge")}
                </Badge>
              );
            }
            return (
              <Badge key={`leader-buddy-${index}`} variant="outline" className={COMPACT_BADGE_CLASS}>
                {translate("rewards.leaderBuddyBadge")}
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function UsersDirectoryTable({
  users,
  session,
  busyUserId,
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
    selectableUsers.length > 0 && selectableUsers.every((user) => selectedUserIds.has(user.userId));

  return (
    <div
      className="hidden overflow-x-auto rounded-xl border bg-card/40 xl:block"
      data-testid={USERS_DIRECTORY_TEST_IDS.tableDesktop}
    >
      <table className="w-full min-w-[44rem] border-collapse text-sm" data-operator-users-table>
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
            <th
              className={`${HEAD_CELL} min-w-[16rem]`}
              scope="col"
              data-testid={USERS_DIRECTORY_TEST_IDS.tableMemberHeader}
            >
              {t("table.member")}
            </th>
            <th
              className={`${HEAD_CELL} w-[12rem]`}
              scope="col"
              data-testid={USERS_DIRECTORY_TEST_IDS.tableAccessHeader}
            >
              {t("table.access")}
            </th>
            <th
              className={`${HEAD_CELL} min-w-[12rem]`}
              scope="col"
              data-testid={USERS_DIRECTORY_TEST_IDS.tableBenefitsHeader}
            >
              {t("table.benefits")}
            </th>
            <th
              className={`${HEAD_CELL} w-[9rem]`}
              scope="col"
              data-testid={USERS_DIRECTORY_TEST_IDS.tableActionHeader}
            >
              {t("table.action")}
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const manageable = canManageUserRow(session.role, session.userId, user);
            const isSuspended = user.status === "SUSPENDED";
            const busy = busyUserId === user.userId;

            return (
              <tr
                key={user.userId}
                className="border-b transition-colors hover:bg-muted/30 focus-within:bg-muted/30 last:border-b-0"
              >
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
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate leading-5">{user.displayName}</p>
                      <p className="truncate text-sm font-normal leading-4 text-muted-foreground">
                        {formatPhoneCell(user.phone)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={BODY_CELL}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={user.role === "owner" ? "default" : "secondary"}
                      className={COMPACT_BADGE_CLASS}
                    >
                      {t(`roles.${user.role}`)}
                    </Badge>
                    {isSuspended ? (
                      <Badge
                        variant="destructive"
                        className={COMPACT_BADGE_CLASS}
                        data-testid={USERS_DIRECTORY_TEST_IDS.rowStatusSuspended}
                      >
                        {t("status.suspended")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={COMPACT_BADGE_CLASS}>
                        {t("status.active")}
                      </Badge>
                    )}
                    {user.role === "owner" ? (
                      <span className="text-xs text-muted-foreground">
                        {t("owner.protectedShort")}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className={BODY_CELL}>
                  {formatDiscount(user, t)}
                </td>
                <td className={BODY_CELL}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 whitespace-nowrap"
                    disabled={busy}
                    data-testid={USERS_DIRECTORY_TEST_IDS.rowDetails}
                    onClick={() => onOpenDetails(user)}
                  >
                    {t("actions.openMember")}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
