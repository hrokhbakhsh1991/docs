"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBookingDeparture } from "@/features/bookings/bookings-command-center-logic";
import type {
  BookingListItem,
  BookingsListResponse,
} from "@/features/bookings/bookings-command-center-types";
import {
  buildTourRegistrationsCommandCenterHref,
  buildTourRegistrationsWorkspaceQuery,
  sortRegistrationRows,
  TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS,
} from "@/features/tours/tour-workspace-registrations-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";

type TourWorkspaceRegistrationsClientProps = {
  readonly tourId: string;
};

export function TourWorkspaceRegistrationsClient({ tourId }: TourWorkspaceRegistrationsClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.workspace.registrations");
  const tTable = useTranslations("tours.workspace.table");
  const tNav = useTranslations("tours.nav");
  const tWorkspace = useTranslations("tours.workspace");
  const tBookingsStatus = useTranslations("bookings.status");
  const tErrors = useTranslations("tours.workspace.errors");
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildTourRegistrationsWorkspaceQuery(tourId);
      const response = await fetch(`/api/bookings?${query}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`TOUR_REGISTRATIONS_HTTP_${response.status}`);
      }
      const payload = (await response.json()) as BookingsListResponse;
      setItems(sortRegistrationRows(payload.items ?? []));
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error ? loadError.message : "TOUR_REGISTRATIONS_FETCH_FAILED"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    void loadRegistrations();
  }, [loadRegistrations]);

  const localizedError = resolveTourErrorMessage(tErrors, error);

  return (
    <Card data-denali-surface="card" data-testid={TOUR_WORKSPACE_TEST_IDS.registrationsPanel} className="shadow-sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild data-testid={TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS.registerLink}>
            <Link href={`/tours/${encodeURIComponent(tourId)}/register`}>
              <UserPlus className="me-1 h-4 w-4" />
              {tNav("registerGuest")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={buildTourRegistrationsCommandCenterHref(tourId)}>
              {tWorkspace("openCommandCenter")}
            </Link>
          </Button>
        </div>

        {loading ? <Skeleton className="h-32 w-full rounded-lg" /> : null}
        {localizedError !== null ? <p className="text-sm text-destructive">{localizedError}</p> : null}

        {!loading && items.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
            data-testid={TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS.empty}
          >
            <p>{t("empty")}</p>
            <Button asChild variant="link" className="mt-2" data-testid={TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS.registerFirstLink}>
              <Link href={`/tours/${encodeURIComponent(tourId)}/register`}>{t("registerFirst")}</Link>
            </Button>
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table
              className="w-full min-w-[32rem] text-start text-sm"
              data-testid={TOUR_WORKSPACE_REGISTRATIONS_TEST_IDS.table}
            >
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{tTable("guest")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("party")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("departure")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("status")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("submitted")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b transition-colors last:border-b-0 hover:bg-muted/50">
                    <td className="px-3 py-2 font-medium">{row.guestLabel}</td>
                    <td className="px-3 py-2">{formatLocalizedNumber(row.partySize, locale)}</td>
                    <td className="px-3 py-2">
                      {formatBookingDeparture(row.departureAt, locale)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{tBookingsStatus(row.status)}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {formatBookingDeparture(row.submittedAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
