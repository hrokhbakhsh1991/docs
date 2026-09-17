"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppSearchParams } from "@/navigation/app-navigation-hooks";

import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FINANCE_OUTSTANDING_TEST_IDS,
  filterOutstandingByTourId,
  outstandingPaymentsHref,
  outstandingRegistrationContext,
  parseOutstandingBalancesResponse,
  parseTourCollectionsResponse,
  type OutstandingBalanceListItem,
  type TourCollectionListItem,
} from "@/finance/finance-outstanding-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import { FinanceRegistrationIdentity } from "@/finance/finance-registration-identity";
import { formatFinanceTimestamp } from "@/finance/finance-reports-logic";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage, toFinanceClientErrorCode } from "@/i18n/resolve-finance-error-message";

/**
 * PR23 UX-1 — Outstanding AR list from D1 + tour rollup from D2.
 * Aging buckets are not shown until the aging report HTTP exists.
 */
export function FinanceOutstandingPanel() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.outstanding");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const searchParams = useAppSearchParams();
  const tourFilter = searchParams.get("tourId")?.trim() || "";
  const registrationFilter = searchParams.get("registrationId")?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<readonly OutstandingBalanceListItem[]>([]);
  const [tours, setTours] = useState<readonly TourCollectionListItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balancesRes, toursRes] = await Promise.all([
        fetch("/api/finance/reports/outstanding-balances?limit=50", { cache: "no-store" }),
        fetch("/api/finance/reports/tour-collections?limit=20", { cache: "no-store" }),
      ]);
      if (!balancesRes.ok) {
        throw new Error(`OUTSTANDING_HTTP_${balancesRes.status}`);
      }
      const balancesPage = parseOutstandingBalancesResponse(await balancesRes.json());
      const toursPage = toursRes.ok
        ? parseTourCollectionsResponse(await toursRes.json())
        : { items: [], nextCursor: null, hasMore: false };
      setItems(balancesPage.items);
      setHasMore(balancesPage.hasMore);
      setTours(toursPage.items);
    } catch (fetchError: unknown) {
      setError(toFinanceClientErrorCode(fetchError, "OUTSTANDING_FETCH_FAILED"));
      setItems([]);
      setTours([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, fetchNonce]);

  const visibleItems = useMemo(() => {
    let rows = filterOutstandingByTourId(items, tourFilter);
    if (registrationFilter.length > 0) {
      rows = rows.filter((row) => row.registrationId === registrationFilter);
    }
    return rows;
  }, [items, tourFilter, registrationFilter]);

  return (
    <div className="space-y-4" data-testid={FINANCE_OUTSTANDING_TEST_IDS.panel}>
      <Card data-operator-surface="card" className="shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">{t("title")}</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">{t("subtitle")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            data-testid={FINANCE_OUTSTANDING_TEST_IDS.refresh}
            onClick={() => setFetchNonce((n) => n + 1)}
          >
            {tCommon("refresh")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p
            className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
            data-testid={FINANCE_OUTSTANDING_TEST_IDS.agingUnavailable}
          >
            {t("agingUnavailable")}
          </p>

          {loading ? (
            <div data-testid={FINANCE_OUTSTANDING_TEST_IDS.loading} className="space-y-2">
              <OperatorSkeleton size="user-card" />
              <OperatorSkeleton size="user-card" />
            </div>
          ) : null}

          {!loading && error ? (
            <p
              className="text-sm text-destructive"
              role="alert"
              data-testid={FINANCE_OUTSTANDING_TEST_IDS.error}
            >
              {localizeFinanceMessage(tValidation, tErrors, error)}
            </p>
          ) : null}

          {!loading && !error && tours.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{t("toursTitle")}</h3>
              <ul
                className="divide-y rounded-md border"
                data-testid={FINANCE_OUTSTANDING_TEST_IDS.tours}
              >
                {tours.map((tour) => (
                  <li
                    key={tour.tourId}
                    className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
                    data-testid={FINANCE_OUTSTANDING_TEST_IDS.tourRow}
                  >
                    <div>
                      <p className="font-medium">{tour.tourTitle ?? t("tourUntitled")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("tourRowMeta", { count: tour.registrationsCount })}
                      </p>
                    </div>
                    <div className="text-sm sm:text-end">
                      <p className="font-semibold tabular-nums">
                        {t("remainingShort")}:{" "}
                        {formatMinorAmount(tour.remainingMinor, tour.currency, locale)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t("collectedShort")}:{" "}
                        {formatMinorAmount(tour.collectedMinor, tour.currency, locale)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!loading && !error ? (
            visibleItems.length === 0 ? (
              <p
                className="text-sm text-muted-foreground"
                data-testid={FINANCE_OUTSTANDING_TEST_IDS.empty}
              >
                {t("empty")}
              </p>
            ) : (
              <ul
                className="divide-y rounded-md border"
                data-testid={FINANCE_OUTSTANDING_TEST_IDS.list}
              >
                {visibleItems.map((item) => (
                  <li
                    key={item.registrationId}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                    data-testid={FINANCE_OUTSTANDING_TEST_IDS.item}
                  >
                    <div className="min-w-0 space-y-1">
                      <FinanceRegistrationIdentity
                        registrationId={item.registrationId}
                        context={outstandingRegistrationContext(item)}
                        density="compact"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("openedAt")}: {formatFinanceTimestamp(item.occurredAt, locale)}
                      </p>
                      {item.bookingPaymentStatus ? (
                        <Badge variant="outline" className="text-[10px]">
                          {t(`bookingStatus.${item.bookingPaymentStatus}` as "bookingStatus.partial")}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      <p
                        className="text-base font-semibold tabular-nums"
                        data-testid={FINANCE_OUTSTANDING_TEST_IDS.remaining}
                      >
                        {formatMinorAmount(
                          item.invoice.remainingMinor,
                          item.invoice.currency,
                          locale
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t("collectedShort")}:{" "}
                        {formatMinorAmount(item.invoice.paidMinor, item.invoice.currency, locale)}
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={outstandingPaymentsHref(item.registrationId)}
                          data-testid={FINANCE_OUTSTANDING_TEST_IDS.openPayments}
                        >
                          {t("openPayments")}
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {!loading && !error && hasMore ? (
            <p className="text-xs text-muted-foreground">{t("hasMoreHint")}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
