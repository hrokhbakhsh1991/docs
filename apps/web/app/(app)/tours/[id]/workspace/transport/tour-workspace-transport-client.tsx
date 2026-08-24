"use client";

import { OperatorInternalLink } from "@/features/tours/tour-internal-link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBookingDeparture } from "@/features/bookings/bookings-command-center-logic";
import { formatRegistrationIntakeTransportLabel } from "@app-tour/workspace-sdk";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import {
  buildTourOperationalRosterHref,
  buildTourTransportCommandCenterHref,
  countTransportRosterByIntakeKind,
  extractTransportModesFromTourPayload,
  formatOperationalRosterAmountDue,
  OPERATIONAL_ROSTER_FILTERS,
  sortTransportRosterRows,
  TOUR_WORKSPACE_TRANSPORT_TEST_IDS,
  type TourOperationalRosterResponse,
  type TourOperationalRosterRow,
} from "@/features/tours/tour-workspace-transport-logic";
import type { OperationalRosterFilter } from "@app-tour/workspace-denali/roster";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";
import { resolveWizardTransportModeLabel } from "@/wizard/wizard-label-surface-registry";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";
import { fetchTourDetailCached } from "@/features/tours/tour-route-cache";
import { DriverSettlementPanel } from "./driver-settlement-panel";

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
  const t = useTranslations("tours.workspace.transport");
  const tTable = useTranslations("tours.workspace.table");
  const tWorkspaceCopy = useTranslations("tours.workspace");
  const tErrors = useTranslations("tours.workspace.errors");
  const [modes, setModes] = useState<string[]>([]);
  const [items, setItems] = useState<TourOperationalRosterRow[]>([]);
  const [filter, setFilter] = useState<OperationalRosterFilter>("operational");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tourPayload, rosterResponse] = await Promise.all([
        fetchTourDetailCached(tourId),
        fetch(buildTourOperationalRosterHref(tourId, filter), { cache: "no-store" }),
      ]);
      if (!rosterResponse.ok) {
        throw new Error(`TOUR_TRANSPORT_BOOKINGS_HTTP_${rosterResponse.status}`);
      }
      const rosterPayload = (await rosterResponse.json()) as TourOperationalRosterResponse;
      setModes(
        extractTransportModesFromTourPayload(tourPayload as unknown as Record<string, unknown>)
      );
      setItems(sortTransportRosterRows(rosterPayload.items ?? []));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "TOUR_TRANSPORT_FETCH_FAILED");
      setModes([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter, tourId]);

  useEffect(() => {
    void loadTransport();
  }, [loadTransport]);

  const localizedError = resolveTourErrorMessage(tErrors, error);

  const driverRow = items.find((row) => row.transportKind === "personal_car");
  const passengerRows = items.filter(
    (row) => row.transportKind !== "personal_car" && row.id !== driverRow?.id
  );

  return (
    <Card data-operator-surface="card" data-testid={TOUR_WORKSPACE_TEST_IDS.transportPanel} className="shadow-sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex flex-wrap gap-2"
          data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.filters}
        >
          {OPERATIONAL_ROSTER_FILTERS.map((filterId) => (
            <Button
              key={filterId}
              type="button"
              size="sm"
              variant={filter === filterId ? "default" : "outline"}
              onClick={() => setFilter(filterId)}
            >
              {t(`filters.${filterId}`)}
            </Button>
          ))}
        </div>

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

        {!loading && driverRow ? (
          <DriverSettlementPanel
            tourId={tourId}
            driverRegistrationId={driverRow.id}
            passengerIds={passengerRows.slice(0, 2).map((r) => r.id)}
          />
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table
              className="w-full min-w-[48rem] text-start text-sm"
              data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.table}
            >
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{tTable("guest")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("party")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("transportIntake")}</th>
                  <th className="px-3 py-2 font-medium">{t("columns.financial")}</th>
                  <th className="px-3 py-2 font-medium">{t("columns.amountDue")}</th>
                  <th className="px-3 py-2 font-medium">{t("columns.deadline")}</th>
                  <th className="px-3 py-2 font-medium">{tTable("status")}</th>
                  <th className="px-3 py-2 font-medium">{t("columns.final")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const transportLabel = formatRegistrationIntakeTransportLabel(
                    {
                      registrantTarget: null,
                      transportKind: row.transportKind,
                      personalCarOccupants: row.personalCarOccupants as 1 | 2 | 3 | null,
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
                  const amountDue = formatOperationalRosterAmountDue(row);
                  return (
                    <tr
                      key={row.registrationId}
                      className="border-b transition-colors last:border-b-0 hover:bg-muted/50"
                    >
                      <td className="px-3 py-2 font-medium">
                        {row.guestLabel}
                        {row.isDriverOffer ? (
                          <Badge
                            className="ms-2"
                            variant="outline"
                            data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.driverBadge}
                          >
                            {t("driverOffer")}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{formatLocalizedNumber(row.partySize, locale)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{transportLabel ?? "—"}</td>
                      <td className="px-3 py-2">{t(`financial.${row.financialDisplayState}`)}</td>
                      <td
                        className="px-3 py-2"
                        data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.amountDue}
                      >
                        {amountDue ?? "—"}
                      </td>
                      <td
                        className="px-3 py-2"
                        data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.paymentDeadline}
                      >
                        {row.paymentDueAt !== null
                          ? formatBookingDeparture(row.paymentDueAt, locale)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {tBookings.has(row.registrationStatus)
                          ? tBookings(row.registrationStatus)
                          : row.registrationStatus}
                        {row.refundDisplayState !== "none" ? (
                          <span className="ms-1 text-xs text-muted-foreground">
                            ({t(`refund.${row.refundDisplayState}`)})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {row.isFinalParticipant ? (
                          <Badge
                            variant="default"
                            data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.finalBadge}
                          >
                            {t("finalParticipant")}
                          </Badge>
                        ) : (
                          "—"
                        )}
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
