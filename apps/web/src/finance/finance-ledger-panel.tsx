"use client";

import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceRegistrationIdentity } from "@/finance/finance-registration-identity";
import { withFinanceListScopeQuery } from "@/finance/finance-registration-context";
import {
  FINANCE_LEDGER_TEST_IDS,
  buildFinanceLedgerCsvContent,
  buildFinanceLedgerCsvFilename,
  formatFinanceTimestamp,
  formatLedgerEventLabel,
  parseFinanceLedgerListResponse,
  toFinanceLedgerCsvRows,
  type FinanceLedgerEvent,
  type FinanceLedgerListResponse,
} from "@/finance/finance-reports-logic";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage } from "@/i18n/resolve-finance-error-message";

type FinanceLedgerPanelProps = {
  readonly session: OperatorSessionContext;
  readonly initialLedger?: FinanceLedgerListResponse | null;
};

export function FinanceLedgerPanel({
  session,
  initialLedger = null,
}: FinanceLedgerPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.ledger");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const searchParams = useSearchParams();
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
    let cancelled = false;
    setLoading(true);
    setError(null);
    const path = withFinanceListScopeQuery("/api/finance/reports/ledger-events?limit=100", {
      registrationId: registrationFilter,
      tourId: tourFilter,
    });
    void fetch(path, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`LEDGER_HTTP_${response.status}`);
        }
        return parseFinanceLedgerListResponse(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "LEDGER_FETCH_FAILED");
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
    <div className="space-y-6" data-testid={FINANCE_LEDGER_TEST_IDS.panel} data-finance-audit-panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("auditSubtitle")}</p>
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
            variant="outline"
            size="sm"
            onClick={() => setFetchNonce((value) => value + 1)}
            disabled={loading}
          >
            {tCommon("refresh")}
          </Button>
        </div>
      </div>

      <Card data-operator-surface="card" className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("eventsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
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
                <li
                  key={event.outboxEventId}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{formatLedgerEventLabel(event.eventType)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{event.eventType}</p>
                    {event.registrationId ? (
                      <FinanceRegistrationIdentity
                        registrationId={event.registrationId}
                        context={event.registrationContext}
                      />
                    ) : null}
                    {event.journalId ? (
                      <p className="font-mono text-xs text-muted-foreground">
                        {tCommon("journal", { id: event.journalId })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline">{tCommon("lines", { count: event.lineCount })}</Badge>
                    <span>{formatFinanceTimestamp(event.createdAt, locale)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
