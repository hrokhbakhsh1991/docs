"use client";

import { OperatorInternalLink } from "@/features/tours/tour-internal-link";
import { OperatorProfileAvatar } from "@/admin/patterns/operator-profile-avatar";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBookingDeparture } from "@/features/bookings/bookings-command-center-logic";
import {
  formatRegistrationIntakeTransportLabel,
  type PublicCatalogRegistrationTransportKind,
} from "@app-tour/workspace-sdk";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import {
  buildTourOperationalRosterHref,
  buildTourTransportCommandCenterHref,
  countTransportRosterByIntakeKind,
  extractTransportModesFromTourPayload,
  formatOperationalRosterAmountDue,
  OPERATIONAL_ROSTER_FILTERS,
  resolveOperationalRosterActionablePaymentDueAt,
  sortTransportRosterRows,
  TOUR_WORKSPACE_TRANSPORT_TEST_IDS,
  type OperationalRosterFilter,
  type TourOperationalRosterResponse,
  type TourOperationalRosterRow,
} from "@/features/tours/tour-workspace-transport-logic";
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
    (row) =>
      row.transportKind !== "personal_car" && row.registrationId !== driverRow?.registrationId
  );

  function formatRowTransportLabel(row: TourOperationalRosterRow): string | null {
    return formatRegistrationIntakeTransportLabel(
      {
        registrantTarget: null,
        transportKind: row.transportKind as PublicCatalogRegistrationTransportKind | null,
        personalCarOccupants: row.personalCarOccupants as 1 | 2 | 3 | null,
        nationalId: null,
      },
      {
        primary: tBookingsIntake("transportPrimary"),
        personalCar: tBookingsIntake("transportPersonalCar"),
        noCarDong: tBookingsIntake("transportNoCarDong"),
        noCarAcquaintance: tBookingsIntake("transportNoCarAcquaintance"),
        occupants: (count) => tBookingsIntake("transportOccupants", { count, locale }),
      }
    );
  }

  function resolveOperationalNote(row: TourOperationalRosterRow): string {
    if (!row.isFinalParticipant) {
      return t("notes.notFinal");
    }
    if (row.refundDisplayState !== "none") {
      return t(`refund.${row.refundDisplayState}`);
    }
    const paymentDueAt = resolveOperationalRosterActionablePaymentDueAt(row);
    if (paymentDueAt !== null) {
      return t("notes.paymentDeadline", {
        date: formatBookingDeparture(paymentDueAt, locale),
      });
    }
    if (row.isDriverOffer) {
      return t("notes.driver");
    }
    return t("notes.ready");
  }

  function renderParticipantIdentity(row: TourOperationalRosterRow) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <OperatorProfileAvatar
          userId={row.memberUserId ?? row.registrationId}
          displayName={row.guestLabel}
          avatarUrl={row.memberAvatarUrl ?? null}
          size="sm"
          fallbackMode="icon"
          testId={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.rowAvatar}
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{row.guestLabel}</p>
          <p className="text-xs text-muted-foreground">
            {tTable("party")}: {formatLocalizedNumber(row.partySize, locale)}
          </p>
        </div>
      </div>
    );
  }

  function renderParticipationState(row: TourOperationalRosterRow) {
    return row.isFinalParticipant ? (
      <Badge variant="default" data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.finalBadge}>
        {t("finalParticipant")}
      </Badge>
    ) : (
      <Badge variant="outline">{t("notFinalParticipant")}</Badge>
    );
  }

  function renderPaymentSummary(row: TourOperationalRosterRow) {
    const amountDue = formatOperationalRosterAmountDue(row);
    return (
      <div className="space-y-1 text-sm">
        <p>{t(`financial.${row.financialDisplayState}`)}</p>
        <p
          className="text-xs text-muted-foreground"
          data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.amountDue}
        >
          {amountDue ?? t("noOperationalDebt")}
        </p>
      </div>
    );
  }

  return (
    <Card
      data-operator-surface="card"
      data-testid={TOUR_WORKSPACE_TEST_IDS.transportPanel}
      className="shadow-sm"
    >
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
        {localizedError !== null ? (
          <p className="text-sm text-destructive">{localizedError}</p>
        ) : null}

        {!loading && modes.length > 0 ? (
          <div
            className="flex flex-wrap gap-2"
            data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.modes}
          >
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
            driverRegistrationId={driverRow.registrationId}
            passengerIds={passengerRows.slice(0, 2).map((r) => r.registrationId)}
          />
        ) : null}

        {!loading && items.length > 0 ? (
          <>
            <div className="hidden rounded-lg border md:block">
              <table
                className="w-full table-fixed text-start text-sm"
                data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.table}
              >
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-[28%] px-3 py-2 font-medium">{tTable("guest")}</th>
                    <th className="w-[16%] px-3 py-2 font-medium">{t("columns.participation")}</th>
                    <th className="w-[20%] px-3 py-2 font-medium">{tTable("transportIntake")}</th>
                    <th className="w-[22%] px-3 py-2 font-medium">{t("columns.note")}</th>
                    <th className="w-[14%] px-3 py-2 font-medium">{t("columns.financial")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const transportLabel = formatRowTransportLabel(row);
                    const paymentDueAt = resolveOperationalRosterActionablePaymentDueAt(row);
                    return (
                      <tr
                        key={row.registrationId}
                        className="border-b transition-colors last:border-b-0 hover:bg-muted/50"
                      >
                        <td className="px-3 py-3">
                          {renderParticipantIdentity(row)}
                          {row.isDriverOffer ? (
                            <Badge
                              className="mt-2"
                              variant="outline"
                              data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.driverBadge}
                            >
                              {t("driverOffer")}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">{renderParticipationState(row)}</td>
                        <td className="px-3 py-3 text-muted-foreground">{transportLabel ?? "—"}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          <span>{resolveOperationalNote(row)}</span>
                          <span
                            className="sr-only"
                            data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.paymentDeadline}
                          >
                            {paymentDueAt !== null
                              ? formatBookingDeparture(paymentDueAt, locale)
                              : "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3">{renderPaymentSummary(row)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              className="space-y-3 md:hidden"
              data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.mobileList}
            >
              {items.map((row) => {
                const transportLabel = formatRowTransportLabel(row);
                const paymentDueAt = resolveOperationalRosterActionablePaymentDueAt(row);
                return (
                  <article key={row.registrationId} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      {renderParticipantIdentity(row)}
                      {renderParticipationState(row)}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{tTable("transportIntake")}</span>
                        <span className="text-end">{transportLabel ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("columns.note")}</span>
                        <span
                          className="text-end"
                          data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.paymentDeadline}
                        >
                          {resolveOperationalNote(row)}
                        </span>
                      </div>
                      <div className="border-t pt-2">{renderPaymentSummary(row)}</div>
                      {paymentDueAt === null ? null : (
                        <span className="sr-only">
                          {formatBookingDeparture(paymentDueAt, locale)}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
