"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { memo } from "react";

import { Badge, TableCell, TableRow } from "@tour/ui";

import type { AuthUser } from "@/lib/auth/auth-context";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import type { UserRole as UserRoleType } from "@/lib/auth/user-role";

import { CopyToClipboardButton } from "./components/copy-to-clipboard-button";
import { UserRowActionsMenu } from "./components/user-row-actions-menu";
import { UserAvatar } from "./user-avatar";
import {
  formatActiveAgoLabelFa,
  formatTripSummaryLabelFa,
  formatWalletBalanceMinor
} from "./users-format";
import { USERS_ROUTE_COPY } from "./users-copy";
import { formatMembershipLabelDisplay, normalizeRole, roleVariant, systemRoleBadgeLabel } from "./users-page-logic";
import styles from "./users-page.module.css";

const copy = USERS_ROUTE_COPY.list;

type UserRowProps = {
  row: WorkspaceUserDto;
  sessionUser: AuthUser | null;
  activeRoleMutationUserId: string | null;
  roleMutation: UseMutationResult<WorkspaceUserDto, unknown, { userId: string; role: UserRoleType }, unknown>;
  onManageRewards?: (_user: WorkspaceUserDto) => void;
  directoryListQueryKey?: readonly unknown[];
  trStyle?: CSSProperties;
  className?: string;
};

function UserRowBase({
  row,
  sessionUser,
  activeRoleMutationUserId,
  roleMutation,
  onManageRewards,
  directoryListQueryKey,
  trStyle,
  className,
}: UserRowProps) {
  const sessionUserId = sessionUser?.userId ?? "";
  const isSelfTarget = row.id === sessionUserId;
  const isOwnerTarget = normalizeRole(row.role) === "owner";
  const email = row.email?.trim() ?? "";
  const hasEmail = email.length > 0;
  const phoneDisplay = row.phone?.trim() ? row.phone.trim() : null;
  const walletLabel = formatWalletBalanceMinor(row.walletBalanceMinor, row.walletCurrency);
  const tripSummaryLabel = formatTripSummaryLabelFa(row.completedTrips, row.cancelledTrips);
  const activityLabel = formatActiveAgoLabelFa(row.lastActiveAt, copy.neverActiveLabel);
  const discountPct = row.permanentDiscountPercentage ?? 0;
  const badges = row.rewardBadges ?? [];
  const hasVip = badges.includes("VIP_MEMBER");
  const hasGold = badges.includes("GOLD_CLUB");
  const labelChips = (row.labels ?? []).filter((l) => l.trim().length > 0);

  return (
    <TableRow className={className} style={trStyle}>
      <TableCell className={styles.userCell}>
        <div className={styles.userProfileStack}>
          <UserAvatar user={row} />
          <div className={styles.userProfileText}>
            <span className={styles.userCellName}>{row.name}</span>
            {hasEmail ? (
              <span className={styles.userCellSecondary}>
                <span className={styles.userCellSecondaryText}>{email}</span>
                <CopyToClipboardButton
                  value={email}
                  ariaLabel={`کپی ایمیل ${row.name}`}
                  successToast={copy.copyEmailSuccessToast}
                />
              </span>
            ) : null}
            {phoneDisplay ? (
              <span className={styles.userCellSecondary}>
                <span className={styles.userCellSecondaryText}>{phoneDisplay}</span>
                <CopyToClipboardButton
                  value={phoneDisplay}
                  ariaLabel={`کپی شماره ${row.name}`}
                  successToast={copy.copyPhoneSuccessToast}
                />
              </span>
            ) : null}
            <span className={styles.userActiveHint}>{activityLabel}</span>
            {labelChips.length > 0 ? (
              <div className={styles.profileLabelChips}>
                {labelChips.map((label) => (
                  <span key={label} className={styles.profileLabelChip}>
                    {formatMembershipLabelDisplay(label)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell className={styles.roleCell}>
        <Badge className={styles.roleBadge} variant={roleVariant(row.role)}>
          {systemRoleBadgeLabel(row.role)}
        </Badge>
      </TableCell>
      <TableCell className={styles.financialsCell}>
        <div className={styles.financialsStack}>
          <span className={styles.walletBalanceLabel}>{walletLabel}</span>
          <span className={styles.tripSummaryLabel}>{tripSummaryLabel}</span>
          <div className={styles.financialsBadgeRow}>
            {discountPct > 0 ? (
              <span className={styles.discountMicroBadge}>
                {copy.discountMicroBadge.replace("{n}", String(discountPct))}
              </span>
            ) : null}
            {hasVip ? (
              <Badge className={`${styles.rewardBadgeHighContrast} ${styles.rewardBadgeVip}`}>
                {copy.vipMicroBadge}
              </Badge>
            ) : null}
            {hasGold ? (
              <Badge className={`${styles.rewardBadgeHighContrast} ${styles.rewardBadgeGold}`}>
                {copy.goldMicroBadge}
              </Badge>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
        <UserRowActionsMenu
          rowId={row.id}
          rowName={row.name}
          rowRole={row.role}
          rowStatus={row.status}
          isSelfTarget={isSelfTarget}
          isOwnerTarget={isOwnerTarget}
          sessionUser={sessionUser}
          activeRoleMutationUserId={activeRoleMutationUserId}
          roleMutation={roleMutation}
          onManageRewards={onManageRewards ? () => onManageRewards(row) : undefined}
          directoryListQueryKey={directoryListQueryKey}
        />
      </TableCell>
    </TableRow>
  );
}

export const UserRow = memo(UserRowBase);
