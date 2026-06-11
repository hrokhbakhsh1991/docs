"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalizedDatetimePicker } from "@/components/i18n/localized-datetime-picker";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import {
  FINANCE_INSTALLMENTS_TEST_IDS,
  INSTALLMENT_BOARD_COLUMNS,
  groupInstallmentsByBoardColumn,
  installmentProgressPercent,
  parseSchedulesListResponse,
  validateGenerateScheduleForm,
  type GenerateScheduleFormState,
  type PaymentScheduleItem,
} from "@/finance/finance-installments-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage } from "@/i18n/resolve-finance-error-message";

type FinanceInstallmentsPanelProps = {
  readonly session: OperatorSessionContext;
};

const EMPTY_GENERATE_FORM: GenerateScheduleFormState = {
  registrationId: "",
  invoiceTotalMinor: "",
  depositPercent: "30",
  installmentCount: "3",
  firstDueAt: "",
  currency: "IRR",
};

function resolveInstallmentStatusLabel(t: (key: string) => string, status: string): string {
  try {
    return t(`status.${status}`);
  } catch {
    return status;
  }
}

function ScheduleCard({ item }: { readonly item: PaymentScheduleItem }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.installments");
  const tCommon = useTranslations("finance.common");
  const progress = installmentProgressPercent(item);
  const dueDate = new Date(item.dueAt).toLocaleDateString(
    locale === "fa" ? "fa-IR" : "en-US"
  );
  return (
    <div className="rounded-md border bg-background p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{item.label}</p>
          <p className="font-mono text-xs text-muted-foreground">{item.registrationId.slice(0, 8)}…</p>
        </div>
        <Badge variant="outline">{resolveInstallmentStatusLabel(t, item.status)}</Badge>
      </div>
      <p className="mt-2 font-medium">{formatMinorAmount(item.amountMinor, "IRR", locale)}</p>
      <p className="text-xs text-muted-foreground">{tCommon("due", { date: dueDate })}</p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        data-denali-finance-progress
      >
        <div
          className="h-full transition-all"
          style={{ width: `${progress}%` }}
          aria-label={tCommon("paidPercent", { percent: progress })}
        />
      </div>
    </div>
  );
}

export function FinanceInstallmentsPanel({ session }: FinanceInstallmentsPanelProps) {
  const t = useTranslations("finance.installments");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const canManage = isAdminOrOwnerRole(session.role);
  const [items, setItems] = useState<readonly PaymentScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<GenerateScheduleFormState>(EMPTY_GENERATE_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/finance/schedules", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`SCHEDULES_LIST_HTTP_${response.status}`);
        }
        return parseSchedulesListResponse(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "SCHEDULES_FETCH_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchNonce]);

  const board = useMemo(() => groupInstallmentsByBoardColumn(items), [items]);
  const refresh = () => setFetchNonce((value) => value + 1);

  const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setFormError(null);
    const validated = validateGenerateScheduleForm(form);
    if (!validated.ok) {
      setFormError(validated.error);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/finance/schedules/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.value),
      });
      if (!response.ok) {
        throw new Error(`SCHEDULE_GENERATE_HTTP_${response.status}`);
      }
      setForm(EMPTY_GENERATE_FORM);
      refresh();
    } catch (submitError: unknown) {
      setFormError(
        submitError instanceof Error ? submitError.message : "SCHEDULE_GENERATE_FAILED"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={FINANCE_INSTALLMENTS_TEST_IDS.panel}>
      {canManage ? (
        <Card data-denali-surface="card" className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("generateTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              data-testid={FINANCE_INSTALLMENTS_TEST_IDS.generateForm}
              onSubmit={handleGenerate}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schedule-registration-id">{tCommon("registrationId")}</Label>
                <Input
                  id="schedule-registration-id"
                  value={form.registrationId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, registrationId: event.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-invoice-total">{t("invoiceTotalMinor")}</Label>
                <LocalizedNumericInput
                  id="schedule-invoice-total"
                  mode="digits"
                  value={form.invoiceTotalMinor}
                  onChange={(invoiceTotalMinor) =>
                    setForm((current) => ({ ...current, invoiceTotalMinor }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-deposit">{t("depositPercent")}</Label>
                <LocalizedNumericInput
                  id="schedule-deposit"
                  mode="digits"
                  value={form.depositPercent}
                  onChange={(depositPercent) =>
                    setForm((current) => ({ ...current, depositPercent }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-count">{t("installmentCount")}</Label>
                <LocalizedNumericInput
                  id="schedule-count"
                  mode="digits"
                  value={form.installmentCount}
                  onChange={(installmentCount) =>
                    setForm((current) => ({ ...current, installmentCount }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schedule-first-due">{t("firstDue")}</Label>
                <LocalizedDatetimePicker
                  id="schedule-first-due"
                  value={form.firstDueAt}
                  onChange={(firstDueAt) =>
                    setForm((current) => ({ ...current, firstDueAt }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-currency">{tCommon("currency")}</Label>
                <Input
                  id="schedule-currency"
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
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? t("generating") : t("generateButton")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t("boardTitle")}</h2>
        <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {tCommon("refresh")}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {INSTALLMENT_BOARD_COLUMNS.map((column) => (
            <Skeleton key={column} className="h-40 w-full" />
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <p className="text-sm text-destructive" role="alert">
          {localizeFinanceMessage(tValidation, tErrors, error)}
        </p>
      ) : null}

      {!loading && !error ? (
        <div
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          data-denali-finance-board
          data-testid={FINANCE_INSTALLMENTS_TEST_IDS.board}
        >
          {INSTALLMENT_BOARD_COLUMNS.map((column) => (
            <Card
              key={column}
              data-denali-surface="card"
              data-board-column={column}
              data-testid={FINANCE_INSTALLMENTS_TEST_IDS.column(column)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {t(`board.${column}`)}
                  <span className="ms-2 text-muted-foreground">({board[column].length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {board[column].length === 0 ? (
                  <p className="text-xs text-muted-foreground">{tCommon("noItems")}</p>
                ) : (
                  board[column].map((item) => <ScheduleCard key={item.id} item={item} />)
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
