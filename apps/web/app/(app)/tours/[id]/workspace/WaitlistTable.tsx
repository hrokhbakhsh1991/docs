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

import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";
import styles from "./tour-workspace.module.css";

const copy = TOUR_WORKSPACE_COPY.waitlist;

function waitlistStatusFa(status: WaitlistItemResponseDto["status"]): string {
  switch (status) {
    case "Waiting":
      return "در انتظار";
    case "Converted":
      return "تبدیل‌شده";
    case "Cancelled":
      return "لغو شده";
    default:
      return status;
  }
}

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
  if (!error) return copy.convertFailed;
  if (error instanceof ApiError) {
    if (error.code === "STATE_TRANSITION_INVALID") {
      return error.message.trim() || copy.notAllowed;
    }
    return error.message.trim() || copy.convertFailed;
  }
  return error.message.trim() || copy.convertFailed;
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
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <LoadingState message={copy.loading} />
        ) : isError ? (
          <ErrorState title={copy.loadErrorTitle} onRetry={onRetry} />
        ) : sortedWaitlist.length === 0 ? (
          <EmptyState embedded title={copy.emptyTitle} description={copy.emptyDescription} />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label={copy.title}>
              <thead>
                <tr>
                  <th scope="col">{copy.colParticipant}</th>
                  <th scope="col">{copy.colStatus}</th>
                  <th scope="col">{copy.colConvert}</th>
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
                      <td>{waitlistStatusFa(w.status)}</td>
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
                              {convertPendingThisRow ? copy.converting : copy.convert}
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
                                ? copy.fifoTooltip
                                : undefined
                            }
                            aria-label={
                              w.status === "Waiting" && fifoHeadId !== null && w.id !== fifoHeadId
                                ? copy.fifoTooltip
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
