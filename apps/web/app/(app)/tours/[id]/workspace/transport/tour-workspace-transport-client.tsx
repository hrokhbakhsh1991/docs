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
import { TourWorkspaceTransportControls } from "@/features/tours/tour-workspace-transport-controls";
import {
  buildTourOperationalRosterHref,
  buildTourTransportCommandCenterHref,
  countTransportRosterByIntakeKind,
  extractTransportModesFromTourPayload,
  formatOperationalRosterAmountDue,
  resolveOperationalRosterActionablePaymentDueAt,
  resolveOperationalRosterNoteKind,
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
  readonly canManage: boolean;
};

export function TourWorkspaceTransportClient({
  tourId,
  pluginId,
  canManage,
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
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [finalizationMessage, setFinalizationMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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

  const finalizeParticipant = async (registrationId: string) => {
    setFinalizingId(registrationId);
    setFinalizationMessage(null);
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(registrationId)}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(`FINALIZE_HTTP_${response.status}`);
      }
      setFinalizationMessage(t("finalizeParticipantSuccess"));
      await loadTransport();
    } catch {
      setFinalizationMessage(t("finalizeParticipantFailed"));
    } finally {
      setFinalizingId(null);
    }
  };

  const exportFinalRoster = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch(
        `/api/tours/${encodeURIComponent(tourId)}/operational-roster/export?filter=final&format=xlsx`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error(`ROSTER_EXPORT_HTTP_${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        readAttachmentFilename(response.headers.get("Content-Disposition")) ??
        `denali-tour-${tourId}-final-roster.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  };

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
        personalCarOccupants: row.personalCarOccupants as 0 | 1 | 2 | 3 | null,
        nationalId: null,
      },
      {
        primary: tBookingsIntake("transportPrimary"),
        personalCar: tBookingsIntake("transportPersonalCar"),
        noCarDong: tBookingsIntake("transportNoCarDong"),
        noCarAcquaintance: tBookingsIntake("transportNoCarAcquaintance"),
        occupants: (count) =>
          count === 0
            ? tBookingsIntake("transportNoCompanion")
            : tBookingsIntake("transportOccupants", { count, locale }),
      }
    );
  }

  function resolveOperationalNote(row: TourOperationalRosterRow): string {
    switch (resolveOperationalRosterNoteKind(row)) {
      case "payment_required":
        return t("notes.paymentRequiredForFinal");
      case "not_final":
        return t("notes.notFinal");
      case "refund":
        return t(`refund.${row.refundDisplayState}`);
      case "payment_deadline":
        return t("notes.paymentDeadline", {
          date: formatBookingDeparture(row.paymentDueAt!, locale),
        });
      case "driver":
        return t("notes.driver");
      default:
        return t("notes.ready");
    }
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
    const paymentRequired =
      row.financialDisplayState === "UNPAID" || row.financialDisplayState === "PARTIALLY_PAID";
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="operator-roster-state">
        <Badge
          variant={row.isFinalParticipant ? "default" : "outline"}
          data-testid={
            row.isFinalParticipant ? TOUR_WORKSPACE_TRANSPORT_TEST_IDS.finalBadge : undefined
          }
        >
          {t(row.isFinalParticipant ? "finalParticipant" : "approvedParticipant")}
        </Badge>
        {canManage && row.isOperationalParticipant && !row.isFinalParticipant ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={finalizingId === row.registrationId}
            data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.finalizeParticipantButton}
            onClick={() => void finalizeParticipant(row.registrationId)}
          >
            {t("addToFinalRoster")}
          </Button>
        ) : null}
        {canManage && row.isFinalParticipant && paymentRequired ? (
          <Button asChild type="button" size="sm" variant="ghost">
            <OperatorInternalLink
              href={`/tours/${encodeURIComponent(tourId)}/workspace?tab=finance`}
            >
              {t("followPayment")}
            </OperatorInternalLink>
          </Button>
        ) : null}
      </div>
    );
  }

  function renderPaymentSummary(row: TourOperationalRosterRow) {
    const amountDue = formatOperationalRosterAmountDue(row);
    return (
      <div className="space-y-1 text-sm">
        <Badge variant="secondary">{t(`financial.${row.financialDisplayState}`)}</Badge>
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
        {finalizationMessage !== null ? (
          <p
            className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
            role="status"
          >
            {finalizationMessage}
          </p>
        ) : null}
        <TourWorkspaceTransportControls filter={filter} onFilterChange={setFilter} />
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.exportFinalRosterButton}
              onClick={() => void exportFinalRoster()}
              disabled={exporting}
            >
              {exporting ? t("exporting") : t("exportFinalRoster")}
            </Button>
            {exportError !== null ? (
              <p className="text-sm text-destructive" role="alert">
                {exportError}
              </p>
            ) : null}
          </div>
        ) : null}

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
                <caption className="sr-only">{t("tableCaption")}</caption>
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="w-[28%] px-3 py-2 font-medium">
                      {tTable("guest")}
                    </th>
                    <th scope="col" className="w-[16%] px-3 py-2 font-medium">
                      {t("columns.participation")}
                    </th>
                    <th scope="col" className="w-[20%] px-3 py-2 font-medium">
                      {tTable("transportIntake")}
                    </th>
                    <th scope="col" className="w-[22%] px-3 py-2 font-medium">
                      {t("columns.note")}
                    </th>
                    <th scope="col" className="w-[14%] px-3 py-2 font-medium">
                      {t("columns.financial")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const transportLabel = formatRowTransportLabel(row);
                    const paymentDueAt = resolveOperationalRosterActionablePaymentDueAt(row);
                    return (
                      <tr
                        key={row.registrationId}
                        data-registration-id={row.registrationId}
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
                  <article
                    key={row.registrationId}
                    data-registration-id={row.registrationId}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      {renderParticipantIdentity(row)}
                      <div className="min-w-0 max-w-full">{renderParticipationState(row)}</div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-start gap-3">
                        <span className="min-w-0 text-muted-foreground">
                          {tTable("transportIntake")}
                        </span>
                        <span className="min-w-0 break-words text-end">
                          {transportLabel ?? "—"}
                        </span>
                      </div>
                      <div className="grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-start gap-3">
                        <span className="min-w-0 text-muted-foreground">{t("columns.note")}</span>
                        <span
                          className="min-w-0 break-words text-end"
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

function readAttachmentFilename(contentDisposition: string | null): string | null {
  const match = contentDisposition?.match(/filename="([^"]+)"/i);
  const filename = match?.[1]?.trim() ?? "";
  return filename.length > 0 ? filename : null;
}
