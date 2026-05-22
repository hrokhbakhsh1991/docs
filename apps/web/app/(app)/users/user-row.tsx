"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import type { CSSProperties, MouseEvent } from "react";
import { memo } from "react";

import { Badge, Checkbox, TableCell, TableRow } from "@tour/ui";

import type { AuthUser } from "@/lib/auth/auth-context";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import type { UserRole as UserRoleType } from "@/lib/auth/user-role";

import { UserRowActionsMenu } from "./components/user-row-actions-menu";
import { UserAvatar } from "./user-avatar";
import { formatActiveAgoLabel, formatWalletBalanceMinor } from "./users-format";
import { normalizeRole, roleLabel, roleVariant } from "./users-page-logic";
import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";

const copy = USERS_ROUTE_COPY.list;

type UserRowProps = {
  row: WorkspaceUserDto;
  sessionUser: AuthUser | null;
  selected: boolean;
  activeRoleMutationUserId: string | null;
  roleMutation: UseMutationResult<WorkspaceUserDto, unknown, { userId: string; role: UserRoleType }, unknown>;
  onOpenProfile: (userId: string) => void;
  onToggleSelected: (userId: string, checked: boolean) => void;
  onManageRewards?: (user: WorkspaceUserDto) => void;
  trStyle?: CSSProperties;
  className?: string;
};

function TelegramLinkedGlyph() {
  return (
    <svg
      className={styles.telegramLinkedIcon}
      width={14}
      height={14}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M21.5 4.5 3.5 11.2c-1 .4-1 1-.2 1.3l4.6 1.4 1.8 5.7c.2.6.5.7.9.4l2.5-1.8 5.3 3.9c.6.3 1 .2 1.2-.5l3.5-16.5c.2-1-.4-1.6-1.2-1.2ZM8.1 14.3l10.5-6.5c.5-.3.9-.1.5.4l-8.6 7.8-.3 3.2-2.1-5Z"
      />
    </svg>
  );
}

function PhoneVerifiedGlyph({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return (
    <span
      className={styles.phoneVerifiedIcon}
      role="img"
      aria-label={copy.phoneVerifiedAria}
      title={copy.phoneVerifiedAria}
    >
      <svg width={12} height={12} viewBox="0 0 24 24" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M9.55 16.45 5.1 12l1.4-1.41 3.05 3.05 7.05-7.05 1.41 1.41-8.46 8.45Z"
        />
      </svg>
    </span>
  );
}

const LOYALTY_CLUB_BADGES = new Set(["VIP_MEMBER", "GOLD_CLUB"]);

function UserRowBase({
  row,
  sessionUser,
  selected,
  activeRoleMutationUserId,
  roleMutation,
  onOpenProfile,
  onToggleSelected,
  onManageRewards,
  trStyle,
  className,
}: UserRowProps) {
  const sessionUserId = sessionUser?.userId ?? "";
  const rowSelectable = normalizeRole(row.role) !== "owner" && row.id !== sessionUserId;
  const isSelfTarget = row.id === sessionUserId;
  const isOwnerTarget = normalizeRole(row.role) === "owner";
  const phoneDisplay = row.phone?.trim() ? row.phone.trim() : null;
  const hasDiscount =
    row.permanentDiscountPercentage !== undefined && row.permanentDiscountPercentage !== null;
  const clubBadges = (row.rewardBadges ?? []).filter((b) => LOYALTY_CLUB_BADGES.has(b));
  const walletLabel = formatWalletBalanceMinor(row.walletBalanceMinor, row.walletCurrency);
  const activeLabel =
    formatActiveAgoLabel(row.lastActiveAt ?? row.lastLoginAt) ?? copy.neverActiveLabel;
  const hasFinancials = walletLabel !== "0 IRR" || hasDiscount || clubBadges.length > 0;

  function handleRowPointerDown(event: MouseEvent<HTMLTableRowElement>) {
    const el = event.target as HTMLElement | null;
    if (!el) return;
    if (el.closest("button, a, input, select, textarea, label, [data-skip-row-open='true']")) {
      return;
    }
    onOpenProfile(row.id);
  }

  return (
    <TableRow
      className={[styles.clickableRow, className].filter(Boolean).join(" ")}
      style={trStyle}
      onClick={handleRowPointerDown}
    >
      <TableCell className={styles.selectionCell} onClick={(e) => e.stopPropagation()}>
        <Checkbox
          bare
          aria-label={`Select ${row.name}`}
          checked={selected}
          disabled={!rowSelectable}
          onChange={(event) => onToggleSelected(row.id, event.target.checked)}
        />
      </TableCell>
      <TableCell className={styles.userCell}>
        <div className={styles.userProfileStack}>
          <UserAvatar user={row} />
          <div className={styles.userProfileText}>
            <div className={styles.userCellPrimary}>
              <span className={styles.userCellName}>{row.name}</span>
              {row.telegramLinked ? (
                <span role="img" aria-label={copy.telegramLinkedAria} title={copy.telegramLinkedAria}>
                  <TelegramLinkedGlyph />
                </span>
              ) : null}
            </div>
            <div className={styles.userCellSecondary}>{row.email}</div>
            <div className={styles.userCellSecondary}>
              {phoneDisplay ? (
                <>
                  <span className={styles.userCellPhone}>{phoneDisplay}</span>
                  <PhoneVerifiedGlyph verified={Boolean(row.isPhoneVerified)} />
                </>
              ) : (
                <span className={styles.userCellMuted}>—</span>
              )}
            </div>
            <div className={styles.userActiveHint}>{activeLabel}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className={styles.roleCell}>
        <Badge className={styles.roleBadge} variant={roleVariant(row.role)}>
          {roleLabel(row.role)}
        </Badge>
      </TableCell>
      <TableCell className={styles.financialsCell}>
        {hasFinancials ? (
          <div className={styles.financialsTags}>
            <span className={styles.walletBalanceLabel}>{walletLabel}</span>
            {hasDiscount ? (
              <Badge variant="neutral" className={styles.privilegeDiscountTag}>
                {row.permanentDiscountPercentage}%
              </Badge>
            ) : null}
            {clubBadges.map((badge) => (
              <Badge key={badge} variant="neutral" className={styles.rewardBadgeHighContrast}>
                {badge.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        ) : (
          <span className={styles.walletBalanceLabel}>{walletLabel}</span>
        )}
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
        />
      </TableCell>
    </TableRow>
  );
}

export const UserRow = memo(UserRowBase);
