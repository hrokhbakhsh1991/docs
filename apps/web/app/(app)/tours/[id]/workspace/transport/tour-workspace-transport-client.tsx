"use client";

import { OperatorInternalLink } from "@/features/tours/tour-internal-link";
import { useLocale, useTranslations } from "next-intl";
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
import { formatRegistrationIntakeTransportLabel } from "@app-tour/workspace-sdk";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import {
  buildTourTransportBookingsQuery,
  buildTourTransportCommandCenterHref,
  countTransportRosterByIntakeKind,
  extractTransportModesFromTourPayload,
  sortTransportRosterRows,
  TOUR_WORKSPACE_TRANSPORT_TEST_IDS,
} from "@/features/tours/tour-workspace-transport-logic";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";
import { resolveWizardTransportModeLabel } from "@/wizard/wizard-label-surface-registry";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";
import { fetchTourDetailCached } from "@/features/tours/tour-route-cache";

type TourWorkspaceTransportClientProps = {
  readonly tourId: string;
  readonly pluginId: string;
};

export function TourWorkspaceTransportClient({
  tourId,
  pluginId,
}: TourWorkspaceTransportClientProps) {
  const locale = useLocale() as AppLocale;
  const tWorkspace = useWorkspaceWizardTranslator(pluginId);
  const tBookings = useTranslations("bookings.status");
  const tBookingsIntake = useTranslations("bookings.intake");
  const tPayment = useTranslations("bookings.payment");
  const t = useTranslations("tours.workspace.transport");
  const tTable = useTranslations("tours.workspace.table");
  const tWorkspaceCopy = useTranslations("tours.workspace");
  const tErrors = useTranslations("tours.workspace.errors");
  const [modes, setModes] = useState<string[]>([]);
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tourPayload, bookingsResponse] = await Promise.all([
        fetchTourDetailCached(tourId),
        fetch(`/api/bookings?${buildTourTransportBookingsQuery(tourId)}`, { cache: "no-store" }),
      ]);
      if (!bookingsResponse.ok) {
        throw new Error(`TOUR_TRANSPORT_BOOKINGS_HTTP_${bookingsResponse.status}`);
      }
      const bookingsPayload = (await bookingsResponse.json()) as BookingsListResponse;
      setModes(
        extractTransportModesFromTourPayload(tourPayload as unknown as Record<string, unknown>)
      );
      // H5-T3/T4 — list scalars only; no N+1 detail hydrate.
      setItems(sortTransportRosterRows(bookingsPayload.items ?? []));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "TOUR_TRANSPORT_FETCH_FAILED");
      setModes([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    void loadTransport();
  }, [loadTransport]);

  const localizedError = resolveTourErrorMessage(tErrors, error);

  return (
    <Card data-operator-surface="card" data-testid={TOUR_WORKSPACE_TEST_IDS.transportPanel} className="shadow-sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <Skeleton className="h-32 w-full rounded-lg" /> : null}
        {localizedError !== null ? <p className="text-sm text-destructive">{localizedError}</p> : null}

        {!loading && modes.length > 0 ? (
          <div className="flex flex-wrap gap-2" data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.modes}>
            {modes.map((mode) => (
              <Badge key={mode} variant="secondary">
                {resolveWizardTransportModeLabel(pluginId, tWorkspace, mode)}
              </Badge>
            ))}
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div
            className="flex flex-wrap gap-2"
            data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.modeCounts}
          >
            {countTransportRosterByIntakeKind(items).map(({ kind, count }) => {
              const label =
                kind === "primary"
                  ? tBookingsIntake("transportPrimary")
                  : kind === "personal_car"
                    ? tBookingsIntake("transportPersonalCar")
                    : kind === "no_car_dong"
                      ? tBookingsIntake("transportNoCarDong")
                      : kind === "no_car_acquaintance"
                        ? tBookingsIntake("transportNoCarAcquaintance")
                        : t("unknownIntake");
              return (
                <Badge key={kind} variant="outline">
                  {label}: {formatLocalizedNumber(count, locale)}
                </Badge>
              );
            })}
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
            data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.empty}
          >
            <p>{t("empty")}</p>
            <Button asChild variant="link" className="mt-2">
              <OperatorInternalLink href={buildTourTransportCommandCenterHref(tourId)}>
                {tWorkspaceCopy("openCommandCenter")}
              </OperatorInternalLink>
            </Button>
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table
              className="w-full min-w-[32rem] text-start text-sm"
              data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.table}
            >
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{tTable("guest")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("party")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("transportIntake")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("payment")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("departure")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("status")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const transportLabel = formatRegistrationIntakeTransportLabel(
                    {
                      registrantTarget: null,
                      transportKind: row.transportKind,
                      personalCarOccupants: row.personalCarOccupants,
                      nationalId: null,
                    },
                    {
                      primary: tBookingsIntake("transportPrimary"),
                      personalCar: tBookingsIntake("transportPersonalCar"),
                      noCarDong: tBookingsIntake("transportNoCarDong"),
                      noCarAcquaintance: tBookingsIntake("transportNoCarAcquaintance"),
                      occupants: (count) =>
                        tBookingsIntake("transportOccupants", { count, locale }),
                    }
                  );
                  return (
                  <tr key={row.id} className="border-b transition-colors last:border-b-0 hover:bg-muted/50">
                    <td className="px-3 py-2 font-medium">{row.guestLabel}</td>
                    <td className="px-3 py-2">{formatLocalizedNumber(row.partySize, locale)}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {transportLabel ?? "—"}
                    </td>
                    <td className="px-3 py-2">{tPayment(row.paymentStatus)}</td>
                    <td className="px-3 py-2">
                      {formatBookingDeparture(row.departureAt, locale)}
                    </td>
                    <td className="px-3 py-2">
                      {tBookings.has(row.status) ? tBookings(row.status) : row.status}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
