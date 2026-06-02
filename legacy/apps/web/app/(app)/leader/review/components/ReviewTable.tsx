"use client";

import Link from "next/link";

import workspaceStyles from "../../../tours/[id]/workspace/tour-workspace.module.css";
import styles from "./ReviewTable.module.css";
import { RegistrationTransportCrmCell } from "@/components/registrations/registration-transport-crm-cell";
import { BookingStatusBadgeFa, PaymentStatusBadgeFa } from "@/components/registrations/registration-status-badges-fa";
import type { LeaderRegistrationRow } from "@/lib/hooks/useLeaderTourRegistrations";
import { formatRegistrationInstantFa } from "@/lib/registrations/format-registration-crm";
import {
  formatPaymentStatusFa,
  formatRegistrationStatusFa,
} from "@/lib/registrations/format-registration-status-fa";

import { LEADER_REVIEW_COPY } from "../leader-review-copy";

import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Input, Select } from "@tour/ui";

const copy = LEADER_REVIEW_COPY.table;

export type ReviewTableProps = {
  rows: LeaderRegistrationRow[];
  amountDraft: Record<string, string>;
  statusPendingRowId: string | null;
  paymentPendingRowId: string | null;
  statusFor: (_row: LeaderRegistrationRow) => RegistrationStatus;
  paymentFor: (_row: LeaderRegistrationRow) => RegistrationPaymentStatus;
  canQuickTransition: (_row: LeaderRegistrationRow, _target: RegistrationStatus) => boolean;
  registrationStatusOptions: (_row: LeaderRegistrationRow) => RegistrationStatus[];
  paymentStatusOptions: (_row: LeaderRegistrationRow) => RegistrationPaymentStatus[];
  paymentSaveIsNoOpForRow: (_row: LeaderRegistrationRow) => boolean;
  isTerminalBookingState: (_status: RegistrationStatus) => boolean;
  isTerminalPaymentStateForRow: (_row: LeaderRegistrationRow) => boolean;
  statusMutationIsErrorForRow: (_id: string) => boolean;
  paymentMutationIsErrorForRow: (_id: string) => boolean;
  statusMutationErrorMessage: string | null;
  paymentMutationErrorMessage: string | null;
  onStatusDraftChange: (_id: string, _next: RegistrationStatus) => void;
  onPayDraftChange: (_id: string, _next: RegistrationPaymentStatus) => void;
  onAmountDraftChange: (_id: string, _next: string) => void;
  onApplyStatus: (_id: string, _target: RegistrationStatus) => void;
  onSavePayment: (_id: string, _nextStatus: RegistrationPaymentStatus, _rawAmount: string) => void;
  onInspectRow: (_id: string) => void;
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
        <CardTitle>{copy.title(rows.length)}</CardTitle>
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{copy.colTour}</th>
                  <th scope="col">{copy.colParticipant}</th>
                  <th scope="col">{copy.colTransportNotes}</th>
                  <th scope="col">{copy.colUpdated}</th>
                  <th scope="col">{copy.colStatus}</th>
                  <th scope="col">{copy.colUpdateStatus}</th>
                  <th scope="col">{copy.colPayment}</th>
                  <th scope="col">{copy.colQuickActions}</th>
                  <th scope="col">{copy.colWorkspace}</th>
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
                          {copy.tourLink(r.tourId.slice(0, 8))}
                        </Link>
                      </td>
                      <td>
                        <div>{r.participantFullName}</div>
                        <div className={styles.cellMuted}>{r.participantContactPhone}</div>
                      </td>
                      <td>
                        <RegistrationTransportCrmCell reg={r} />
                      </td>
                      <td>{formatRegistrationInstantFa(r.updatedAt)}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          <BookingStatusBadgeFa status={r.status} />
                          <PaymentStatusBadgeFa payment={r.paymentStatus} />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: "10rem" }}>
                          <Select
                            aria-label={`${copy.colUpdateStatus} ${r.id}`}
                            value={statusFor(r)}
                            disabled={statusSelectDisabled}
                            onChange={(e) => onStatusDraftChange(r.id, e.target.value as RegistrationStatus)}
                          >
                            {registrationStatusOptions(r).map((s) => (
                              <option key={s} value={s}>
                                {formatRegistrationStatusFa(s)}
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
                              {copy.applyStatus}
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
                            aria-label={`${copy.colPayment} ${r.id}`}
                            value={paymentFor(r)}
                            disabled={paymentSelectDisabled}
                            onChange={(e) => onPayDraftChange(r.id, e.target.value as RegistrationPaymentStatus)}
                          >
                            {paymentStatusOptions(r).map((s) => (
                              <option key={s} value={s}>
                                {formatPaymentStatusFa(s)}
                              </option>
                            ))}
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            placeholder={copy.paidAmountPlaceholder}
                            disabled={paymentSelectDisabled}
                            value={amountDraft[r.id] ?? ""}
                            aria-label={`${copy.paidAmountPlaceholder} ${r.participantFullName}`}
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
                              {copy.savePayment}
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
                            {copy.inspect}
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
                              {target === "Accepted" ? copy.approve : copy.reject}
                            </Button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <Link className={styles.link} href={`/tours/${r.tourId}/workspace`}>
                          {copy.openWorkspace}
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
