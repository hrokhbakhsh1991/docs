"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import type { CSSProperties, MouseEvent } from "react";
import { memo } from "react";

import { Badge, Checkbox, TableCell, TableRow } from "@tour/ui";

import type { AuthUser } from "@/lib/auth/auth-context";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";

import { normalizeRole, roleLabel, roleVariant, formatMembershipLabelDisplay } from "./users-page-logic";
import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";
import { UserActions } from "./user-actions";

const copy = USERS_ROUTE_COPY.list;

type UserRowProps = {
  row: WorkspaceUserDto;
  sessionUser: AuthUser | null;
  selected: boolean;
  activeRoleMutationUserId: string | null;
  roleMutation: UseMutationResult<WorkspaceUserDto, unknown, { userId: string; role: UserRole }, unknown>;
  onOpenProfile: (userId: string) => void;
  onToggleSelected: (userId: string, checked: boolean) => void;
  onManageRewards?: (user: WorkspaceUserDto) => void;
  /** Optional layout for virtualized rows (absolute positioning / height). */
  trStyle?: CSSProperties;
  className?: string;
};

function statusBadgeVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  const normalized = status.trim().toUpperCase();
  if (normalized === "ACTIVE") return "success";
  if (normalized === "INVITED") return "warning";
  if (normalized === "SUSPENDED") return "danger";
  return "neutral";
}

function relativeTimeLabel(value?: string | null): string {
  if (!value) return "—";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "—";
  const seconds = Math.max(1, Math.floor((Date.now() - target.getTime()) / 1000));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return formatter.format(-seconds, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return formatter.format(-days, "day");
  const months = Math.floor(days / 30);
  if (months < 12) return formatter.format(-months, "month");
  const years = Math.floor(months / 12);
  return formatter.format(-years, "year");
}

function TelegramLinkedGlyph() {
  return (
    <svg
      className={styles.telegramLinkedIcon}
      width={18}
      height={18}
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
  className
}: UserRowProps) {
  const sessionUserId = sessionUser?.userId ?? "";
  const rowSelectable = normalizeRole(row.role) !== "owner" && row.id !== sessionUserId;
  const isSelfTarget = row.id === sessionUserId;
  const isOwnerTarget = normalizeRole(row.role) === "owner";

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
      <TableCell>
        <span className={styles.nameWithTelegram}>
          <span>{row.name}</span>
          {row.telegramLinked ? (
            <span role="img" aria-label={copy.telegramLinkedAria} title={copy.telegramLinkedAria}>
              <TelegramLinkedGlyph />
            </span>
          ) : null}
        </span>
      </TableCell>
      <TableCell>{row.email}</TableCell>
      <TableCell>{row.phone?.trim() ? row.phone : "—"}</TableCell>
      <TableCell>
        <Badge variant={row.isPhoneVerified ? "success" : "neutral"}>
          {row.isPhoneVerified ? "Verified" : "Unverified"}
        </Badge>
      </TableCell>
      <TableCell className={styles.labelsCell}>
        {row.labels && row.labels.length > 0 ? (
          <div className={styles.labelBadges}>
            {row.labels.map((label) => (
              <Badge key={label} variant="neutral">
                {formatMembershipLabelDisplay(label)}
              </Badge>
            ))}
          </div>
        ) : (
          copy.emptyLabelsCell
        )}
      </TableCell>
      <TableCell>
        <Badge className={styles.roleBadge} variant={roleVariant(row.role)}>
          {roleLabel(row.role)}
        </Badge>
      </TableCell>
      <TableCell className={styles.discountCell}>
        {row.permanentDiscountPercentage !== undefined && row.permanentDiscountPercentage !== null
          ? `${row.permanentDiscountPercentage}%`
          : copy.emptyDiscountCell}
      </TableCell>
      <TableCell className={styles.labelsCell}>
        {row.rewardBadges && row.rewardBadges.length > 0 ? (
          <div className={styles.labelBadges}>
            {row.rewardBadges.map((badge) => (
              <Badge key={badge} variant="neutral" className={styles.rewardBadgeHighContrast}>
                {badge.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        ) : (
          copy.emptyRewardBadgesCell
        )}
      </TableCell>
      <TableCell>
        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
      </TableCell>
      <TableCell>{relativeTimeLabel(row.lastLoginAt)}</TableCell>
      <TableCell>{relativeTimeLabel(row.joinedAt)}</TableCell>
      <TableCell className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
        <UserActions
          rowId={row.id}
          rowName={row.name}
          rowRole={row.role}
          rowStatus={row.status}
          isSelfTarget={isSelfTarget}
          isOwnerTarget={isOwnerTarget}
          sessionUser={sessionUser}
          activeRoleMutationUserId={activeRoleMutationUserId}
          roleMutation={roleMutation}
          onOpenProfile={() => onOpenProfile(row.id)}
          onManageRewards={onManageRewards ? () => onManageRewards(row) : undefined}
        />
      </TableCell>
    </TableRow>
  );
}

export const UserRow = memo(UserRowBase);
