"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BookingDto } from "@repo/types";
import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";
import { RegistrationTableRow } from "./RegistrationTableRow";

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
} from "@tour/ui";

import { ApiError } from "@/lib/api-client";
import {
  getAllowedBookingTransitions,
  isTerminalBookingState,
  isTerminalPaymentState,
} from "@/lib/booking-transition-policy";
import type { BookingAggregatePaymentStatus } from "@/lib/booking-transition-policy";

import styles from "./tour-workspace.module.css";

export type RegistrationsTableProps = {
  registrations: BookingDto[];
  filter: "all" | "pending";
  onFilterChange: (_next: "all" | "pending") => void;
  readOnly: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  statusMutation: UseMutationResult<
    BookingDto,
    Error,
    { id: string; targetStatus: RegistrationStatus; expected_row_version: number }
  >;
  paymentMutation: UseMutationResult<
    BookingDto,
    Error,
    {
      id: string;
      paymentStatus: RegistrationPaymentStatus;
      paidAmount?: number;
      expected_row_version: number;
    }
  >;
};

/** Compare PATCH payload shape to persisted row — disables Save when unchanged. */
function paymentSaveIsNoOp(
  reg: BookingDto,
  payDraft: Record<string, RegistrationPaymentStatus>,
  amountDraftRecord: Record<string, string>,
): boolean {
  const effectivePayment = payDraft[reg.id] ?? reg.paymentStatus;
  if (effectivePayment !== reg.paymentStatus) return false;
  const raw = amountDraftRecord[reg.id]?.trim();
  const persistedAmt = reg.paidAmount?.trim() ?? "";
  const draftEmpty = raw === undefined || raw === "";
  const persistedEmpty = persistedAmt === "";
  if (draftEmpty && persistedEmpty) return true;
  if (draftEmpty || persistedEmpty) return false;
  const a = Number(raw);
  const b = Number(persistedAmt);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

const copy = TOUR_WORKSPACE_COPY.registrations;
const pageCopy = TOUR_WORKSPACE_COPY.page;

function mutationRowMessage(error: Error | null): string {
  if (!error) return pageCopy.mutationErrorFallback;
  if (error instanceof ApiError) {
    return error.message.trim() || pageCopy.mutationErrorFallback;
  }
  return error.message.trim() || pageCopy.mutationErrorFallback;
}

export function RegistrationsTable({
  registrations,
  filter,
  onFilterChange,
  readOnly,
  isLoading,
  isError,
  onRetry,
  statusMutation,
  paymentMutation,
}: RegistrationsTableProps) {
  const [statusDraft, setStatusDraft] = useState<Record<string, RegistrationStatus>>({});
  const [payDraft, setPayDraft] = useState<Record<string, RegistrationPaymentStatus>>({});
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});

  const statusPendingRowId = statusMutation.isPending ? statusMutation.variables?.id ?? null : null;
  const paymentPendingRowId = paymentMutation.isPending ? paymentMutation.variables?.id ?? null : null;

  const statusMutationErrorMessage = statusMutation.isError
    ? mutationRowMessage(statusMutation.error)
    : null;
  const paymentMutationErrorMessage = paymentMutation.isError
    ? mutationRowMessage(paymentMutation.error)
    : null;

  const prevStatusMutationStatusRef = useRef(statusMutation.status);
  useEffect(() => {
    const prev = prevStatusMutationStatusRef.current;
    const cur = statusMutation.status;
    if (prev === "pending" && (cur === "success" || cur === "error")) {
      const id = statusMutation.variables?.id;
      if (id) {
        setStatusDraft((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
      }
    }
    prevStatusMutationStatusRef.current = cur;
  }, [statusMutation.status, statusMutation.variables?.id]);

  const prevPaymentMutationStatusRef = useRef(paymentMutation.status);
  useEffect(() => {
    const prev = prevPaymentMutationStatusRef.current;
    const cur = paymentMutation.status;
    if (prev === "pending" && (cur === "success" || cur === "error")) {
      const id = paymentMutation.variables?.id;
      if (id) {
        setPayDraft((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
        setAmountDraft((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
      }
    }
    prevPaymentMutationStatusRef.current = cur;
  }, [paymentMutation.status, paymentMutation.variables?.id]);

  useEffect(() => {
    const ids = new Set(registrations.map((r) => r.id));
    setStatusDraft((d) => {
      let changed = false;
      const next = { ...d };
      for (const k of Object.keys(next)) {
        if (!ids.has(k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : d;
    });
    setPayDraft((d) => {
      let changed = false;
      const next = { ...d };
      for (const k of Object.keys(next)) {
        if (!ids.has(k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : d;
    });
    setAmountDraft((d) => {
      let changed = false;
      const next = { ...d };
      for (const k of Object.keys(next)) {
        if (!ids.has(k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : d;
    });
  }, [registrations]);

  useEffect(() => {
    setStatusDraft((d) => {
      let changed = false;
      const next = { ...d };
      for (const reg of registrations) {
        const draft = next[reg.id];
        if (draft === undefined || draft === reg.status) continue;
        const allowed = getAllowedBookingTransitions(reg.status);
        if (!allowed.includes(draft)) {
          delete next[reg.id];
          changed = true;
        }
      }
      return changed ? next : d;
    });
  }, [registrations]);

  const displayedRegistrations = useMemo(() => {
    if (filter === "pending") {
      return registrations.filter((r) => r.status === "Pending");
    }
    return registrations;
  }, [filter, registrations]);

  const onStatusDraftChange = useCallback((id: string, status: RegistrationStatus) => {
    setStatusDraft((d) => ({ ...d, [id]: status }));
  }, []);

  const onPayDraftChange = useCallback((id: string, payment: RegistrationPaymentStatus) => {
    setPayDraft((d) => ({ ...d, [id]: payment }));
  }, []);

  const onAmountDraftChange = useCallback((id: string, amount: string) => {
    setAmountDraft((d) => ({ ...d, [id]: amount }));
  }, []);

  const onApplyStatus = useCallback(
    (reg: BookingDto, targetStatus: RegistrationStatus) => {
      if (readOnly || isTerminalBookingState(reg.status)) return;
      if (statusPendingRowId === reg.id) return;
      statusMutation.mutate({
        id: reg.id,
        targetStatus,
        expected_row_version: reg.rowVersion,
      });
    },
    [readOnly, statusMutation, statusPendingRowId],
  );

  const onSavePayment = useCallback(
    (reg: BookingDto, paymentStatus: RegistrationPaymentStatus, rawAmount: string) => {
      if (readOnly || isTerminalBookingState(reg.status)) return;
      if (isTerminalPaymentState(reg.paymentStatus as BookingAggregatePaymentStatus)) return;
      if (paymentPendingRowId === reg.id) return;
      const raw = rawAmount.trim();
      const paidAmount = raw === "" ? undefined : Number(raw);
      paymentMutation.mutate({
        id: reg.id,
        paymentStatus,
        expected_row_version: reg.rowVersion,
        ...(typeof paidAmount === "number" && !Number.isNaN(paidAmount) ? { paidAmount } : {}),
      });
    },
    [readOnly, paymentMutation, paymentPendingRowId],
  );

  return (
    <Card>
      <CardHeader>
        <div className={styles.workspaceHeader}>
          <CardTitle className={styles.workspaceCardTitle}>{copy.title}</CardTitle>
          <Select
            aria-label={copy.title}
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as "all" | "pending")}
          >
            <option value="all">{copy.filterAll}</option>
            <option value="pending">{copy.filterPending}</option>
          </Select>
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <LoadingState message={copy.loading} />
        ) : isError ? (
          <ErrorState title={copy.loadErrorTitle} onRetry={onRetry} />
        ) : displayedRegistrations.length === 0 ? (
          <EmptyState
            embedded
            title={filter === "pending" ? copy.emptyPendingTitle : copy.emptyAllTitle}
            description={
              filter === "pending" ? copy.emptyPendingDescription : copy.emptyAllDescription
            }
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label={copy.title}>
              <thead>
                <tr>
                  <th scope="col">{copy.colParticipant}</th>
                  <th scope="col">{copy.colTransportNotes}</th>
                  <th scope="col">{copy.colStatuses}</th>
                  <th scope="col">{copy.colUpdateStatus}</th>
                  <th scope="col">{copy.colPaymentOps}</th>
                </tr>
              </thead>
              <tbody>
                {displayedRegistrations.map((reg) => (
                  <RegistrationTableRow
                    key={reg.id}
                    reg={reg}
                    statusValue={statusDraft[reg.id] ?? reg.status}
                    paymentValue={payDraft[reg.id] ?? reg.paymentStatus}
                    amountValue={amountDraft[reg.id] ?? ""}
                    readOnly={readOnly}
                    statusPendingRowId={statusPendingRowId}
                    paymentPendingRowId={paymentPendingRowId}
                    statusRowError={
                      statusMutation.isError && statusMutation.variables?.id === reg.id
                    }
                    paymentRowError={
                      paymentMutation.isError && paymentMutation.variables?.id === reg.id
                    }
                    statusErrorMessage={statusMutationErrorMessage}
                    paymentErrorMessage={paymentMutationErrorMessage}
                    paymentSaveIsNoOp={paymentSaveIsNoOp(reg, payDraft, amountDraft)}
                    onStatusDraftChange={onStatusDraftChange}
                    onPayDraftChange={onPayDraftChange}
                    onAmountDraftChange={onAmountDraftChange}
                    onApplyStatus={onApplyStatus}
                    onSavePayment={onSavePayment}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
