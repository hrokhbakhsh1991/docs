"use client";

import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAppSearchParams } from "@/navigation/app-navigation-hooks";
import { useEffect, useRef, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceRegistrationIdentity } from "@/finance/finance-registration-identity";
import { withFinanceListScopeQuery } from "@/finance/finance-registration-context";
import { fetchFinanceListWithRetry } from "@/finance/fetch-finance-list-with-retry";
import {
  FINANCE_LEDGER_TEST_IDS,
  buildFinanceLedgerCsvContent,
  buildFinanceLedgerCsvFilename,
  formatFinanceTimestamp,
  parseFinanceLedgerListResponse,
  resolveFinanceLedgerEventLabel,
  toFinanceLedgerCsvRows,
  type FinanceLedgerEvent,
  type FinanceLedgerListResponse,
} from "@/finance/finance-reports-logic";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage, toFinanceClientErrorCode } from "@/i18n/resolve-finance-error-message";

type FinanceLedgerPanelProps = {
  readonly session: OperatorSessionContext;
  readonly initialLedger?: FinanceLedgerListResponse | null;
};

function LedgerEventRow({
  event,
  locale,
}: {
  readonly event: FinanceLedgerEvent;
  readonly locale: AppLocale;
}) {
  const t = useTranslations("finance.ledger");
  const tCommon = useTranslations("finance.common");
  const humanLabel = resolveFinanceLedgerEventLabel(event.eventType, t);

  return (
    <li
      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between"
      data-event-type={event.eventType}
    >
      <div className="min-w-0 space-y-1">
        <p
          className="text-sm font-medium text-foreground"
          data-testid={FINANCE_LEDGER_TEST_IDS.eventLabel}
        >
          {humanLabel}
        </p>
        {event.registrationId ? (
          <FinanceRegistrationIdentity
            registrationId={event.registrationId}
            context={event.registrationContext}
            density="compact"
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFinanceTimestamp(event.createdAt, locale)}</span>
          <Badge variant="outline" className="font-normal">
            {tCommon("lines", { count: event.lineCount })}
          </Badge>
        </div>
        <details className="text-xs text-muted-foreground" data-testid={FINANCE_LEDGER_TEST_IDS.eventTechnical}>
          <summary className="cursor-pointer select-none">{t("technicalDetails")}</summary>
          <div className="mt-1 space-y-0.5 font-mono">
            <p>{event.eventType}</p>
            {event.journalId ? <p>{tCommon("journal", { id: event.journalId })}</p> : null}
            {event.domainEventId ? (
              <p>
                {t("domainEventId")}: {event.domainEventId}
              </p>
            ) : null}
          </div>
        </details>
      </div>
    </li>
  );
}

export function FinanceLedgerPanel({
  session,
  initialLedger = null,
}: FinanceLedgerPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.ledger");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const searchParams = useAppSearchParams();
  const registrationFilter = searchParams.get("registrationId");
  const tourFilter = searchParams.get("tourId");
  const [items, setItems] = useState<readonly FinanceLedgerEvent[]>(initialLedger?.items ?? []);
  const [loading, setLoading] = useState(initialLedger === null);
  const [error, setError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const skipInitialFetchRef = useRef(initialLedger !== null);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const path = withFinanceListScopeQuery("/api/finance/reports/ledger-events?limit=100", {
      registrationId: registrationFilter,
      tourId: tourFilter,
    });
    void fetchFinanceListWithRetry(path, controller.signal)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`LEDGER_HTTP_${response.status}`);
        }
        return parseFinanceLedgerListResponse(await response.json());
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setItems(payload.items);
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
        setError(toFinanceClientErrorCode(fetchError, "LEDGER_FETCH_FAILED"));
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

  const handleExportCsv = () => {
    const csv = buildFinanceLedgerCsvContent(toFinanceLedgerCsvRows(items));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildFinanceLedgerCsvFilename(session.tenantId.slice(0, 8));
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-testid={FINANCE_LEDGER_TEST_IDS.panel} data-finance-audit-panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="max-w-xl text-xs text-muted-foreground">{t("auditSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid={FINANCE_LEDGER_TEST_IDS.exportCsv}
            onClick={handleExportCsv}
            disabled={loading || items.length === 0}
          >
            <Download className="me-1 size-4" />
            {tCommon("exportCsv")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFetchNonce((value) => value + 1)}
            disabled={loading}
          >
            {tCommon("refresh")}
          </Button>
        </div>
      </div>

      <Card data-operator-surface="card" className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("eventsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3" data-testid="finance-ledger-loading">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : null}
          {!loading && error ? (
            <p className="text-sm text-destructive" role="alert">
              {localizeFinanceMessage(tValidation, tErrors, error)}
            </p>
          ) : null}
          {!loading && !error && items.length === 0 ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid={FINANCE_LEDGER_TEST_IDS.emptyState}
            >
              {t("empty")}
            </p>
          ) : null}
          {!loading && !error && items.length > 0 ? (
            <ul className="divide-y rounded-md border" data-testid={FINANCE_LEDGER_TEST_IDS.list}>
              {items.map((event) => (
                <LedgerEventRow key={event.outboxEventId} event={event} locale={locale} />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
