"use client";

import Link from "next/link";

import workspaceStyles from "../../../tours/[id]/workspace/tour-workspace.module.css";
import styles from "./ReviewTable.module.css";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/badges";
import type { LeaderRegistrationRow } from "@/lib/hooks/useLeaderTourRegistrations";

import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Input, Select } from "@tour/ui";

export type ReviewTableProps = {
  rows: LeaderRegistrationRow[];
  amountDraft: Record<string, string>;
  statusPendingRowId: string | null;
  paymentPendingRowId: string | null;
  statusFor: (row: LeaderRegistrationRow) => RegistrationStatus;
  paymentFor: (row: LeaderRegistrationRow) => RegistrationPaymentStatus;
  canQuickTransition: (row: LeaderRegistrationRow, target: RegistrationStatus) => boolean;
  registrationStatusOptions: (row: LeaderRegistrationRow) => RegistrationStatus[];
  paymentStatusOptions: (row: LeaderRegistrationRow) => RegistrationPaymentStatus[];
  paymentSaveIsNoOpForRow: (row: LeaderRegistrationRow) => boolean;
  isTerminalBookingState: (status: RegistrationStatus) => boolean;
  isTerminalPaymentStateForRow: (row: LeaderRegistrationRow) => boolean;
  statusMutationIsErrorForRow: (id: string) => boolean;
  paymentMutationIsErrorForRow: (id: string) => boolean;
  statusMutationErrorMessage: string | null;
  paymentMutationErrorMessage: string | null;
  onStatusDraftChange: (id: string, next: RegistrationStatus) => void;
  onPayDraftChange: (id: string, next: RegistrationPaymentStatus) => void;
  onAmountDraftChange: (id: string, next: string) => void;
  onApplyStatus: (id: string, target: RegistrationStatus) => void;
  onSavePayment: (id: string, nextStatus: RegistrationPaymentStatus, rawAmount: string) => void;
  onInspectRow: (id: string) => void;
  reviewableTargets: readonly RegistrationStatus[];
};

export function ReviewTable({
  rows,
  amountDraft,
  statusPendingRowId,
  paymentPendingRowId,
  statusFor,
  paymentFor,
  canQuickTransition,
  registrationStatusOptions,
  paymentStatusOptions,
  paymentSaveIsNoOpForRow,
  isTerminalBookingState,
  isTerminalPaymentStateForRow,
  statusMutationIsErrorForRow,
  paymentMutationIsErrorForRow,
  statusMutationErrorMessage,
  paymentMutationErrorMessage,
  onStatusDraftChange,
  onPayDraftChange,
  onAmountDraftChange,
  onApplyStatus,
  onSavePayment,
  onInspectRow,
  reviewableTargets,
}: ReviewTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Queued registrations ({rows.length} shown)</CardTitle>
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState title="Nothing in this queue" description="Adjust the filter or check individual tour workspaces." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Tour</th>
                  <th scope="col">Participant</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Status</th>
                  <th scope="col">Update status</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Quick actions</th>
                  <th scope="col">Workspace</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const bookingTerminal = isTerminalBookingState(r.status);
                  const paymentTerminal = isTerminalPaymentStateForRow(r);

                  const statusSelectDisabled =
                    bookingTerminal ||
                    (statusPendingRowId != null && statusPendingRowId === r.id);
                  const statusApplyHidden = bookingTerminal;
                  const statusApplyDisabled =
                    statusPendingRowId === r.id ? true : statusFor(r) === r.status;

                  const paymentSelectDisabled =
                    bookingTerminal ||
                    paymentTerminal ||
                    (paymentPendingRowId != null && paymentPendingRowId === r.id);
                  const paymentSaveHidden = bookingTerminal || paymentTerminal;
                  const paymentSaveDisabled =
                    (paymentPendingRowId != null && paymentPendingRowId === r.id) ||
                    paymentSaveIsNoOpForRow(r);

                  const statusRowError = statusMutationIsErrorForRow(r.id);
                  const paymentRowError = paymentMutationIsErrorForRow(r.id);
                  const rowErrored = statusRowError || paymentRowError;

                  return (
                    <tr key={r.id} className={rowErrored ? workspaceStyles.workspaceRowErrored : undefined}>
                      <td>
                        <div>{r.tourTitle}</div>
                        <Link className={styles.link} href={`/tours/${r.tourId}`}>
                          Tour · {r.tourId.slice(0, 8)}…
                        </Link>
                      </td>
                      <td>
                        <div>{r.participantFullName}</div>
                        <div className={styles.cellMuted}>{r.participantContactPhone}</div>
                      </td>
                      <td>{new Date(r.updatedAt).toLocaleString()}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          <BookingStatusBadge status={r.status} />
                          <PaymentStatusBadge payment={r.paymentStatus} />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: "10rem" }}>
                          <Select
                            aria-label={`Status for ${r.id}`}
                            value={statusFor(r)}
                            disabled={statusSelectDisabled}
                            onChange={(e) => onStatusDraftChange(r.id, e.target.value as RegistrationStatus)}
                          >
                            {registrationStatusOptions(r).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                          {statusApplyHidden ? null : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={statusApplyDisabled}
                              onClick={() => onApplyStatus(r.id, statusFor(r))}
                            >
                              Apply status
                            </Button>
                          )}
                          {statusRowError && statusMutationErrorMessage ? (
                            <span className={workspaceStyles.waitlistInlineError} role="alert">
                              {statusMutationErrorMessage}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: "10rem" }}>
                          <Select
                            aria-label={`Payment for ${r.id}`}
                            value={paymentFor(r)}
                            disabled={paymentSelectDisabled}
                            onChange={(e) => onPayDraftChange(r.id, e.target.value as RegistrationPaymentStatus)}
                          >
                            {paymentStatusOptions(r).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            placeholder="Paid amount"
                            disabled={paymentSelectDisabled}
                            value={amountDraft[r.id] ?? ""}
                            aria-label={`Paid amount for ${r.participantFullName}`}
                            onChange={(e) => onAmountDraftChange(r.id, e.target.value)}
                          />
                          {paymentSaveHidden ? null : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={paymentSaveDisabled}
                              onClick={() => onSavePayment(r.id, paymentFor(r), amountDraft[r.id] ?? "")}
                            >
                              Save payment
                            </Button>
                          )}
                          {paymentRowError && paymentMutationErrorMessage ? (
                            <span className={workspaceStyles.waitlistInlineError} role="alert">
                              {paymentMutationErrorMessage}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: "11rem" }}>
                          <Button type="button" size="sm" variant="ghost" onClick={() => onInspectRow(r.id)}>
                            Inspect details
                          </Button>
                          {reviewableTargets.map((target) => (
                            <Button
                              key={target}
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={!canQuickTransition(r, target) || statusPendingRowId === r.id}
                              onClick={() => onApplyStatus(r.id, target)}
                            >
                              {target === "Accepted" ? "Approve" : "Reject"}
                            </Button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <Link className={styles.link} href={`/tours/${r.tourId}/workspace`}>
                          Open workspace
                        </Link>
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

