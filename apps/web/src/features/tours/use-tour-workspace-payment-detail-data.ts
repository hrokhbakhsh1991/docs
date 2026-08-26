"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildInvoiceLookupPath,
  parseRegistrationInvoice,
  type RegistrationInvoice,
} from "@/finance/finance-invoice-logic";
import {
  parseSchedulesListResponse,
  type PaymentScheduleItem,
} from "@/finance/finance-installments-logic";
import {
  parseFinancePaymentsListResponse,
  type FinancePaymentRow,
} from "@/finance/finance-payments-logic";
import { type FinancePendingReceipt } from "@/finance/finance-receipts-logic";
import { withFinanceRegistrationQuery } from "@/finance/finance-registration-context";
import { toFinanceClientErrorCode } from "@/i18n/resolve-finance-error-message";
import {
  buildTourWorkspacePaymentDetailState,
  shouldBuildTourWorkspacePaymentDetailState,
  type TourWorkspacePaymentDetailState,
} from "@/features/tours/tour-workspace-payment-follow-up-state";

type TourWorkspacePaymentDetailDataState = {
  readonly loading: boolean;
  readonly error: string | null;
  readonly invoice: RegistrationInvoice | null;
  readonly payments: readonly FinancePaymentRow[];
  readonly schedule: readonly PaymentScheduleItem[];
  readonly receipts: readonly FinancePendingReceipt[];
  readonly detailState: TourWorkspacePaymentDetailState | null;
  readonly refresh: () => void;
};

const EMPTY_DETAIL_STATE: Omit<TourWorkspacePaymentDetailDataState, "refresh"> = {
  loading: false,
  error: null,
  invoice: null,
  payments: [],
  schedule: [],
  receipts: [],
  detailState: null,
};

function isUsableRegistrationId(value: string | null | undefined): value is string {
  const id = value?.trim() ?? "";
  return id.length >= 32;
}

export function useTourWorkspacePaymentDetailData(
  registrationId: string | null,
  pendingReceipts: readonly FinancePendingReceipt[]
): TourWorkspacePaymentDetailDataState {
  const normalizedRegistrationId = registrationId?.trim() ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<RegistrationInvoice | null>(null);
  const [payments, setPayments] = useState<readonly FinancePaymentRow[]>([]);
  const [schedule, setSchedule] = useState<readonly PaymentScheduleItem[]>([]);
  const [fetchNonce, setFetchNonce] = useState(0);

  const receipts = useMemo(
    () =>
      normalizedRegistrationId.length === 0
        ? []
        : pendingReceipts.filter(
            (row) => row.payment?.registrationId?.trim() === normalizedRegistrationId
          ),
    [normalizedRegistrationId, pendingReceipts]
  );

  const refresh = useCallback(() => {
    setFetchNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!isUsableRegistrationId(normalizedRegistrationId)) {
      setLoading(false);
      setError(null);
      setInvoice(null);
      setPayments([]);
      setSchedule([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void Promise.all([
      fetch(buildInvoiceLookupPath(normalizedRegistrationId), {
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`REGISTRATION_INVOICE_HTTP_${response.status}`);
        }
        return parseRegistrationInvoice(await response.json());
      }),
      fetch(withFinanceRegistrationQuery("/api/finance/payments?limit=20", normalizedRegistrationId), {
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`PAYMENTS_LIST_HTTP_${response.status}`);
        }
        return parseFinancePaymentsListResponse(await response.json()).items;
      }),
      fetch(
        withFinanceRegistrationQuery("/api/finance/schedules", normalizedRegistrationId),
        {
          cache: "no-store",
          signal: controller.signal,
        }
      ).then(async (response) => {
        if (!response.ok) {
          throw new Error(`SCHEDULES_LIST_HTTP_${response.status}`);
        }
        return parseSchedulesListResponse(await response.json()).items;
      }),
    ])
      .then(([nextInvoice, nextPayments, nextSchedule]) => {
        if (controller.signal.aborted) {
          return;
        }
        setInvoice(nextInvoice);
        setPayments(nextPayments);
        setSchedule(nextSchedule);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setInvoice(null);
        setPayments([]);
        setSchedule([]);
        setError(toFinanceClientErrorCode(fetchError, "PAYMENT_DETAIL_FETCH_FAILED"));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [fetchNonce, normalizedRegistrationId]);

  const detailState = useMemo(
    () =>
      shouldBuildTourWorkspacePaymentDetailState({
        loading,
        invoice,
        payments,
        schedule,
        receipts,
      })
        ? buildTourWorkspacePaymentDetailState({
            invoice,
            payments,
            receipts,
            schedule,
          })
        : null,
    [invoice, loading, payments, receipts, schedule]
  );

  if (!isUsableRegistrationId(normalizedRegistrationId)) {
    return { ...EMPTY_DETAIL_STATE, refresh };
  }

  return {
    loading,
    error,
    invoice,
    payments,
    schedule,
    receipts,
    detailState,
    refresh,
  };
}
