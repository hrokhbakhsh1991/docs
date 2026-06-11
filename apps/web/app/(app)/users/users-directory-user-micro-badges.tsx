"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { USERS_DIRECTORY_TEST_IDS, type UsersDirectoryRow } from "@/features/users/users-directory-types";
import { collectUserRowMicroBadges } from "@/features/users/users-rewards-logic";

type UserMicroBadgesProps = {
  readonly user: UsersDirectoryRow;
  readonly compact?: boolean;
};

export function UserMicroBadges({ user, compact = false }: UserMicroBadgesProps) {
  const t = useTranslations("users");
  const microBadges = collectUserRowMicroBadges(user);
  if (microBadges.length === 0) {
    return compact ? <span className="text-muted-foreground">—</span> : null;
  }

  return (
    <div
      className={compact ? "flex flex-wrap gap-1" : "flex flex-wrap gap-1.5"}
      data-testid={USERS_DIRECTORY_TEST_IDS.rowMicroBadges}
    >
      {microBadges.map((badge, index) => {
        if (badge.kind === "discount") {
          return (
            <Badge key={`discount-${index}`} variant="outline">
              {badge.value}%
            </Badge>
          );
        }
        if (badge.kind === "loyalty") {
          return (
            <Badge key={`loyalty-${badge.badgeId}`} variant="outline">
              {badge.badgeId === "VIP_MEMBER" ? t("rewards.loyaltyVip") : t("rewards.loyaltyGold")}
            </Badge>
          );
        }
        if (badge.kind === "label") {
          return (
            <Badge key={`label-${badge.text}-${index}`} variant="secondary">
              {badge.text}
            </Badge>
          );
        }
        if (badge.kind === "selectableLeader") {
          return (
            <Badge key={`leader-${index}`} variant="outline">
              {t("rewards.rowLeaderBadge")}
            </Badge>
          );
        }
        return (
          <Badge key={`leader-buddy-${index}`} variant="outline">
            {t("rewards.leaderBuddyBadge")}
          </Badge>
        );
      })}
    </div>
  );
}
