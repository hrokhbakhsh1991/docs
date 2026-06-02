"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import type { BookingAggregatePaymentStatus } from "@/lib/booking-transition-policy";
import {
  getAllowedBookingTransitions,
  getAllowedPaymentTransitions,
  isTerminalBookingState,
  isTerminalPaymentState,
} from "@/lib/booking-transition-policy";
import type { LeaderRegistrationRow } from "@/lib/hooks/useLeaderTourRegistrations";
import {
  updateRegistrationPayment,
  updateRegistrationStatus,
} from "@/lib/services/registrations.service";

import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

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

function persistPaymentWire(reg: LeaderRegistrationRow): BookingAggregatePaymentStatus {
  return reg.paymentStatus as BookingAggregatePaymentStatus;
}

function paymentSaveIsNoOp(
  reg: LeaderRegistrationRow,
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

export function useLeaderReviewState(
  rows: LeaderRegistrationRow[],
  visibleRows: LeaderRegistrationRow[],
  onRefreshData: () => Promise<void>,
) {
  const [statusDraft, setStatusDraft] = useState<Record<string, RegistrationStatus>>({});
  const [payDraft, setPayDraft] = useState<Record<string, RegistrationPaymentStatus>>({});
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      targetStatus,
      expected_row_version,
    }: {
      id: string;
      targetStatus: RegistrationStatus;
      expected_row_version: number;
    }) => updateRegistrationStatus(id, { targetStatus, expected_row_version }),
    onSuccess: async () => {
      await onRefreshData();
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (args: {
      id: string;
      paymentStatus: RegistrationPaymentStatus;
      paidAmount?: number;
      expected_row_version: number;
    }) =>
      updateRegistrationPayment(args.id, {
        paymentStatus: args.paymentStatus,
        paidAmount: args.paidAmount,
        expected_row_version: args.expected_row_version,
      }),
    onSuccess: async () => {
      await onRefreshData();
    },
  });

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
    const ids = new Set(rows.map((r) => r.id));
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
  }, [rows]);

  useEffect(() => {
    setStatusDraft((d) => {
      let changed = false;
      const next = { ...d };
      for (const reg of rows) {
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
  }, [rows]);

  const paymentSaveIsNoOpForRow = (row: LeaderRegistrationRow) => paymentSaveIsNoOp(row, payDraft, amountDraft);

  function statusFor(r: LeaderRegistrationRow): RegistrationStatus {
    return statusDraft[r.id] ?? r.status;
  }

  function paymentFor(r: LeaderRegistrationRow): RegistrationPaymentStatus {
    return payDraft[r.id] ?? r.paymentStatus;
  }

  function canQuickTransition(reg: LeaderRegistrationRow, target: RegistrationStatus): boolean {
    if (isTerminalBookingState(reg.status)) return false;
    return getAllowedBookingTransitions(reg.status).includes(target);
  }

  function registrationStatusOptions(reg: LeaderRegistrationRow): RegistrationStatus[] {
    const persisted = reg.status;
    const draft = statusFor(reg);
    if (isTerminalBookingState(persisted)) {
      return uniqueOrdered([draft, persisted]);
    }
    const allowed = [...getAllowedBookingTransitions(persisted)];
    const legal = new Set<RegistrationStatus>([persisted, ...allowed]);
    return uniqueOrdered([persisted, draft, ...allowed]).filter((s) => legal.has(s));
  }

  function paymentStatusOptions(reg: LeaderRegistrationRow): RegistrationPaymentStatus[] {
    const persistedWire = persistPaymentWire(reg);
    const persistedPublic = reg.paymentStatus as RegistrationPaymentStatus;
    const draft = paymentFor(reg);
    if (isTerminalBookingState(reg.status) || isTerminalPaymentState(persistedWire)) {
      return uniqueOrdered([draft, persistedPublic]);
    }
    const patchAllowed = [...getAllowedPaymentTransitions(persistedWire, reg.status)].filter(
      (p): p is RegistrationPaymentStatus => PUBLIC_PATCH_PAYMENT.has(p),
    );
    const legal = new Set<RegistrationPaymentStatus>([persistedPublic, ...patchAllowed]);
    return uniqueOrdered([persistedPublic, draft, ...patchAllowed]).filter((s) => legal.has(s));
  }

  const statusMutationErrorMessage = useMemo(
    () => (statusMutation.error instanceof Error ? statusMutation.error.message : null),
    [statusMutation.error],
  );
  const paymentMutationErrorMessage = useMemo(
    () => (paymentMutation.error instanceof Error ? paymentMutation.error.message : null),
    [paymentMutation.error],
  );

  return {
    statusDraft,
    payDraft,
    amountDraft,
    statusPendingRowId,
    paymentPendingRowId,
    statusFor,
    paymentFor,
    canQuickTransition,
    registrationStatusOptions,
    paymentStatusOptions,
    paymentSaveIsNoOpForRow,
    statusMutation,
    paymentMutation,
    statusMutationErrorMessage,
    paymentMutationErrorMessage,
    setStatusDraft: (id: string, next: RegistrationStatus) => setStatusDraft((d) => ({ ...d, [id]: next })),
    setPayDraft: (id: string, next: RegistrationPaymentStatus) => setPayDraft((d) => ({ ...d, [id]: next })),
    setAmountDraft: (id: string, next: string) => setAmountDraft((d) => ({ ...d, [id]: next })),
    onApplyStatus: (id: string, targetStatus: RegistrationStatus) => {
      const row = rows.find((r) => r.id === id) ?? visibleRows.find((r) => r.id === id);
      if (!row) return;
      if (isTerminalBookingState(row.status)) return;
      if (statusPendingRowId === row.id) return;
      statusMutation.mutate({
        id,
        targetStatus,
        expected_row_version: row.rowVersion,
      });
    },
    onSavePayment: (id: string, nextStatus: RegistrationPaymentStatus, rawAmount: string) => {
      const row = rows.find((r) => r.id === id) ?? visibleRows.find((r) => r.id === id);
      if (!row) return;
      if (isTerminalBookingState(row.status) || isTerminalPaymentState(persistPaymentWire(row))) return;
      if (paymentPendingRowId === row.id) return;
      const raw = rawAmount.trim();
      const paidAmount = raw === "" ? undefined : Number(raw);
      paymentMutation.mutate({
        id,
        paymentStatus: nextStatus,
        expected_row_version: row.rowVersion,
        ...(typeof paidAmount === "number" && !Number.isNaN(paidAmount) ? { paidAmount } : {}),
      });
    },
    statusMutationIsErrorForRow: (id: string) => Boolean(statusMutation.isError && statusMutation.variables?.id === id),
    paymentMutationIsErrorForRow: (id: string) =>
      Boolean(paymentMutation.isError && paymentMutation.variables?.id === id),
    isTerminalBookingState,
    isTerminalPaymentStateForRow: (row: LeaderRegistrationRow) => isTerminalPaymentState(persistPaymentWire(row)),
  };
}
