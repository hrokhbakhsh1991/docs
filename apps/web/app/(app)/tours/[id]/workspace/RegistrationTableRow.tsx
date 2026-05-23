"use client";

import { memo } from "react";

import type { BookingDto } from "@repo/types";
import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

import { RegistrationTransportCrmCell } from "@/components/registrations/registration-transport-crm-cell";
import { BookingStatusBadgeFa, PaymentStatusBadgeFa } from "@/components/registrations/registration-status-badges-fa";
import { formatPaymentStatusFa, formatRegistrationStatusFa } from "@/lib/registrations/format-registration-status-fa";
import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";

import { Button, Input, Select } from "@tour/ui";

import type { BookingAggregatePaymentStatus } from "@/lib/booking-transition-policy";
import {
  getAllowedBookingTransitions,
  getAllowedPaymentTransitions,
  isTerminalBookingState,
  isTerminalPaymentState,
} from "@/lib/booking-transition-policy";

import styles from "./tour-workspace.module.css";

const copy = TOUR_WORKSPACE_COPY.registrations;
const PUBLIC_PATCH_PAYMENT: ReadonlySet<string> = new Set(["NotPaid", "Partial", "Paid"]);

function uniqueOrdered<T extends string>(items: readonly T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of items) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function persistPaymentWire(reg: BookingDto): BookingAggregatePaymentStatus {
  return reg.paymentStatus as BookingAggregatePaymentStatus;
}

export type RegistrationTableRowProps = {
  reg: BookingDto;
  statusValue: RegistrationStatus;
  paymentValue: RegistrationPaymentStatus;
  amountValue: string;
  readOnly: boolean;
  statusPendingRowId: string | null;
  paymentPendingRowId: string | null;
  statusRowError: boolean;
  paymentRowError: boolean;
  statusErrorMessage: string | null;
  paymentErrorMessage: string | null;
  paymentSaveIsNoOp: boolean;
  onStatusDraftChange: (id: string, status: RegistrationStatus) => void;
  onPayDraftChange: (id: string, payment: RegistrationPaymentStatus) => void;
  onAmountDraftChange: (id: string, amount: string) => void;
  onApplyStatus: (reg: BookingDto, targetStatus: RegistrationStatus) => void;
  onSavePayment: (reg: BookingDto, paymentStatus: RegistrationPaymentStatus, rawAmount: string) => void;
};

function registrationTableRowPropsEqual(
  prev: RegistrationTableRowProps,
  next: RegistrationTableRowProps,
): boolean {
  return (
    prev.reg.id === next.reg.id &&
    prev.reg.rowVersion === next.reg.rowVersion &&
    prev.reg.status === next.reg.status &&
    prev.reg.paymentStatus === next.reg.paymentStatus &&
    prev.reg.participantFullName === next.reg.participantFullName &&
    prev.reg.participantContactPhone === next.reg.participantContactPhone &&
    prev.reg.transportMode === next.reg.transportMode &&
    prev.reg.vehicleSeatCapacity === next.reg.vehicleSeatCapacity &&
    prev.reg.participantNote === next.reg.participantNote &&
    prev.statusValue === next.statusValue &&
    prev.paymentValue === next.paymentValue &&
    prev.amountValue === next.amountValue &&
    prev.readOnly === next.readOnly &&
    prev.statusPendingRowId === next.statusPendingRowId &&
    prev.paymentPendingRowId === next.paymentPendingRowId &&
    prev.statusRowError === next.statusRowError &&
    prev.paymentRowError === next.paymentRowError &&
    prev.statusErrorMessage === next.statusErrorMessage &&
    prev.paymentErrorMessage === next.paymentErrorMessage &&
    prev.paymentSaveIsNoOp === next.paymentSaveIsNoOp &&
    prev.onStatusDraftChange === next.onStatusDraftChange &&
    prev.onPayDraftChange === next.onPayDraftChange &&
    prev.onAmountDraftChange === next.onAmountDraftChange &&
    prev.onApplyStatus === next.onApplyStatus &&
    prev.onSavePayment === next.onSavePayment
  );
}

export const RegistrationTableRow = memo(function RegistrationTableRow({
  reg,
  statusValue,
  paymentValue,
  amountValue,
  readOnly,
  statusPendingRowId,
  paymentPendingRowId,
  statusRowError,
  paymentRowError,
  statusErrorMessage,
  paymentErrorMessage,
  paymentSaveIsNoOp,
  onStatusDraftChange,
  onPayDraftChange,
  onAmountDraftChange,
  onApplyStatus,
  onSavePayment,
}: RegistrationTableRowProps) {
  const bookingTerminal = isTerminalBookingState(reg.status);
  const paymentWire = persistPaymentWire(reg);
  const paymentTerminal = isTerminalPaymentState(paymentWire);

  const statusSelectDisabled =
    readOnly || bookingTerminal || (statusPendingRowId != null && statusPendingRowId === reg.id);
  const statusApplyHidden = readOnly || bookingTerminal;
  const statusApplyDisabled =
    statusPendingRowId === reg.id ? true : statusValue === reg.status;

  const paymentSelectDisabled =
    readOnly ||
    bookingTerminal ||
    paymentTerminal ||
    (paymentPendingRowId != null && paymentPendingRowId === reg.id);
  const paymentSaveHidden = readOnly || bookingTerminal || paymentTerminal;
  const paymentSaveDisabled =
    paymentPendingRowId === reg.id || paymentSaveIsNoOp;

  const rowErrored = statusRowError || paymentRowError;

  const statusOptions = (() => {
    const persisted = reg.status;
    if (readOnly || isTerminalBookingState(persisted)) {
      return uniqueOrdered([statusValue, persisted]);
    }
    const allowed = [...getAllowedBookingTransitions(persisted)];
    const legal = new Set<RegistrationStatus>([persisted, ...allowed]);
    return uniqueOrdered([persisted, statusValue, ...allowed]).filter((s) => legal.has(s));
  })();

  const paymentOptions = (() => {
    const persistedWire = persistPaymentWire(reg);
    const persistedPublic = reg.paymentStatus as RegistrationPaymentStatus;
    if (readOnly || isTerminalBookingState(reg.status) || isTerminalPaymentState(persistedWire)) {
      return uniqueOrdered([paymentValue, persistedPublic]);
    }
    const patchAllowed = [...getAllowedPaymentTransitions(persistedWire, reg.status)].filter(
      (p): p is RegistrationPaymentStatus => PUBLIC_PATCH_PAYMENT.has(p),
    );
    const legal = new Set<RegistrationPaymentStatus>([persistedPublic, ...patchAllowed]);
    return uniqueOrdered([persistedPublic, paymentValue, ...patchAllowed]).filter((s) => legal.has(s));
  })();

  return (
    <tr className={rowErrored ? styles.workspaceRowErrored : undefined}>
      <th scope="row" className={styles.rowHeader}>
        <div>{reg.participantFullName}</div>
        <div className={styles.muted}>{reg.participantContactPhone}</div>
        <div className={styles.mono}>{reg.id.slice(0, 8)}…</div>
      </th>
      <td>
        <RegistrationTransportCrmCell reg={reg} />
      </td>
      <td>
        <div className={styles.badgeRow}>
          <BookingStatusBadgeFa status={reg.status} />
          <PaymentStatusBadgeFa payment={reg.paymentStatus} />
        </div>
      </td>
      <td>
        <div className={styles.controls}>
          <Select
            aria-label={`Status for ${reg.id}`}
            value={statusValue}
            disabled={statusSelectDisabled}
            onChange={(e) => onStatusDraftChange(reg.id, e.target.value as RegistrationStatus)}
          >
            {statusOptions.map((s) => (
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
              onClick={() => onApplyStatus(reg, statusValue)}
            >
              {copy.apply}
            </Button>
          )}
          {statusRowError && statusErrorMessage ? (
            <span className={styles.waitlistInlineError} role="alert">
              {statusErrorMessage}
            </span>
          ) : null}
        </div>
      </td>
      <td>
        <div className={styles.controls}>
          <Select
            aria-label={`Payment for ${reg.id}`}
            value={paymentValue}
            disabled={paymentSelectDisabled}
            onChange={(e) => onPayDraftChange(reg.id, e.target.value as RegistrationPaymentStatus)}
          >
            {paymentOptions.map((s) => (
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
            value={amountValue}
            aria-label={`Paid amount for ${reg.participantFullName}`}
            onChange={(e) => onAmountDraftChange(reg.id, e.target.value)}
          />
          {paymentSaveHidden ? null : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={paymentSaveDisabled}
              onClick={() => onSavePayment(reg, paymentValue, amountValue)}
            >
              {copy.savePayment}
            </Button>
          )}
          {paymentRowError && paymentErrorMessage ? (
            <span className={styles.waitlistInlineError} role="alert">
              {paymentErrorMessage}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}, registrationTableRowPropsEqual);
