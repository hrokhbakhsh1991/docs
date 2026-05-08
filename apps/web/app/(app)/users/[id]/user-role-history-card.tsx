"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, LoadingState, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@tour/ui";

import { userKeys } from "@/lib/query-keys";
import { getUserRoleHistory } from "@/lib/services/users.service";

import styles from "./user-detail.module.css";
import { USERS_ROUTE_COPY } from "../users-copy";

type UserRoleHistoryCardProps = {
  userId: string;
  tenantScope: string;
  enabled: boolean;
};
const copy = USERS_ROUTE_COPY.detail;

function relativeTimeLabel(input: string): string {
  const target = new Date(input);
  if (Number.isNaN(target.getTime())) return copy.roleHistoryJustNow;
  const seconds = Math.max(1, Math.floor((Date.now() - target.getTime()) / 1000));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return formatter.format(-seconds, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  return formatter.format(-days, "day");
}

export function UserRoleHistoryCard({ userId, tenantScope, enabled }: UserRoleHistoryCardProps) {
  const { data = [], isPending, isError, error, refetch } = useQuery({
    queryKey: userKeys.roleHistory(tenantScope, userId),
    queryFn: () => getUserRoleHistory(userId),
    enabled,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.roleHistoryTitle}</CardTitle>
      </CardHeader>
      <CardBody>
        {isPending ? (
          <LoadingState message={copy.roleHistoryLoading} />
        ) : isError ? (
          <ErrorState
            title={copy.roleHistoryLoadErrorTitle}
            message={error instanceof Error ? error.message : copy.roleHistoryLoadErrorFallback}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState title={copy.roleHistoryEmptyTitle} description={copy.roleHistoryEmptyDescription} />
        ) : (
          <Table aria-label={copy.roleHistoryTableAriaLabel}>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{copy.roleHistoryColumnActor}</TableHeaderCell>
                <TableHeaderCell>{copy.roleHistoryColumnOldRole}</TableHeaderCell>
                <TableHeaderCell>{copy.roleHistoryColumnNewRole}</TableHeaderCell>
                <TableHeaderCell>{copy.roleHistoryColumnTime}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={`${item.actorUserId}-${item.createdAt}-${index}`}>
                  <TableCell>
                    <div className={styles.historyActor}>
                      <span>{item.actorEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>{item.oldRole}</TableCell>
                  <TableCell>{item.newRole}</TableCell>
                  <TableCell>
                    <time dateTime={item.createdAt}>{relativeTimeLabel(item.createdAt)}</time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
