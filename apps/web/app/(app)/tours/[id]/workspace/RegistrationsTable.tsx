"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import type { BookingDto } from "@repo/types";
import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

import { BookingStatusBadge, PaymentStatusBadge } from "@/components/shared/badges";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "@tour/ui";

import { ApiError } from "@/lib/api-client";
import type { BookingAggregatePaymentStatus } from "@/lib/booking-transition-policy";
import {
  getAllowedBookingTransitions,
  getAllowedPaymentTransitions,
  isTerminalBookingState,
  isTerminalPaymentState,
} from "@/lib/booking-transition-policy";

import styles from "./tour-workspace.module.css";

export type RegistrationsTableProps = {
  registrations: BookingDto[];
  filter: "all" | "pending";
  onFilterChange: (next: "all" | "pending") => void;
  readOnly: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  statusMutation: UseMutationResult<
    BookingDto,
    Error,
    { id: string; targetStatus: RegistrationStatus }
  >;
  paymentMutation: UseMutationResult<
    BookingDto,
    Error,
    { id: string; paymentStatus: RegistrationPaymentStatus; paidAmount?: number }
  >;
};

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

function mutationRowMessage(error: Error | null): string {
  if (!error) return "Request failed.";
  if (error instanceof ApiError) {
    return error.message.trim() || "Request failed.";
  }
  return error.message.trim() || "Request failed.";
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

  function statusFor(reg: BookingDto): RegistrationStatus {
    return statusDraft[reg.id] ?? reg.status;
  }

  function paymentFor(reg: BookingDto): RegistrationPaymentStatus {
    return payDraft[reg.id] ?? reg.paymentStatus;
  }

  function registrationStatusOptions(reg: BookingDto): RegistrationStatus[] {
    const persisted = reg.status;
    const draft = statusFor(reg);
    if (readOnly || isTerminalBookingState(persisted)) {
      return uniqueOrdered([draft, persisted]);
    }
    const allowed = [...getAllowedBookingTransitions(persisted)];
    const legal = new Set<RegistrationStatus>([persisted, ...allowed]);
    return uniqueOrdered([persisted, draft, ...allowed]).filter((s) => legal.has(s));
  }

  function paymentStatusOptions(reg: BookingDto): RegistrationPaymentStatus[] {
    const persistedWire = persistPaymentWire(reg);
    const persistedPublic = reg.paymentStatus as RegistrationPaymentStatus;
    const draft = paymentFor(reg);
    if (readOnly || isTerminalBookingState(reg.status) || isTerminalPaymentState(persistedWire)) {
      return uniqueOrdered([draft, persistedPublic]);
    }
    const patchAllowed = [...getAllowedPaymentTransitions(persistedWire, reg.status)].filter(
      (p): p is RegistrationPaymentStatus => PUBLIC_PATCH_PAYMENT.has(p),
    );
    const legal = new Set<RegistrationPaymentStatus>([persistedPublic, ...patchAllowed]);
    return uniqueOrdered([persistedPublic, draft, ...patchAllowed]).filter((s) => legal.has(s));
  }

  return (
    <Card>
      <CardHeader>
        <div className={styles.workspaceHeader}>
          <CardTitle className={styles.workspaceCardTitle}>Registrations</CardTitle>
          <Select
            aria-label="Filter registrations list"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as "all" | "pending")}
          >
            <option value="all">All</option>
            <option value="pending">Pending review</option>
          </Select>
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <LoadingState message="Loading registrations…" />
        ) : isError ? (
          <ErrorState title="Could not load registrations" onRetry={onRetry} />
        ) : displayedRegistrations.length === 0 ? (
          <EmptyState
            embedded
            title={
              filter === "pending" ? "No pending registrations" : "No registrations yet"
            }
            description={
              filter === "pending"
                ? "There are no registrations awaiting review for this tour."
                : "Registrations will appear here once participants sign up."
            }
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="Tour registrations">
              <thead>
                <tr>
                  <th scope="col">Participant</th>
                  <th scope="col">Statuses</th>
                  <th scope="col">Update status</th>
                  <th scope="col">Payment ops</th>
                </tr>
              </thead>
              <tbody>
                {displayedRegistrations.map((reg) => {
                  const bookingTerminal = isTerminalBookingState(reg.status);
                  const paymentWire = persistPaymentWire(reg);
                  const paymentTerminal = isTerminalPaymentState(paymentWire);

                  const statusSelectDisabled =
                    readOnly ||
                    bookingTerminal ||
                    (statusMutation.isPending && statusPendingRowId === reg.id);
                  const statusApplyHidden = readOnly || bookingTerminal;
                  const statusApplyDisabled =
                    statusMutation.isPending && statusPendingRowId === reg.id
                      ? true
                      : statusFor(reg) === reg.status;

                  const paymentSelectDisabled =
                    readOnly ||
                    bookingTerminal ||
                    paymentTerminal ||
                    (paymentMutation.isPending && paymentPendingRowId === reg.id);
                  const paymentSaveHidden = readOnly || bookingTerminal || paymentTerminal;
                  const paymentSaveDisabled =
                    (paymentMutation.isPending && paymentPendingRowId === reg.id) ||
                    paymentSaveIsNoOp(reg, payDraft, amountDraft);

                  const statusRowError =
                    statusMutation.isError && statusMutation.variables?.id === reg.id;
                  const paymentRowError =
                    paymentMutation.isError && paymentMutation.variables?.id === reg.id;
                  const rowErrored = statusRowError || paymentRowError;

                  return (
                    <tr key={reg.id} className={rowErrored ? styles.workspaceRowErrored : undefined}>
                      <th scope="row" className={styles.rowHeader}>
                        <div>{reg.participantFullName}</div>
                        <div className={styles.muted}>{reg.participantContactPhone}</div>
                        <div className={styles.mono}>{reg.id.slice(0, 8)}…</div>
                      </th>
                      <td>
                        <div className={styles.badgeRow}>
                          <BookingStatusBadge status={reg.status} />
                          <PaymentStatusBadge payment={reg.paymentStatus} />
                        </div>
                      </td>
                      <td>
                        <div className={styles.controls}>
                          <Select
                            aria-label={`Status for ${reg.id}`}
                            value={statusFor(reg)}
                            disabled={statusSelectDisabled}
                            onChange={(e) =>
                              setStatusDraft((d) => ({
                                ...d,
                                [reg.id]: e.target.value as RegistrationStatus,
                              }))
                            }
                          >
                            {registrationStatusOptions(reg).map((s) => (
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
                              onClick={() => {
                                if (readOnly || bookingTerminal) return;
                                if (statusPendingRowId === reg.id) return;
                                statusMutation.mutate({
                                  id: reg.id,
                                  targetStatus: statusFor(reg),
                                });
                              }}
                            >
                              Apply
                            </Button>
                          )}
                          {statusRowError ? (
                            <span className={styles.waitlistInlineError} role="alert">
                              {mutationRowMessage(statusMutation.error)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className={styles.controls}>
                          <Select
                            aria-label={`Payment for ${reg.id}`}
                            value={paymentFor(reg)}
                            disabled={paymentSelectDisabled}
                            onChange={(e) =>
                              setPayDraft((d) => ({
                                ...d,
                                [reg.id]: e.target.value as RegistrationPaymentStatus,
                              }))
                            }
                          >
                            {paymentStatusOptions(reg).map((s) => (
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
                            value={amountDraft[reg.id] ?? ""}
                            aria-label={`Paid amount for ${reg.participantFullName}`}
                            onChange={(e) =>
                              setAmountDraft((d) => ({
                                ...d,
                                [reg.id]: e.target.value,
                              }))
                            }
                          />
                          {paymentSaveHidden ? null : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={paymentSaveDisabled}
                              onClick={() => {
                                if (readOnly || bookingTerminal || paymentTerminal) return;
                                if (paymentPendingRowId === reg.id) return;
                                const raw = amountDraft[reg.id]?.trim();
                                const paidAmount =
                                  raw === "" || raw === undefined ? undefined : Number(raw);
                                paymentMutation.mutate({
                                  id: reg.id,
                                  paymentStatus: paymentFor(reg),
                                  ...(typeof paidAmount === "number" && !Number.isNaN(paidAmount)
                                    ? { paidAmount }
                                    : {}),
                                });
                              }}
                            >
                              Save payment
                            </Button>
                          )}
                          {paymentRowError ? (
                            <span className={styles.waitlistInlineError} role="alert">
                              {mutationRowMessage(paymentMutation.error)}
                            </span>
                          ) : null}
                        </div>
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
