"use client";

import { createClientSafeUuid } from "@app-tour/draft-engine";
import type { VariantProps } from "class-variance-authority";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppSearchParams } from "@/navigation/app-navigation-hooks";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import {
  FINANCE_PAYMENTS_TEST_IDS,
  MANUAL_PAYMENT_CANCEL_REASON_CODES,
  buildCancelPendingManualPaymentPath,
  buildCancelPendingManualPaymentRequestBody,
  buildCreateManualPaymentRequestBody,
  buildFinancePaymentReceiptsHref,
  buildSubmitReceiptRequestBody,
  createFinanceIdempotencyKey,
  isManualPendingPaymentCancellable,
  isFinancePaymentManualMethod,
  isFinancePaymentPaidStatus,
  isFinancePaymentPendingStatus,
  mapCancelPendingManualPaymentHttpError,
  parseCancelPendingManualPaymentResponse,
  parseFinanceManualPaymentCreateResponse,
  parseFinancePaymentsListResponse,
  paymentStatusTone,
  validateCancelPendingManualPaymentForm,
  validateCreateManualPaymentForm,
  validateSubmitReceiptForm,
  uploadFinanceReceiptProof,
  type CancelPendingManualPaymentFormState,
  type CreateManualPaymentFormState,
  type FinancePaymentRow,
  type SubmitReceiptFormState,
  type FinancePaymentsListResponse,
} from "@/finance/finance-payments-logic";
import { parseFinancePendingReceiptsResponse } from "@/finance/finance-receipts-logic";
import {
  fetchRegistrationInvoice,
  resolveSuggestedPaymentAmountMinor,
  type RegistrationInvoice,
} from "@/finance/finance-invoice-logic";
import { FinanceInvoiceBalanceCard } from "@/finance/finance-invoice-balance-card";
import { FinanceRegistrationIdentity } from "@/finance/finance-registration-identity";
import { FinanceRegistrationPicker } from "@/finance/finance-registration-picker";
import { withFinanceListScopeQuery } from "@/finance/finance-registration-context";
import { invalidateFinanceRegistrationCaches } from "@/finance/finance-registration-fetch-cache";
import { fetchFinanceListWithRetry } from "@/finance/fetch-finance-list-with-retry";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import { formatFinanceTimestamp } from "@/finance/finance-reports-logic";
import type { AppLocale } from "@/i18n/routing";
import {
  localizeFinanceMessage,
  toFinanceClientErrorCode,
} from "@/i18n/resolve-finance-error-message";

type FinancePaymentsPanelProps = {
  readonly session: OperatorSessionContext;
  readonly initialPayments?: FinancePaymentsListResponse | null;
};

const EMPTY_FORM: CreateManualPaymentFormState = {
  registrationId: "",
  amount: "",
  currency: "",
};

const EMPTY_RECEIPT_FORM: SubmitReceiptFormState = {
  paymentId: "",
  fileKey: "",
  note: "",
};

function resolveFinancePaymentStatusLabel(t: (key: string) => string, status: string): string {
  try {
    return t(`status.${status}`);
  } catch {
    return status;
  }
}

function resolvePaymentMethodLabel(t: (key: string) => string, method: string): string {
  if (method === "Manual") {
    return t("method.Manual");
  }
  return method;
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function statusVariant(tone: ReturnType<typeof paymentStatusTone>): BadgeVariant {
  if (tone === "success") {
    return "success";
  }
  if (tone === "destructive") {
    return "destructive";
  }
  if (tone === "warning") {
    return "warning";
  }
  return "default";
}

function RegistrationObligationGlance({ invoice }: { readonly invoice: RegistrationInvoice }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.payments");
  return (
    <div
      className="rounded-md border bg-muted/20 px-3 py-2"
      data-testid={FINANCE_PAYMENTS_TEST_IDS.obligationGlance}
    >
      <p className="mb-1 text-xs text-muted-foreground">{t("obligationTitle")}</p>
      <div className="grid grid-cols-3 gap-2 text-start" dir="ltr">
        <div>
          <p className="text-[11px] text-muted-foreground">{t("invoiceTotalShort")}</p>
          <p className="text-sm font-medium tabular-nums">
            {formatMinorAmount(invoice.invoiceTotalMinor, invoice.currency, locale)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">{t("paidShort")}</p>
          <p className="text-sm font-medium tabular-nums">
            {formatMinorAmount(invoice.paidAmountMinor, invoice.currency, locale)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">{t("remainingShort")}</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatMinorAmount(invoice.balanceDueMinor, invoice.currency, locale)}
          </p>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{t("obligationHint")}</p>
    </div>
  );
}

function PaymentRow({
  row,
  locale,
  statusLabel,
  methodLabel,
  canManage,
  canCancel,
  onUseForAdvancedReceipt,
  onCancel,
}: {
  readonly row: FinancePaymentRow;
  readonly locale: AppLocale;
  readonly statusLabel: string;
  readonly methodLabel: string;
  readonly canManage: boolean;
  readonly canCancel: boolean;
  readonly onUseForAdvancedReceipt: (paymentId: string, registrationId: string) => void;
  readonly onCancel: (row: FinancePaymentRow) => void;
}) {
  const t = useTranslations("finance.payments");
  const tTabs = useTranslations("finance.commandCenter.tabs");
  const pending = isFinancePaymentPendingStatus(row.status);
  const receiptsHref = buildFinancePaymentReceiptsHref(row.registrationId);

  return (
    <li
      className="px-3 py-2.5 sm:px-4"
      data-testid={FINANCE_PAYMENTS_TEST_IDS.row}
      data-payment-status={row.status}
      data-payment-method={row.method}
    >
      <div className="flex items-start justify-between gap-3">
        <FinanceRegistrationIdentity
          registrationId={row.registrationId}
          context={row.registrationContext}
          density="compact"
        />
        <div className="shrink-0 space-y-1 text-end">
          <p className="text-base font-semibold tabular-nums leading-none">
            {formatMinorAmount(row.amount, row.currency, locale)}
          </p>
          <Badge variant={statusVariant(paymentStatusTone(row.status))}>{statusLabel}</Badge>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span>{methodLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{formatFinanceTimestamp(row.createdAt, locale)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <Link
          href={receiptsHref}
          className="font-medium text-primary underline-offset-2 hover:underline"
          data-testid={FINANCE_PAYMENTS_TEST_IDS.openReceipts}
        >
          {tTabs("receipts")}
        </Link>
        {isFinancePaymentPaidStatus(row.status) && isFinancePaymentManualMethod(row.method) ? (
          <Link
            href={`/finance?tab=refunds&registrationId=${encodeURIComponent(row.registrationId)}&paymentId=${encodeURIComponent(row.id)}&amountMinor=${encodeURIComponent(row.amount)}&currency=${encodeURIComponent(row.currency)}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-testid="finance-payment-request-refund"
          >
            {t("requestRefund")}
          </Link>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            data-testid={FINANCE_PAYMENTS_TEST_IDS.cancelOpen}
            onClick={() => onCancel(row)}
          >
            {t("cancelAction")}
          </button>
        ) : null}
        {canManage && pending ? (
          <details
            className="text-muted-foreground"
            data-testid={FINANCE_PAYMENTS_TEST_IDS.rowAdvanced}
          >
            <summary className="cursor-pointer select-none text-xs">{t("rowAdvancedShow")}</summary>
            <button
              type="button"
              className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
              data-testid={FINANCE_PAYMENTS_TEST_IDS.usePaymentForReceipt}
              onClick={() => onUseForAdvancedReceipt(row.id, row.registrationId)}
            >
              {t("usePaymentForAdvanced")}
            </button>
          </details>
        ) : null}
      </div>
    </li>
  );
}

export function FinancePaymentsPanel({
  session,
  initialPayments = null,
}: FinancePaymentsPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.payments");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const canManage = isAdminOrOwnerRole(session.role);
  const searchParams = useAppSearchParams();
  const registrationFilter = searchParams.get("registrationId");
  const tourFilter = searchParams.get("tourId");
  const registrationScoped =
    typeof registrationFilter === "string" && registrationFilter.trim().length >= 32;
  const [items, setItems] = useState<readonly FinancePaymentRow[]>(initialPayments?.items ?? []);
  const [loading, setLoading] = useState(initialPayments === null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateManualPaymentFormState>(() =>
    registrationScoped ? { ...EMPTY_FORM, registrationId: registrationFilter!.trim() } : EMPTY_FORM
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [receiptForm, setReceiptForm] = useState<SubmitReceiptFormState>(EMPTY_RECEIPT_FORM);
  const [receiptFormError, setReceiptFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptUploadBusy, setReceiptUploadBusy] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "Pending" | "Paid" | "Failed" | "Cancelled"
  >("all");
  const [createResult, setCreateResult] = useState<FinancePaymentRow | null>(null);
  const [scopedInvoice, setScopedInvoice] = useState<RegistrationInvoice | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pendingReceiptPaymentIds, setPendingReceiptPaymentIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [cancelTarget, setCancelTarget] = useState<FinancePaymentRow | null>(null);
  const [cancelForm, setCancelForm] = useState<CancelPendingManualPaymentFormState>({
    reasonCode: "",
    reasonNote: "",
  });
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [cancelSaving, setCancelSaving] = useState(false);
  const createDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const advancedDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const skipInitialFetchRef = useRef(initialPayments !== null);
  const amountPrefilledForRegistrationRef = useRef<string | null>(null);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const path = withFinanceListScopeQuery("/api/finance/payments?limit=50", {
      registrationId: registrationFilter,
      tourId: tourFilter,
    });
    const receiptsPath = withFinanceListScopeQuery("/api/finance/receipts/pending?limit=100", {
      registrationId: registrationFilter,
      tourId: tourFilter,
    });
    void Promise.all([
      fetchFinanceListWithRetry(path, controller.signal).then(async (response) => {
        if (!response.ok) {
          throw new Error(`PAYMENTS_LIST_HTTP_${response.status}`);
        }
        return parseFinancePaymentsListResponse(await response.json());
      }),
      fetchFinanceListWithRetry(receiptsPath, controller.signal)
        .then(async (response) => {
          if (!response.ok) {
            return parseFinancePendingReceiptsResponse(null);
          }
          return parseFinancePendingReceiptsResponse(await response.json());
        })
        .catch(() => parseFinancePendingReceiptsResponse(null)),
    ])
      .then(([payload, receipts]) => {
        if (!controller.signal.aborted) {
          setItems(payload.items);
          setPendingReceiptPaymentIds(
            new Set(receipts.items.map((row) => row.paymentId).filter((id) => id.length > 0))
          );
          setError(null);
        }
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        setError(toFinanceClientErrorCode(fetchError, "PAYMENTS_FETCH_FAILED"));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => {
      controller.abort();
    };
  }, [fetchNonce, registrationFilter, tourFilter]);

  useEffect(() => {
    if (!registrationScoped || registrationFilter === null) {
      setScopedInvoice(null);
      return;
    }
    const id = registrationFilter.trim();
    let cancelled = false;
    void fetchRegistrationInvoice(id).then((invoice) => {
      if (!cancelled) {
        setScopedInvoice(invoice);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [registrationFilter, registrationScoped, fetchNonce]);

  useEffect(() => {
    if (registrationScoped && registrationFilter !== null) {
      setForm((current) =>
        current.registrationId.trim() === registrationFilter.trim()
          ? current
          : { ...current, registrationId: registrationFilter.trim(), amount: "" }
      );
      amountPrefilledForRegistrationRef.current = null;
    }
  }, [registrationFilter, registrationScoped]);

  useEffect(() => {
    const registrationId = form.registrationId.trim();
    if (registrationId.length < 32) {
      amountPrefilledForRegistrationRef.current = null;
      return;
    }
    if (amountPrefilledForRegistrationRef.current === registrationId) {
      return;
    }
    let cancelled = false;
    void fetchRegistrationInvoice(registrationId)
      .then((invoice) => {
        if (cancelled || invoice === null) {
          return;
        }
        amountPrefilledForRegistrationRef.current = registrationId;
        setForm((current) => {
          if (
            current.registrationId.trim() !== registrationId ||
            current.amount.trim().length > 0
          ) {
            return current;
          }
          return {
            ...current,
            amount: resolveSuggestedPaymentAmountMinor(invoice),
            currency: invoice.currency,
          };
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [form.registrationId]);

  const refresh = () => setFetchNonce((value) => value + 1);

  const visibleItems = useMemo(() => {
    if (statusFilter === "all") {
      return items;
    }
    return items.filter((row) => row.status === statusFilter);
  }, [items, statusFilter]);

  const hasVisiblePending = useMemo(
    () => visibleItems.some((row) => isFinancePaymentPendingStatus(row.status)),
    [visibleItems]
  );

  const scopedListIdentity = useMemo(() => {
    if (!registrationScoped || registrationFilter === null) {
      return null;
    }
    const id = registrationFilter.trim();
    const match = items.find(
      (row) => row.registrationId.trim() === id && row.registrationContext !== null
    );
    return match?.registrationContext ?? null;
  }, [items, registrationFilter, registrationScoped]);

  const openCreateForm = () => {
    if (createDetailsRef.current) {
      createDetailsRef.current.open = true;
      createDetailsRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handleUseForAdvancedReceipt = (paymentId: string, registrationId: string) => {
    setReceiptForm((current) => ({ ...current, paymentId }));
    setForm((current) =>
      current.registrationId.trim() === registrationId
        ? current
        : { ...current, registrationId, amount: current.amount }
    );
    setAdvancedOpen(true);
    if (advancedDetailsRef.current) {
      advancedDetailsRef.current.open = true;
    }
  };

  const openCancelDialog = (row: FinancePaymentRow) => {
    setCancelTarget(row);
    setCancelForm({ reasonCode: "", reasonNote: "" });
    setCancelError(null);
    setCancelSuccess(null);
  };

  const closeCancelDialog = () => {
    if (cancelSaving) {
      return;
    }
    setCancelTarget(null);
    setCancelForm({ reasonCode: "", reasonNote: "" });
    setCancelError(null);
  };

  const resolveCancelErrorMessage = (code: string): string => {
    switch (code) {
      case "PAYMENT_HAS_PENDING_RECEIPT":
        return t("cancelErrorPendingReceipt");
      case "PAYMENT_NOT_CANCELLABLE":
        return t("cancelErrorNotCancellable");
      case "PAYMENT_CANCEL_ONLY_MANUAL":
        return t("cancelErrorNotCancellable");
      case "PAYMENT_NOT_FOUND":
        return t("cancelErrorNotFound");
      case "PAYMENT_CANCEL_REASON_INVALID":
        return t("cancelErrorReason");
      case "REASON_REQUIRED":
        return t("cancelReasonRequired");
      case "REASON_NOTE_REQUIRED":
        return t("cancelReasonNoteRequired");
      default:
        return t("cancelErrorGeneric");
    }
  };

  const handleCancelConfirm = async () => {
    if (!canManage || cancelTarget === null) {
      return;
    }
    setCancelError(null);
    const validated = validateCancelPendingManualPaymentForm(cancelForm);
    if (!validated.ok) {
      setCancelError(resolveCancelErrorMessage(validated.error));
      return;
    }
    setCancelSaving(true);
    try {
      const idempotencyKey = createFinanceIdempotencyKey(`cancel-${cancelTarget.id}`);
      const response = await fetch(buildCancelPendingManualPaymentPath(cancelTarget.id), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(buildCancelPendingManualPaymentRequestBody(validated.value)),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        const mapped = mapCancelPendingManualPaymentHttpError(response.status, raw);
        setCancelError(resolveCancelErrorMessage(mapped));
        refresh();
        return;
      }
      const parsed = parseCancelPendingManualPaymentResponse(raw);
      const nextStatus = parsed?.status === "Cancelled" ? "Cancelled" : "Cancelled";
      setItems((current) =>
        current.map((row) =>
          row.id === cancelTarget.id ? { ...row, status: nextStatus, paidAt: null } : row
        )
      );
      setCancelSuccess(t("cancelSuccess"));
      invalidateFinanceRegistrationCaches(cancelTarget.registrationId);
      setCancelTarget(null);
      setCancelForm({ reasonCode: "", reasonNote: "" });
      refresh();
    } catch {
      setCancelError(t("cancelErrorGeneric"));
    } finally {
      setCancelSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setFormError(null);
    const validated = validateCreateManualPaymentForm(form);
    if (!validated.ok) {
      setFormError(validated.error);
      return;
    }
    setSaving(true);
    try {
      const idempotencyKey = createClientSafeUuid();
      const response = await fetch("/api/finance/payments/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(buildCreateManualPaymentRequestBody(validated.value)),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`MANUAL_PAYMENT_HTTP_${response.status}`);
      }
      const created = parseFinanceManualPaymentCreateResponse(raw);
      setCreateResult(
        created ?? {
          id: "",
          registrationId: validated.value.registrationId,
          amount: validated.value.amount,
          currency: validated.value.currency,
          method: "Manual",
          status: "Pending",
          provider: "manual",
          paidAt: null,
          createdAt: new Date().toISOString(),
          registrationContext: null,
        }
      );
      // PR21-F4 — drop Booking Strip invoice/payments cache for this registration only.
      invalidateFinanceRegistrationCaches(validated.value.registrationId);
      setForm(
        registrationScoped && registrationFilter
          ? { ...EMPTY_FORM, registrationId: registrationFilter.trim() }
          : EMPTY_FORM
      );
      amountPrefilledForRegistrationRef.current = null;
      refresh();
    } catch (submitError: unknown) {
      setFormError(toFinanceClientErrorCode(submitError, "MANUAL_PAYMENT_FAILED"));
    } finally {
      setSaving(false);
    }
  };

  const handleReceiptSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setReceiptFormError(null);
    const validated = validateSubmitReceiptForm(receiptForm);
    if (!validated.ok) {
      setReceiptFormError(validated.error);
      return;
    }
    setReceiptSaving(true);
    try {
      const idempotencyKey = createClientSafeUuid();
      const response = await fetch("/api/finance/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(buildSubmitReceiptRequestBody(validated.value)),
      });
      if (!response.ok) {
        throw new Error(`SUBMIT_RECEIPT_HTTP_${response.status}`);
      }
      setReceiptForm(EMPTY_RECEIPT_FORM);
      setAdvancedOpen(false);
      refresh();
    } catch (submitError: unknown) {
      setReceiptFormError(toFinanceClientErrorCode(submitError, "SUBMIT_RECEIPT_FAILED"));
    } finally {
      setReceiptSaving(false);
    }
  };

  const emptyMessage = (() => {
    if (statusFilter !== "all" && items.length > 0 && visibleItems.length === 0) {
      return { key: "emptyFiltered" as const, testId: FINANCE_PAYMENTS_TEST_IDS.emptyFiltered };
    }
    if (registrationScoped && items.length === 0) {
      return {
        key: "emptyRegistration" as const,
        testId: FINANCE_PAYMENTS_TEST_IDS.emptyRegistration,
      };
    }
    return { key: "empty" as const, testId: undefined };
  })();

  const createFormCard = canManage ? (
    <Card data-operator-surface="card" className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("createManual")}</CardTitle>
        <p className="text-sm font-normal text-muted-foreground">{t("createManualHint")}</p>
      </CardHeader>
      <CardContent>
        <details ref={createDetailsRef} data-testid={FINANCE_PAYMENTS_TEST_IDS.createDetails}>
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            {t("createManualShow")}
          </summary>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            data-testid={FINANCE_PAYMENTS_TEST_IDS.createForm}
            onSubmit={handleSubmit}
          >
            <div className="space-y-2 sm:col-span-2">
              <FinanceRegistrationPicker
                id="payment-registration-id"
                value={form.registrationId}
                onChange={(registrationId) =>
                  setForm((current) => ({ ...current, registrationId }))
                }
              />
              <FinanceInvoiceBalanceCard registrationId={form.registrationId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-amount">{tCommon("amountDisplay")}</Label>
              <LocalizedNumericInput
                id="payment-amount"
                mode="digits"
                groupThousands
                value={form.amount}
                onChange={(amount) => setForm((current) => ({ ...current, amount }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-currency">{tCommon("currency")}</Label>
              <Input
                id="payment-currency"
                value={form.currency}
                onChange={(event) =>
                  setForm((current) => ({ ...current, currency: event.target.value }))
                }
                maxLength={8}
              />
            </div>
            {formError ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {localizeFinanceMessage(tValidation, tErrors, formError)}
              </p>
            ) : null}
            <div className="sm:col-span-2 space-y-2">
              <p className="text-xs text-muted-foreground">{t("createDoesNotSettle")}</p>
              <Button type="submit" disabled={saving}>
                {saving ? t("creating") : t("createButton")}
              </Button>
            </div>
          </form>
        </details>
      </CardContent>
    </Card>
  ) : null;

  const advancedReceiptCard = canManage ? (
    <Card data-operator-surface="card" className="shadow-sm border-dashed opacity-95">
      <CardHeader>
        <CardTitle className="text-base">{t("submitReceiptAdvanced")}</CardTitle>
        <p className="text-sm font-normal text-muted-foreground">{t("submitReceiptHint")}</p>
      </CardHeader>
      <CardContent>
        <details
          ref={advancedDetailsRef}
          open={advancedOpen}
          data-testid="finance-submit-receipt-advanced"
          onToggle={(event) => {
            setAdvancedOpen((event.target as HTMLDetailsElement).open);
          }}
        >
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            {t("submitReceiptShowAdvanced")}
          </summary>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            data-testid={FINANCE_PAYMENTS_TEST_IDS.receiptForm}
            onSubmit={handleReceiptSubmit}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="receipt-payment-id">{t("paymentId")}</Label>
              <Input
                id="receipt-payment-id"
                value={receiptForm.paymentId}
                onChange={(event) =>
                  setReceiptForm((current) => ({ ...current, paymentId: event.target.value }))
                }
                autoComplete="off"
                readOnly={receiptForm.paymentId.length > 0}
              />
              <p className="text-xs text-muted-foreground">{t("paymentIdPrefillHint")}</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="receipt-upload">{t("receiptUpload")}</Label>
              <Input
                id="receipt-upload"
                type="file"
                accept="image/*,application/pdf"
                data-testid={FINANCE_PAYMENTS_TEST_IDS.receiptUploadInput}
                disabled={receiptUploadBusy || form.registrationId.trim().length < 32}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file === undefined) {
                    return;
                  }
                  const registrationId = form.registrationId.trim();
                  if (registrationId.length < 32) {
                    setReceiptUploadError("REGISTRATION_ID_INVALID");
                    return;
                  }
                  setReceiptUploadError(null);
                  setReceiptUploadBusy(true);
                  void uploadFinanceReceiptProof({ registrationId, file })
                    .then((fileKey) => {
                      if (fileKey === null) {
                        throw new Error("RECEIPT_UPLOAD_FAILED");
                      }
                      setReceiptForm((current) => ({ ...current, fileKey }));
                    })
                    .catch((uploadError: unknown) => {
                      setReceiptUploadError(
                        uploadError instanceof Error ? uploadError.message : "RECEIPT_UPLOAD_FAILED"
                      );
                    })
                    .finally(() => {
                      setReceiptUploadBusy(false);
                    });
                }}
              />
              <p className="text-xs text-muted-foreground">{t("receiptUploadHint")}</p>
              {receiptUploadError !== null ? (
                <p className="text-xs text-destructive" role="alert">
                  {localizeFinanceMessage(tValidation, tErrors, receiptUploadError)}
                </p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="receipt-file-key">{t("fileKey")}</Label>
              <Input
                id="receipt-file-key"
                value={receiptForm.fileKey}
                onChange={(event) =>
                  setReceiptForm((current) => ({ ...current, fileKey: event.target.value }))
                }
                placeholder={t("fileKeyPlaceholder")}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="receipt-note">{tCommon("optionalNote")}</Label>
              <Input
                id="receipt-note"
                value={receiptForm.note}
                onChange={(event) =>
                  setReceiptForm((current) => ({ ...current, note: event.target.value }))
                }
              />
            </div>
            {receiptFormError ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {localizeFinanceMessage(tValidation, tErrors, receiptFormError)}
              </p>
            ) : null}
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" disabled={receiptSaving} variant="secondary">
                {receiptSaving ? t("submitting") : t("submitButton")}
              </Button>
              {receiptForm.paymentId.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReceiptForm(EMPTY_RECEIPT_FORM)}
                >
                  {t("clearSelectedPayment")}
                </Button>
              ) : null}
            </div>
          </form>
        </details>
      </CardContent>
    </Card>
  ) : null;

  return (
    <div className="space-y-6" data-testid={FINANCE_PAYMENTS_TEST_IDS.panel}>
      {createResult !== null ? (
        <p
          className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
          role="status"
          data-testid={FINANCE_PAYMENTS_TEST_IDS.createResult}
          data-payment-status={createResult.status}
        >
          <span className="font-medium">{t("createResultTitle")}</span>
          {" — "}
          {formatMinorAmount(createResult.amount, createResult.currency, locale)}
          {" · "}
          {resolveFinancePaymentStatusLabel(t, createResult.status || "Pending")}
          {" · "}
          {t("createResultNext")}
          {createResult.registrationId.length >= 32 ? (
            <>
              {" "}
              <Link
                href={buildFinancePaymentReceiptsHref(createResult.registrationId)}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {t("createResultOpenReceipts")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <Card data-operator-surface="card" className="shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">{t("listTitle")}</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">{t("listScopeHint")}</p>
            <p
              className="text-xs font-normal text-muted-foreground"
              data-testid={FINANCE_PAYMENTS_TEST_IDS.settlementHint}
            >
              {t("settlementHint")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid={FINANCE_PAYMENTS_TEST_IDS.createOpen}
                onClick={openCreateForm}
              >
                {t("createManual")}
              </Button>
            ) : null}
            <Label htmlFor="payments-status-filter" className="sr-only">
              {t("statusFilter")}
            </Label>
            <select
              id="payments-status-filter"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | "Pending" | "Paid" | "Failed" | "Cancelled"
                )
              }
              data-testid="finance-payments-status-filter"
            >
              <option value="all">{t("statusFilterAll")}</option>
              <option value="Pending">{resolveFinancePaymentStatusLabel(t, "Pending")}</option>
              <option value="Paid">{resolveFinancePaymentStatusLabel(t, "Paid")}</option>
              <option value="Cancelled">{resolveFinancePaymentStatusLabel(t, "Cancelled")}</option>
              <option value="Failed">{resolveFinancePaymentStatusLabel(t, "Failed")}</option>
            </select>
            <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
              {tCommon("refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {registrationScoped && scopedListIdentity !== null ? (
            <p
              className="text-sm font-medium text-foreground"
              data-testid={FINANCE_PAYMENTS_TEST_IDS.scopedIdentity}
            >
              {scopedListIdentity.memberDisplayName}
              {" · "}
              {scopedListIdentity.tourTitle}
            </p>
          ) : null}
          {registrationScoped && scopedInvoice !== null ? (
            <RegistrationObligationGlance invoice={scopedInvoice} />
          ) : null}
          {hasVisiblePending ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid={FINANCE_PAYMENTS_TEST_IDS.pendingMeaning}
            >
              {t("pendingPaymentMeaning")}
            </p>
          ) : null}
          {loading ? (
            <div className="space-y-2" data-testid="finance-payments-loading">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : null}
          {!loading && error ? (
            <p className="text-sm text-destructive" role="alert">
              {localizeFinanceMessage(tValidation, tErrors, error)}
            </p>
          ) : null}
          {!loading && !error && visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid={emptyMessage.testId}>
              {t(emptyMessage.key)}
            </p>
          ) : null}
          {cancelSuccess ? (
            <p
              className="text-sm text-muted-foreground"
              role="status"
              data-testid={FINANCE_PAYMENTS_TEST_IDS.cancelSuccess}
            >
              {cancelSuccess}
            </p>
          ) : null}
          {!loading && !error && visibleItems.length > 0 ? (
            <ul className="divide-y rounded-md border" data-testid={FINANCE_PAYMENTS_TEST_IDS.list}>
              {visibleItems.map((row) => (
                <PaymentRow
                  key={row.id}
                  row={row}
                  locale={locale}
                  statusLabel={resolveFinancePaymentStatusLabel(t, row.status)}
                  methodLabel={resolvePaymentMethodLabel(t, row.method)}
                  canManage={canManage}
                  canCancel={
                    canManage &&
                    isManualPendingPaymentCancellable({
                      method: row.method,
                      status: row.status,
                      hasPendingReceipt: pendingReceiptPaymentIds.has(row.id),
                    })
                  }
                  onUseForAdvancedReceipt={handleUseForAdvancedReceipt}
                  onCancel={openCancelDialog}
                />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {createFormCard}
      {advancedReceiptCard}

      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeCancelDialog();
          }
        }}
      >
        <DialogContent data-testid={FINANCE_PAYMENTS_TEST_IDS.cancelDialog}>
          <DialogHeader>
            <DialogTitle>{t("cancelDialogTitle")}</DialogTitle>
            <DialogDescription>{t("cancelDialogBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="finance-payment-cancel-reason">{t("cancelReasonLabel")}</Label>
              <select
                id="finance-payment-cancel-reason"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={cancelForm.reasonCode}
                data-testid={FINANCE_PAYMENTS_TEST_IDS.cancelReason}
                onChange={(event) =>
                  setCancelForm((current) => ({
                    ...current,
                    reasonCode: event.target
                      .value as CancelPendingManualPaymentFormState["reasonCode"],
                  }))
                }
              >
                <option value="">{t("cancelReasonPlaceholder")}</option>
                {MANUAL_PAYMENT_CANCEL_REASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {t(`cancelReason.${code}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="finance-payment-cancel-note">{t("cancelNoteLabel")}</Label>
              <Input
                id="finance-payment-cancel-note"
                value={cancelForm.reasonNote}
                data-testid={FINANCE_PAYMENTS_TEST_IDS.cancelNote}
                placeholder={t("cancelNotePlaceholder")}
                onChange={(event) =>
                  setCancelForm((current) => ({
                    ...current,
                    reasonNote: event.target.value,
                  }))
                }
              />
            </div>
            {cancelError ? (
              <p
                className="text-sm text-destructive"
                role="alert"
                data-testid={FINANCE_PAYMENTS_TEST_IDS.cancelError}
              >
                {cancelError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeCancelDialog}
              disabled={cancelSaving}
            >
              {t("cancelDismiss")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-testid={FINANCE_PAYMENTS_TEST_IDS.cancelConfirm}
              onClick={() => {
                void handleCancelConfirm();
              }}
              disabled={cancelSaving}
            >
              {cancelSaving ? t("cancelSubmitting") : t("cancelConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
