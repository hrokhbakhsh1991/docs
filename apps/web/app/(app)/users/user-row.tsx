"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { memo } from "react";

import { Badge, Checkbox, TableCell, TableRow } from "@tour/ui";

import type { AuthUser } from "@/lib/auth/auth-context";
import type { WorkspaceUserDto } from "@/lib/services/users.service";

import { normalizeRole, roleLabel, roleVariant } from "./users-page-logic";
import styles from "./users-page.module.css";
import { UserActions } from "./user-actions";

type UserRowProps = {
  row: WorkspaceUserDto;
  sessionUser: AuthUser | null;
  selected: boolean;
  activeRoleMutationUserId: string | null;
  roleMutation: UseMutationResult<WorkspaceUserDto, unknown, { userId: string; role: string }, unknown>;
  onOpenProfile: (userId: string) => void;
  onToggleSelected: (userId: string, checked: boolean) => void;
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

function UserRowBase({
  row,
  sessionUser,
  selected,
  activeRoleMutationUserId,
  roleMutation,
  onOpenProfile,
  onToggleSelected
}: UserRowProps) {
  const sessionUserId = sessionUser?.userId ?? "";
  const rowSelectable = normalizeRole(row.role) !== "owner" && row.id !== sessionUserId;
  const isSelfTarget = row.id === sessionUserId;
  const isOwnerTarget = normalizeRole(row.role) === "owner";

  return (
    <TableRow>
      <TableCell className={styles.selectionCell}>
        <Checkbox
          bare
          aria-label={`Select ${row.name}`}
          checked={selected}
          disabled={!rowSelectable}
          onChange={(event) => onToggleSelected(row.id, event.target.checked)}
        />
      </TableCell>
      <TableCell>{row.name}</TableCell>
      <TableCell>{row.email}</TableCell>
      <TableCell>{row.phone?.trim() ? row.phone : "—"}</TableCell>
      <TableCell>
        <Badge variant={row.isPhoneVerified ? "success" : "neutral"}>
          {row.isPhoneVerified ? "Verified" : "Unverified"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge className={styles.roleBadge} variant={roleVariant(row.role)}>
          {roleLabel(row.role)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
      </TableCell>
      <TableCell>{relativeTimeLabel(row.lastLoginAt)}</TableCell>
      <TableCell>{relativeTimeLabel(row.joinedAt)}</TableCell>
      <TableCell className={styles.actionsCell}>
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
        />
      </TableCell>
    </TableRow>
  );
}

export const UserRow = memo(UserRowBase);
