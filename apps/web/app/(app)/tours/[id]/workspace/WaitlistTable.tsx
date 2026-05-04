"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useMemo } from "react";

import type { WaitlistItemResponseDto } from "@repo/types";

import { ApiError } from "@/lib/api-client";

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

const FIFO_NON_HEAD_TOOLTIP =
  "Only the earliest waitlisted participant can be converted (FIFO rule).";

function parseCreatedMs(iso: string): number {
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function sortWaitlistOldestFirst(items: WaitlistItemResponseDto[]): WaitlistItemResponseDto[] {
  return [...items].sort((a, b) => {
    const ta = parseCreatedMs(a.createdAt);
    const tb = parseCreatedMs(b.createdAt);
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Oldest `Waiting` row by `created_at` (matches backend FIFO head query). */
function fifoHeadWaitingId(items: WaitlistItemResponseDto[]): string | null {
  const waiting = items.filter((w) => w.status === "Waiting");
  if (waiting.length === 0) return null;
  return waiting.reduce((earliest, w) => {
    const tw = parseCreatedMs(w.createdAt);
    const te = parseCreatedMs(earliest.createdAt);
    if (tw < te) return w;
    if (tw > te) return earliest;
    return w.id < earliest.id ? w : earliest;
  }).id;
}

function convertRowErrorMessage(error: Error | null): string {
  if (!error) return "Conversion failed.";
  if (error instanceof ApiError) {
    if (error.code === "STATE_TRANSITION_INVALID") {
      return error.message.trim() || "This conversion is not allowed.";
    }
    return error.message.trim() || "Conversion failed.";
  }
  return error.message.trim() || "Conversion failed.";
}

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
  const sortedWaitlist = useMemo(() => sortWaitlistOldestFirst(waitlist), [waitlist]);
  const fifoHeadId = useMemo(() => fifoHeadWaitingId(sortedWaitlist), [sortedWaitlist]);

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
        ) : sortedWaitlist.length === 0 ? (
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
                {sortedWaitlist.map((w) => {
                  const isFifoHead =
                    fifoHeadId !== null && w.id === fifoHeadId && w.status === "Waiting";
                  const convertPendingThisRow =
                    convertMutation.isPending && convertMutation.variables === w.id;
                  const convertDisabled =
                    readOnly || w.status !== "Waiting" || !isFifoHead || convertPendingThisRow;
                  const rowErrored =
                    convertMutation.isError &&
                    convertMutation.variables != null &&
                    convertMutation.variables === w.id;

                  return (
                    <tr key={w.id} className={rowErrored ? styles.workspaceRowErrored : undefined}>
                      <th scope="row" className={styles.rowHeader}>
                        <div>{w.participantFullName}</div>
                        <div className={styles.muted}>{w.participantContactPhone}</div>
                      </th>
                      <td>{w.status}</td>
                      <td>
                        {isFifoHead ? (
                          <div className={styles.waitlistConvertStack}>
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              disabled={convertDisabled}
                              onClick={() => {
                                if (readOnly || w.status !== "Waiting" || !isFifoHead) return;
                                if (convertPendingThisRow) return;
                                convertMutation.mutate(w.id);
                              }}
                            >
                              Convert
                            </Button>
                            {rowErrored ? (
                              <span className={styles.waitlistInlineError} role="alert">
                                {convertRowErrorMessage(convertMutation.error)}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span
                            className={styles.muted}
                            title={
                              w.status === "Waiting" && fifoHeadId !== null && w.id !== fifoHeadId
                                ? FIFO_NON_HEAD_TOOLTIP
                                : undefined
                            }
                            aria-label={
                              w.status === "Waiting" && fifoHeadId !== null && w.id !== fifoHeadId
                                ? FIFO_NON_HEAD_TOOLTIP
                                : undefined
                            }
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
