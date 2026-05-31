"use client";

import { EmptyState } from "@tour/ui";

import type { PendingWorkspaceInviteDto } from "@/lib/services/users.service";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";

import { getInviteDisplayNote } from "../invite-name-notes";
import { formatInviteExpiresLabelFa } from "../users-format";
import { inviteRoleLabelFa } from "../users-page-logic";
import { USERS_ROUTE_COPY } from "../users-copy";
import { PendingInviteActionsMenu } from "./pending-invite-actions-menu";
import styles from "../users-page.module.css";

const copy = USERS_ROUTE_COPY.list;

type PendingInvitesTableProps = {
  rows: PendingWorkspaceInviteDto[];
  isLoading: boolean;
  isError: boolean;
  onRefresh?: () => void | Promise<void>;
};

export function PendingInvitesTable({
  rows,
  isLoading,
  isError,
  onRefresh
}: PendingInvitesTableProps): JSX.Element {
  const tenantId = useWorkspaceQueryScope() ?? "";
  if (isLoading) {
    return <p className={styles.pendingInvitesPlaceholder}>{copy.pendingLoading}</p>;
  }
  if (isError) {
    return <p className={styles.pendingInvitesPlaceholder}>{copy.pendingLoadError}</p>;
  }
  if (rows.length === 0) {
    return (
      <EmptyState title={copy.pendingEmptyTitle} description={copy.pendingEmptyDescription} />
    );
  }

  return (
    <div className={styles.pendingInvitesWrap} dir="rtl">
      <table className={styles.pendingInvitesTable} aria-label={copy.pendingInvitesTableAria}>
        <thead>
          <tr>
            <th scope="col">{copy.pendingColumnPhoneNote}</th>
            <th scope="col">{copy.pendingColumnRole}</th>
            <th scope="col">{copy.pendingColumnExpires}</th>
            <th scope="col" className={styles.pendingInvitesActionsHead}>
              {copy.columnActions}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const note = tenantId ? getInviteDisplayNote(tenantId, row.inviteId, row.phone) : null;
            return (
              <tr key={row.inviteId}>
                <td>
                  <div className={styles.pendingPhoneCell}>
                    <span className={styles.pendingPhonePrimary}>{row.phone}</span>
                    {note ? <span className={styles.pendingPhoneNote}>{note}</span> : null}
                  </div>
                </td>
                <td>
                  <span className={styles.pendingRoleBadge}>{inviteRoleLabelFa(row.role)}</span>
                </td>
                <td>{formatInviteExpiresLabelFa(row.expiresAt)}</td>
                <td className={styles.pendingInvitesActionsCell}>
                  <PendingInviteActionsMenu row={row} onActionSettled={onRefresh} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
