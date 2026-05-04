"use client";

import type { UseMutationResult } from "@tanstack/react-query";

import type { WaitlistItemResponseDto } from "@repo/types";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@tour/ui";

import styles from "./tour-workspace.module.css";

export type WaitlistTableProps = {
  waitlist: WaitlistItemResponseDto[];
  readOnly: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  convertMutation: UseMutationResult<WaitlistItemResponseDto, Error, string>;
};

export function WaitlistTable({
  waitlist,
  readOnly,
  isLoading,
  isError,
  onRetry,
  convertMutation,
}: WaitlistTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waitlist (J‑L‑03)</CardTitle>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <LoadingState message="Loading waitlist…" />
        ) : isError ? (
          <ErrorState title="Could not load waitlist" onRetry={onRetry} />
        ) : waitlist.length === 0 ? (
          <EmptyState
            embedded
            title="No waitlist entries yet"
            description="When the tour is full, new sign-ups may appear here as waitlisted participants."
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="Tour waitlist">
              <thead>
                <tr>
                  <th scope="col">Participant</th>
                  <th scope="col">Status</th>
                  <th scope="col">Convert</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((w) => (
                  <tr key={w.id}>
                    <th scope="row" className={styles.rowHeader}>
                      <div>{w.participantFullName}</div>
                      <div className={styles.muted}>{w.participantContactPhone}</div>
                    </th>
                    <td>{w.status}</td>
                    <td>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={
                          readOnly || w.status !== "Waiting" || convertMutation.isPending
                        }
                        onClick={() => convertMutation.mutate(w.id)}
                      >
                        Convert
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
