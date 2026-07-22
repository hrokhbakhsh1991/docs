"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatBookingDeparture,
  isBulkApprovable,
} from "@/features/bookings/bookings-command-center-logic";
import {
  isAdminOrOwnerRole,
  type BookingListItem,
  type BookingsListResponse,
} from "@/features/bookings/bookings-command-center-types";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import {
  buildTourWaitlistBookingsQuery,
  buildTourWaitlistCommandCenterHref,
  sortWaitlistRows,
  TOUR_WORKSPACE_WAITLIST_TEST_IDS,
} from "@/features/tours/tour-workspace-waitlist-logic";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";

type TourWorkspaceWaitlistClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
};

export function TourWorkspaceWaitlistClient({
  session,
  tourId,
}: TourWorkspaceWaitlistClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.workspace.waitlist");
  const tTable = useTranslations("tours.workspace.table");
  const tWorkspace = useTranslations("tours.workspace");
  const tErrors = useTranslations("tours.workspace.errors");
  const canApprove = isAdminOrOwnerRole(session.role);
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadWaitlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildTourWaitlistBookingsQuery(tourId);
      const response = await fetch(`/api/bookings?${query}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`TOUR_WAITLIST_HTTP_${response.status}`);
      }
      const payload = (await response.json()) as BookingsListResponse;
      setItems(sortWaitlistRows(payload.items ?? []));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "TOUR_WAITLIST_FETCH_FAILED");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    void loadWaitlist();
  }, [loadWaitlist]);

  async function approveBooking(bookingId: string): Promise<void> {
    setApprovingId(bookingId);
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(`TOUR_WAITLIST_APPROVE_${response.status}`);
      }
      await loadWaitlist();
    } catch (approveError: unknown) {
      setError(
        approveError instanceof Error ? approveError.message : "TOUR_WAITLIST_APPROVE_FAILED"
      );
    } finally {
      setApprovingId(null);
    }
  }

  const localizedError = resolveTourErrorMessage(tErrors, error);

  return (
    <Card data-operator-surface="card" data-testid={TOUR_WORKSPACE_TEST_IDS.waitlistPanel} className="shadow-sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <Skeleton className="h-32 w-full rounded-lg" /> : null}
        {localizedError !== null ? <p className="text-sm text-destructive">{localizedError}</p> : null}

        {!loading && items.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
            data-testid={TOUR_WORKSPACE_WAITLIST_TEST_IDS.empty}
          >
            <p>{t("empty")}</p>
            <Button asChild variant="link" className="mt-2">
              <Link href={buildTourWaitlistCommandCenterHref(tourId)}>
                {tWorkspace("openCommandCenter")}
              </Link>
            </Button>
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table
              className="w-full min-w-[32rem] text-start text-sm"
              data-testid={TOUR_WORKSPACE_WAITLIST_TEST_IDS.table}
            >
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{tTable("guest")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("party")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("departure")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("submitted")}</th>
                  {canApprove ? <th className="px-3 py-2 font-medium">{tTable("actions")}</th> : null}
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
                      {formatBookingDeparture(row.submittedAt, locale)}
                    </td>
                    {canApprove ? (
                      <td className="px-3 py-2">
                        {isBulkApprovable(row) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={approvingId === row.id}
                            data-testid={TOUR_WORKSPACE_WAITLIST_TEST_IDS.approve}
                            onClick={() => void approveBooking(row.id)}
                          >
                            <Check className="me-1 h-3.5 w-3.5" />
                            {t("approve")}
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
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
