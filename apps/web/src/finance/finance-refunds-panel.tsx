"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppSearchParams } from "@/navigation/app-navigation-hooks";

import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FINANCE_REFUNDS_TEST_IDS,
  REFUND_STATUSES,
  mapRefundMutationHttpError,
  parseFinanceRefundsResponse,
  refundActionsForStatus,
  refundOutstandingHref,
  refundPaymentsHref,
  refundSourceI18nKey,
  refundStatusI18nKey,
  type FinanceRefundListItem,
  type RefundSourceKind,
  type RefundStatus,
} from "@/finance/finance-refunds-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import { FinanceRegistrationIdentity } from "@/finance/finance-registration-identity";
import { formatFinanceTimestamp } from "@/finance/finance-reports-logic";
import type { AppLocale } from "@/i18n/routing";

function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function FinanceRefundsPanel() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.refunds");
  const tCommon = useTranslations("finance.common");
  const searchParams = useAppSearchParams();
  const registrationFilter = searchParams.get("registrationId")?.trim() || "";
  const paymentPrefill = searchParams.get("paymentId")?.trim() || "";
  const amountPrefill = searchParams.get("amountMinor")?.trim() || "";
  const currencyPrefill = searchParams.get("currency")?.trim().toUpperCase() || "";

  const [items, setItems] = useState<readonly FinanceRefundListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | RefundStatus>("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [completeHandoff, setCompleteHandoff] = useState<{
    readonly registrationId: string;
    readonly showOutstanding: boolean;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completeConfirmId, setCompleteConfirmId] = useState<string | null>(null);

  const [reqRegistrationId, setReqRegistrationId] = useState(registrationFilter);
  const [reqSourceKind, setReqSourceKind] = useState<RefundSourceKind>("payment");
  const [reqPaymentId, setReqPaymentId] = useState(paymentPrefill);
  const [reqAmount, setReqAmount] = useState(amountPrefill);
  const [reqReasonCode, setReqReasonCode] = useState("overpayment");
  const [reqReasonNote, setReqReasonNote] = useState("");
  const [showAdvancedRequest, setShowAdvancedRequest] = useState(
    () => paymentPrefill.length > 0 || amountPrefill.length > 0
  );

  useEffect(() => {
    if (registrationFilter) {
      setReqRegistrationId(registrationFilter);
    }
    if (paymentPrefill) {
      setReqPaymentId(paymentPrefill);
      setReqSourceKind("payment");
      setShowAdvancedRequest(true);
    }
    if (amountPrefill) {
      setReqAmount(amountPrefill);
    }
  }, [registrationFilter, paymentPrefill, amountPrefill]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "50");
      if (registrationFilter) {
        qs.set("registrationId", registrationFilter);
      }
      if (statusFilter) {
        qs.set("status", statusFilter);
      }
      const res = await fetch(`/api/finance/refunds?${qs.toString()}`, {
        credentials: "include",
      });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        setError(t("fetchFailed"));
        setItems([]);
        return;
      }
      const page = parseFinanceRefundsResponse(raw);
      setItems(page.items);
    } catch {
      setError(t("fetchFailed"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [registrationFilter, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusLabel = useCallback(
    (status: RefundStatus) => t(refundStatusI18nKey(status) as "statusRequested"),
    [t]
  );

  const runMutation = useCallback(
    async (refundId: string, path: string, body?: Record<string, unknown>, idempotent = false) => {
      setBusyId(refundId);
      setActionError(null);
      setCompleteHandoff(null);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (idempotent) {
          headers["Idempotency-Key"] = newIdempotencyKey("refund");
        }
        const res = await fetch(path, {
          method: "POST",
          credentials: "include",
          headers,
          body: body !== undefined ? JSON.stringify(body) : JSON.stringify({}),
        });
        const raw = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) {
          const code = mapRefundMutationHttpError(res.status, raw);
          setActionError(t(`errors.${code}` as "errors.REFUND_OVER_CAP"));
          setActionSuccess(null);
          setCompleteHandoff(null);
          await load();
          return;
        }
        setCompleteConfirmId(null);
        if (path.endsWith("/complete") && raw !== null && typeof raw === "object") {
          const responseBody = raw as Record<string, unknown>;
          const invoice =
            responseBody.invoice !== null && typeof responseBody.invoice === "object"
              ? (responseBody.invoice as Record<string, unknown>)
              : null;
          const fromList = items.find((row) => row.id === refundId);
          const registrationId =
            (typeof responseBody.registrationId === "string" &&
            responseBody.registrationId.trim().length > 0
              ? responseBody.registrationId.trim()
              : null) ??
            fromList?.registrationId ??
            null;
          if (
            invoice &&
            typeof invoice.remainingMinor === "string" &&
            typeof invoice.currency === "string"
          ) {
            const remaining = formatMinorAmount(invoice.remainingMinor, invoice.currency, locale);
            const remainingDigits = invoice.remainingMinor.replace(/\D/g, "");
            const reopened = remainingDigits.length > 0 && remainingDigits !== "0";
            setActionSuccess(
              reopened
                ? t("completeSuccessReopened", { remaining })
                : t("completeSuccessSettled", { remaining })
            );
            if (registrationId) {
              setCompleteHandoff({
                registrationId,
                showOutstanding: reopened,
              });
            } else {
              setCompleteHandoff(null);
            }
          } else {
            setActionSuccess(t("completeSuccess"));
            setCompleteHandoff(registrationId ? { registrationId, showOutstanding: false } : null);
          }
        } else {
          setActionSuccess(null);
          setCompleteHandoff(null);
        }
        await load();
      } catch {
        setActionError(t("errors.REFUND_MUTATION_FAILED"));
        setActionSuccess(null);
        setCompleteHandoff(null);
      } finally {
        setBusyId(null);
      }
    },
    [items, load, locale, t]
  );

  const submitRequest = useCallback(async () => {
    setActionError(null);
    setBusyId("request");
    try {
      const body: Record<string, unknown> = {
        registrationId: reqRegistrationId.trim(),
        sourceKind: reqSourceKind,
        amountMinor: reqAmount.trim(),
        reasonCode: reqReasonCode,
      };
      if (reqSourceKind === "payment") {
        body.paymentId = reqPaymentId.trim();
      }
      if (reqReasonCode === "other" && reqReasonNote.trim()) {
        body.reasonNote = reqReasonNote.trim();
      } else if (reqReasonNote.trim()) {
        body.reasonNote = reqReasonNote.trim();
      }
      const res = await fetch("/api/finance/refunds", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": newIdempotencyKey("refund-request"),
        },
        body: JSON.stringify(body),
      });
      const raw = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const code = mapRefundMutationHttpError(res.status, raw);
        setActionError(t(`errors.${code}` as "errors.REFUND_OVER_CAP"));
        await load();
        return;
      }
      setReqAmount("");
      setReqPaymentId("");
      await load();
    } catch {
      setActionError(t("errors.REFUND_MUTATION_FAILED"));
    } finally {
      setBusyId(null);
    }
  }, [
    load,
    reqAmount,
    reqPaymentId,
    reqReasonCode,
    reqReasonNote,
    reqRegistrationId,
    reqSourceKind,
    t,
  ]);

  const empty = useMemo(
    () => !loading && items.length === 0 && error === null,
    [loading, items.length, error]
  );

  return (
    <div className="space-y-4" data-testid={FINANCE_REFUNDS_TEST_IDS.panel}>
      <Card data-operator-surface="card" className="shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">{t("title")}</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="finance-refund-status-filter" className="sr-only">
              {t("statusFilter")}
            </Label>
            <select
              id="finance-refund-status-filter"
              data-testid={FINANCE_REFUNDS_TEST_IDS.statusFilter}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target.value || "") as "" | RefundStatus)}
            >
              <option value="">{t("statusAll")}</option>
              {REFUND_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              data-testid={FINANCE_REFUNDS_TEST_IDS.refresh}
            >
              {tCommon("refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t("moneyGateHint")}</p>

          {actionSuccess ? (
            <div
              className="space-y-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2"
              role="status"
              data-testid={FINANCE_REFUNDS_TEST_IDS.completeSuccess}
            >
              <p className="text-sm">{actionSuccess}</p>
              {completeHandoff ? (
                <div className="flex flex-wrap gap-3 text-sm">
                  {completeHandoff.showOutstanding ? (
                    <Link
                      href={refundOutstandingHref(completeHandoff.registrationId)}
                      className="font-medium text-primary hover:underline"
                      data-testid={FINANCE_REFUNDS_TEST_IDS.openOutstanding}
                    >
                      {t("viewOutstanding")}
                    </Link>
                  ) : null}
                  <Link
                    href={refundPaymentsHref(completeHandoff.registrationId)}
                    className="text-muted-foreground hover:underline"
                    data-testid={FINANCE_REFUNDS_TEST_IDS.completeOpenPayments}
                  >
                    {t("openPaymentsForRegistration")}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
          {actionError ? (
            <p
              className="text-sm text-destructive"
              role="alert"
              data-testid={FINANCE_REFUNDS_TEST_IDS.error}
            >
              {actionError}
            </p>
          ) : null}

          <form
            className="space-y-3 rounded-md border p-3"
            data-testid={FINANCE_REFUNDS_TEST_IDS.requestForm}
            onSubmit={(e) => {
              e.preventDefault();
              void submitRequest();
            }}
          >
            <p className="text-sm font-medium">{t("requestTitle")}</p>
            {paymentPrefill ? (
              <p className="text-xs text-muted-foreground">{t("requestFromPaymentHint")}</p>
            ) : null}
            {reqAmount.trim().length > 0 && currencyPrefill.length > 0 ? (
              <p
                className="text-lg font-semibold tabular-nums"
                data-testid={FINANCE_REFUNDS_TEST_IDS.amountHero}
              >
                {formatMinorAmount(reqAmount.trim(), currencyPrefill, locale)}
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="refund-source">{t("sourceKind")}</Label>
                <select
                  id="refund-source"
                  className="flex h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={reqSourceKind}
                  onChange={(e) => setReqSourceKind(e.target.value as RefundSourceKind)}
                >
                  <option value="payment">{t("sourcePayment")}</option>
                  <option value="prepayment">{t("sourcePrepayment")}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="refund-amount">{t("amountAdjust")}</Label>
                <Input
                  id="refund-amount"
                  value={reqAmount}
                  onChange={(e) => setReqAmount(e.target.value)}
                  required
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">{t("amountServerCapHint")}</p>
              </div>
              {reqSourceKind === "prepayment" ? (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  {t("prepaymentExplicit")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  {t("paymentMustBePaid")}
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="refund-reason">{t("reasonCode")}</Label>
                <select
                  id="refund-reason"
                  className="flex h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={reqReasonCode}
                  onChange={(e) => setReqReasonCode(e.target.value)}
                >
                  <option value="member_withdrawal">{t("reasonMemberWithdrawal")}</option>
                  <option value="overpayment">{t("reasonOverpayment")}</option>
                  <option value="ops_correction">{t("reasonOpsCorrection")}</option>
                  <option value="other">{t("reasonOther")}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="refund-note">{t("reasonNote")}</Label>
                <Input
                  id="refund-note"
                  value={reqReasonNote}
                  onChange={(e) => setReqReasonNote(e.target.value)}
                />
              </div>
            </div>
            <details
              className="rounded-md border border-dashed p-2"
              open={showAdvancedRequest}
              onToggle={(e) => setShowAdvancedRequest((e.target as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {t("requestAdvancedIds")}
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="refund-reg">{t("registrationId")}</Label>
                  <Input
                    id="refund-reg"
                    value={reqRegistrationId}
                    onChange={(e) => setReqRegistrationId(e.target.value)}
                    required
                  />
                </div>
                {reqSourceKind === "payment" ? (
                  <div className="space-y-1">
                    <Label htmlFor="refund-payment">{t("paymentId")}</Label>
                    <Input
                      id="refund-payment"
                      value={reqPaymentId}
                      onChange={(e) => setReqPaymentId(e.target.value)}
                      required
                    />
                  </div>
                ) : null}
              </div>
            </details>
            <Button type="submit" size="sm" disabled={busyId === "request"}>
              {t("requestSubmit")}
            </Button>
          </form>

          {loading ? (
            <div data-testid={FINANCE_REFUNDS_TEST_IDS.loading} className="space-y-2">
              <OperatorSkeleton size="user-card" />
              <OperatorSkeleton size="user-card" />
            </div>
          ) : null}

          {!loading && error ? (
            <div data-testid={FINANCE_REFUNDS_TEST_IDS.error} className="space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                {tCommon("refresh")}
              </Button>
            </div>
          ) : null}

          {empty ? (
            <p
              data-testid={FINANCE_REFUNDS_TEST_IDS.empty}
              className="text-sm text-muted-foreground"
            >
              {t("empty")}
            </p>
          ) : null}

          {!loading && items.length > 0 ? (
            <ul className="space-y-3" data-testid={FINANCE_REFUNDS_TEST_IDS.list}>
              {items.map((item) => {
                const actions = refundActionsForStatus(item.status);
                const confirming = completeConfirmId === item.id;
                return (
                  <li
                    key={item.id}
                    className="space-y-2 rounded-md border p-3"
                    data-testid={FINANCE_REFUNDS_TEST_IDS.item}
                    data-refund-id={item.id}
                    data-status={item.status}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <FinanceRegistrationIdentity
                        registrationId={item.registrationId}
                        context={
                          item.identity.memberDisplayName &&
                          item.identity.tourTitle &&
                          item.identity.tourId
                            ? {
                                registrationId: item.registrationId,
                                memberDisplayName: item.identity.memberDisplayName,
                                tourTitle: item.identity.tourTitle,
                                tourId: item.identity.tourId,
                              }
                            : null
                        }
                      />
                      <Badge data-testid={FINANCE_REFUNDS_TEST_IDS.status} variant="secondary">
                        {statusLabel(item.status)}
                      </Badge>
                    </div>
                    <p
                      className="text-sm"
                      data-testid={FINANCE_REFUNDS_TEST_IDS.source}
                      data-source-kind={item.sourceKind}
                    >
                      {t(refundSourceI18nKey(item.sourceKind) as "sourcePayment")}
                      {item.sourceKind === "payment" && item.linkedPayment ? (
                        <span className="ms-1 text-muted-foreground">
                          ({t("linkedPaidPayment")}:{" "}
                          {formatMinorAmount(
                            item.linkedPayment.amount,
                            item.linkedPayment.currency,
                            locale
                          )}{" "}
                          · {item.linkedPayment.status})
                        </span>
                      ) : null}
                    </p>
                    <p
                      className="text-sm font-medium"
                      data-testid={FINANCE_REFUNDS_TEST_IDS.amount}
                    >
                      {formatMinorAmount(item.amountMinor, item.currency, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("reasonLabel")}: {item.reasonCode}
                      {item.reasonNote ? ` — ${item.reasonNote}` : ""}
                    </p>
                    {item.evidenceFileKey ? (
                      <p className="text-xs text-muted-foreground">
                        {t("evidenceKey")}: <code>{item.evidenceFileKey}</code>
                      </p>
                    ) : null}
                    {item.invoice ? (
                      <p
                        className="text-xs text-muted-foreground"
                        data-testid={FINANCE_REFUNDS_TEST_IDS.invoice}
                      >
                        {t("invoiceSnapshot", {
                          refunded: formatMinorAmount(
                            item.invoice.refundedMinor,
                            item.invoice.currency,
                            locale
                          ),
                          remaining: formatMinorAmount(
                            item.invoice.remainingMinor,
                            item.invoice.currency,
                            locale
                          ),
                        })}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {t("requestedAt")}: {formatFinanceTimestamp(item.requestedAt, locale)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={item.href.payments}
                          data-testid={FINANCE_REFUNDS_TEST_IDS.openPayments}
                        >
                          {t("openPayments")}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={item.href.receipts}
                          data-testid={FINANCE_REFUNDS_TEST_IDS.openReceipts}
                        >
                          {t("openReceipts")}
                        </Link>
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {actions.approve ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          data-testid={FINANCE_REFUNDS_TEST_IDS.approve}
                          disabled={busyId === item.id}
                          onClick={() =>
                            void runMutation(item.id, `/api/finance/refunds/${item.id}/approve`)
                          }
                        >
                          {t("actionApprove")}
                        </Button>
                      ) : null}
                      {actions.complete ? (
                        confirming ? (
                          <div
                            className="w-full space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2"
                            data-testid={FINANCE_REFUNDS_TEST_IDS.completeConfirm}
                          >
                            <p className="text-xs">{t("completeConfirmBody")}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("completeConfirmAmount")}:{" "}
                              {formatMinorAmount(item.amountMinor, item.currency, locale)} ·{" "}
                              {t(refundSourceI18nKey(item.sourceKind) as "sourcePayment")}
                            </p>
                            {item.sourceKind === "payment" && item.linkedPayment ? (
                              <p className="text-xs text-muted-foreground">
                                {t("linkedPaidPayment")}: {item.linkedPayment.id} ·{" "}
                                {formatMinorAmount(
                                  item.linkedPayment.amount,
                                  item.linkedPayment.currency,
                                  locale
                                )}{" "}
                                · {item.linkedPayment.status}
                              </p>
                            ) : null}
                            {item.sourceKind === "prepayment" ? (
                              <p className="text-xs text-muted-foreground">
                                {t("prepaymentExplicit")}
                              </p>
                            ) : null}
                            {item.invoice ? (
                              <p className="text-xs text-muted-foreground">
                                {t("completeConfirmInvoiceHint")} ·{" "}
                                {t("invoiceSnapshot", {
                                  refunded: formatMinorAmount(
                                    item.invoice.refundedMinor,
                                    item.invoice.currency,
                                    locale
                                  ),
                                  remaining: formatMinorAmount(
                                    item.invoice.remainingMinor,
                                    item.invoice.currency,
                                    locale
                                  ),
                                })}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                data-testid={FINANCE_REFUNDS_TEST_IDS.complete}
                                disabled={busyId === item.id}
                                onClick={() =>
                                  void runMutation(
                                    item.id,
                                    `/api/finance/refunds/${item.id}/complete`,
                                    {}
                                  )
                                }
                              >
                                {t("actionCompleteConfirm")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setCompleteConfirmId(null)}
                              >
                                {t("dismiss")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            data-testid={FINANCE_REFUNDS_TEST_IDS.complete}
                            disabled={busyId === item.id}
                            onClick={() => setCompleteConfirmId(item.id)}
                          >
                            {t("actionComplete")}
                          </Button>
                        )
                      ) : null}
                      {actions.reject ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          data-testid={FINANCE_REFUNDS_TEST_IDS.reject}
                          disabled={busyId === item.id}
                          onClick={() =>
                            void runMutation(item.id, `/api/finance/refunds/${item.id}/reject`, {})
                          }
                        >
                          {t("actionReject")}
                        </Button>
                      ) : null}
                      {actions.cancel ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          data-testid={FINANCE_REFUNDS_TEST_IDS.cancel}
                          disabled={busyId === item.id}
                          onClick={() =>
                            void runMutation(item.id, `/api/finance/refunds/${item.id}/cancel`)
                          }
                        >
                          {t("actionCancel")}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
