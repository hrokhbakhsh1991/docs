"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { groupInstallmentsByBoardColumn, parseSchedulesListResponse } from "@/finance/finance-installments-logic";
import { parseFinanceLedgerListResponse, parseFinanceSummary } from "@/finance/finance-reports-logic";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import {
  buildReconciliationFindings,
  hasOpenReconciliationFindings,
  RECONCILIATION_TRIAGE_TEST_IDS,
  type ReconciliationFinding,
} from "@/finance/reconciliation-triage-logic";

type ReconciliationTriageClientProps = {
  readonly session: OperatorSessionContext;
  readonly initialFindings?: readonly ReconciliationFinding[] | null;
};

export function ReconciliationTriageClient({
  session,
  initialFindings = null,
}: ReconciliationTriageClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("settings.reconciliation");
  const tErrors = useTranslations("settings.reconciliation.errors");
  const canManage = isAdminOrOwnerRole(session.role);
  const [findings, setFindings] = useState<readonly ReconciliationFinding[]>(initialFindings ?? []);
  const [loading, setLoading] = useState(canManage && initialFindings === null);
  const [error, setError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const skipInitialFetchRef = useRef(initialFindings !== null);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetch("/api/finance/reports/summary", { cache: "no-store" }),
      fetch("/api/finance/schedules", { cache: "no-store" }),
      fetch("/api/finance/reports/ledger-events?limit=100", { cache: "no-store" }),
    ])
      .then(async ([summaryRes, schedulesRes, ledgerRes]) => {
        if (!summaryRes.ok) {
          throw new Error(`SUMMARY_HTTP_${summaryRes.status}`);
        }
        const summary = parseFinanceSummary(await summaryRes.json());
        let overdue = 0;
        if (schedulesRes.ok) {
          const schedules = parseSchedulesListResponse(await schedulesRes.json());
          overdue = groupInstallmentsByBoardColumn(schedules.items).overdue.length;
        }
        let ledgerEventCount = 0;
        if (ledgerRes.ok) {
          const ledger = parseFinanceLedgerListResponse(await ledgerRes.json());
          ledgerEventCount = ledger.items.length;
        }
        return buildReconciliationFindings(summary, overdue, ledgerEventCount);
      })
      .then((payload) => {
        if (!cancelled) {
          setFindings(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "TRIAGE_FETCH_FAILED");
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
  }, [canManage, fetchNonce]);

  const openFindings = useMemo(() => hasOpenReconciliationFindings(findings), [findings]);

  if (!canManage) {
    return (
      <div className="space-y-6" data-testid={RECONCILIATION_TRIAGE_TEST_IDS.page}>
        <Card data-operator-surface="card" className="shadow-sm">
          <CardContent className="pt-6 text-sm text-muted-foreground">{t("forbidden")}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid={RECONCILIATION_TRIAGE_TEST_IDS.page}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => setFetchNonce((value) => value + 1)}
        >
          {t("refresh")}
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/finance?tab=ledger">{t("openLedger")}</Link>
        </Button>
      </div>

      {loading ? <Skeleton className="h-48 w-full max-w-3xl" /> : null}

      {error !== null ? (
        <p className="text-sm text-destructive">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}

      {!loading && error === null && !openFindings ? (
        <Card data-operator-surface="card" data-testid={RECONCILIATION_TRIAGE_TEST_IDS.emptyState} className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("allClear.title")}</CardTitle>
            <CardDescription>{t("allClear.description")}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!loading && error === null && openFindings ? (
        <ul
          className="grid max-w-3xl gap-4"
          data-testid={RECONCILIATION_TRIAGE_TEST_IDS.findingsList}
        >
          {findings.map((finding) => (
            <li key={finding.id}>
              <Card
                data-operator-surface="card"
                data-testid={RECONCILIATION_TRIAGE_TEST_IDS.findingCard}
                data-finding-id={finding.id}
                className="shadow-sm"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">
                      {t(`findings.${finding.id}.title`)}
                    </CardTitle>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t(`severity.${finding.severity}`)}
                    </span>
                  </div>
                  <CardDescription>{t(`findings.${finding.id}.detail`)}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="text-2xl font-bold">{formatLocalizedNumber(finding.count, locale)}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href={finding.actionHref}>{t("resolveInFinance")}</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}