"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import {
  buildTourTransportAllocations,
  canAssignDongParticipantToDriver,
  normalizeDriverCompensationPerSeat,
  TOUR_WORKSPACE_TRANSPORT_TEST_IDS,
  type DriverSettlementRow,
  type TourTransportParticipant,
} from "@/features/tours/tour-workspace-transport-logic";

type DriverSettlementPanelProps = {
  readonly tourId: string;
  readonly drivers: readonly TourTransportParticipant[];
  readonly passengers: readonly TourTransportParticipant[];
};

type AllocationResponse = {
  readonly allocations?: readonly {
    readonly driverRegistrationId: string;
    readonly passengerRegistrationId: string;
  }[];
};

export function DriverSettlementPanel({ tourId, drivers, passengers }: DriverSettlementPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.workspace.transport");
  const [unitMinor, setUnitMinor] = useState("50000");
  const [settlements, setSettlements] = useState<DriverSettlementRow[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [settlementLoadError, setSettlementLoadError] = useState(false);
  const [allocationLoadError, setAllocationLoadError] = useState(false);

  const loadSettlements = useCallback(async (): Promise<boolean> => {
    setSettlementLoadError(false);
    try {
      const response = await fetch(`/api/tours/${encodeURIComponent(tourId)}/driver-settlements`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("SETTLEMENTS_LOAD_FAILED");
      const payload = (await response.json()) as { settlements?: DriverSettlementRow[] };
      setSettlements(payload.settlements ?? []);
      return true;
    } catch {
      setSettlements([]);
      setSettlementLoadError(true);
      return false;
    }
  }, [tourId]);

  const loadAllocations = useCallback(async (): Promise<boolean> => {
    setAllocationLoadError(false);
    try {
      const response = await fetch(
        `/api/tours/${encodeURIComponent(tourId)}/transport-allocations`,
        {
          cache: "no-store",
        }
      );
      if (!response.ok) throw new Error("ALLOCATIONS_LOAD_FAILED");
      const payload = (await response.json()) as AllocationResponse;
      const next: Record<string, string> = {};
      for (const allocation of payload.allocations ?? []) {
        next[allocation.passengerRegistrationId] = allocation.driverRegistrationId;
      }
      setAssignments(next);
      return true;
    } catch {
      setAssignments({});
      setAllocationLoadError(true);
      return false;
    }
  }, [tourId]);

  useEffect(() => {
    void loadSettlements();
    void loadAllocations();
  }, [loadAllocations, loadSettlements]);

  const isFrozen = settlements.length > 0;
  const assignedSeats = (driverId: string, excludingPassengerId?: string): number =>
    passengers
      .filter(
        (passenger) =>
          passenger.registrationId !== excludingPassengerId &&
          assignments[passenger.registrationId] === driverId
      )
      .reduce((total, passenger) => total + Math.max(1, Math.trunc(passenger.partySize)), 0);

  const setPassengerDriver = (passenger: TourTransportParticipant, nextDriverId: string) => {
    if (nextDriverId.length === 0) {
      setAssignments((current) => {
        const next = { ...current };
        delete next[passenger.registrationId];
        return next;
      });
      setMessage(null);
      return;
    }
    const driver = drivers.find((candidate) => candidate.registrationId === nextDriverId);
    if (
      driver === undefined ||
      !canAssignDongParticipantToDriver({
        driver,
        passenger,
        passengerRows: passengers,
        assignments,
      })
    ) {
      setMessage(t("settlement.assignmentCapacityExceeded"));
      return;
    }
    setAssignments((current) => ({ ...current, [passenger.registrationId]: nextDriverId }));
    setMessage(null);
  };

  const saveAllocations = async () => {
    const response = await fetch(`/api/tours/${encodeURIComponent(tourId)}/transport-allocations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocations: buildTourTransportAllocations(assignments) }),
    });
    if (!response.ok) throw new Error("ALLOC_FAILED");
    const payload = (await response.json()) as AllocationResponse;
    const next: Record<string, string> = {};
    for (const allocation of payload.allocations ?? []) {
      next[allocation.passengerRegistrationId] = allocation.driverRegistrationId;
    }
    setAssignments(next);
  };

  const saveAssignments = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await saveAllocations();
      setMessage(t("settlement.allocationsSaved"));
    } catch {
      setMessage(t("settlement.allocationFailed"));
    } finally {
      setLoading(false);
    }
  };

  const freezeRoster = async () => {
    const normalizedUnitMinor = normalizeDriverCompensationPerSeat(unitMinor);
    if (normalizedUnitMinor === null) {
      setMessage(t("settlement.unitAmountInvalid"));
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await saveAllocations();
      const res = await fetch(`/api/tours/${encodeURIComponent(tourId)}/roster/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverCompensationPerSeatMinor: normalizedUnitMinor,
          currency: "IRR",
        }),
      });
      if (!res.ok) throw new Error(`FREEZE_HTTP_${res.status}`);
      const loaded = await loadSettlements();
      setMessage(loaded ? t("settlement.rosterFrozen") : t("settlement.rosterFrozenLoadFailed"));
    } catch (error: unknown) {
      setMessage(
        error instanceof Error && error.message === "ALLOC_FAILED"
          ? t("settlement.allocationFailed")
          : t("settlement.freezeFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  const approvePayable = async (settlementId: string) => {
    setLoading(true);
    try {
      const confirmResponse = await fetch(
        `/api/tours/${encodeURIComponent(tourId)}/driver-settlements/${encodeURIComponent(settlementId)}/confirm`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      if (!confirmResponse.ok) throw new Error("PAYABLE_FAILED");
      const response = await fetch(
        `/api/tours/${encodeURIComponent(tourId)}/driver-settlements/${encodeURIComponent(settlementId)}/approve-payable`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      if (!response.ok) throw new Error("PAYABLE_FAILED");
      await loadSettlements();
      setMessage(t("settlement.financePayableOpened"));
    } catch {
      setMessage(t("settlement.payableFailed"));
    } finally {
      setLoading(false);
    }
  };

  const settlementStatusLabel = (status: string): string => {
    switch (status) {
      case "draft":
        return t("settlement.status.draft");
      case "confirmed":
        return t("settlement.status.confirmed");
      case "approved":
        return t("settlement.status.approved");
      case "paid":
        return t("settlement.status.paid");
      default:
        return t("settlement.status.unknown");
    }
  };

  const isReadOnly = isFrozen || settlementLoadError || allocationLoadError;
  return (
    <div
      className="space-y-4 rounded-lg border p-4"
      data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.settlementPanel}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{t("settlement.carAssignmentsTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("settlement.carAssignmentsDescription")}</p>
      </div>

      {allocationLoadError ? (
        <p className="text-sm text-destructive" role="alert">
          {t("settlement.allocationsLoadFailed")}
        </p>
      ) : null}
      {settlementLoadError ? (
        <p className="text-sm text-destructive" role="alert">
          {t("settlement.loadFailed")}
        </p>
      ) : null}
      {isFrozen ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("settlement.rosterAlreadyFrozen")}
        </p>
      ) : null}

      <div className="space-y-2">
        {passengers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settlement.noDongPassengers")}</p>
        ) : (
          passengers.map((passenger) => (
            <div
              key={passenger.registrationId}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)] sm:items-center"
            >
              <span className="min-w-0 text-sm">
                <span className="font-medium">{passenger.guestLabel}</span>
                <span className="ms-2 text-muted-foreground">
                  {t("settlement.partySeats", {
                    count: formatLocalizedNumber(passenger.partySize, locale),
                  })}
                </span>
              </span>
              <label className="sr-only" htmlFor={`car-assignment-${passenger.registrationId}`}>
                {t("settlement.assignPassenger", { name: passenger.guestLabel })}
              </label>
              <select
                id={`car-assignment-${passenger.registrationId}`}
                className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
                value={assignments[passenger.registrationId] ?? ""}
                disabled={loading || isReadOnly}
                onChange={(event) => setPassengerDriver(passenger, event.target.value)}
                data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.carAssignment}
              >
                <option value="">{t("settlement.unassigned")}</option>
                {drivers.map((driver) => {
                  const allowed = canAssignDongParticipantToDriver({
                    driver,
                    passenger,
                    passengerRows: passengers,
                    assignments,
                  });
                  const seats = Math.max(0, Math.trunc(driver.personalCarOccupants ?? 0));
                  return (
                    <option
                      key={driver.registrationId}
                      value={driver.registrationId}
                      disabled={
                        !allowed && assignments[passenger.registrationId] !== driver.registrationId
                      }
                    >
                      {t("settlement.driverOption", {
                        name: driver.guestLabel,
                        remaining: formatLocalizedNumber(
                          Math.max(
                            0,
                            seats - assignedSeats(driver.registrationId, passenger.registrationId)
                          ),
                          locale
                        ),
                        seats: formatLocalizedNumber(seats, locale),
                      })}
                    </option>
                  );
                })}
              </select>
            </div>
          ))
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {drivers.map((driver) => {
          const offered = Math.max(0, Math.trunc(driver.personalCarOccupants ?? 0));
          const assigned = assignedSeats(driver.registrationId);
          const settlement = settlements.find(
            (row) => row.driverRegistrationId === driver.registrationId
          );
          return (
            <div
              key={driver.registrationId}
              className="space-y-2 rounded-md border p-3"
              data-driver-registration-id={driver.registrationId}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{driver.guestLabel}</span>
                <Badge variant="outline">
                  {t("settlement.assignedSeats", {
                    assigned: formatLocalizedNumber(assigned, locale),
                    offered: formatLocalizedNumber(offered, locale),
                  })}
                </Badge>
              </div>
              {settlement ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>
                    {t("settlement.billableSeats", {
                      billable: settlement.billableQuantity,
                      offered: settlement.offeredSeats,
                    })}
                  </span>
                  <span data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.settlementTotal}>
                    {t("settlement.total", {
                      amount: formatMinorAmount(settlement.totalMinor, settlement.currency, locale),
                    })}
                  </span>
                  <Badge data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.settlementStatus}>
                    {settlementStatusLabel(settlement.status)}
                  </Badge>
                  {settlement.status === "draft" || settlement.status === "confirmed" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.approvePayableButton}
                      onClick={() => void approvePayable(settlement.settlementId)}
                    >
                      {t("settlement.approvePayable")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {!isFrozen ? (
          <label className="min-w-0 text-sm sm:flex-1">
            {t("settlement.unitPerSeat")}
            <Input
              value={unitMinor}
              inputMode="numeric"
              aria-describedby="driver-settlement-unit-hint"
              onChange={(event) => setUnitMinor(event.target.value)}
              className="mt-1 w-full sm:w-32"
            />
            <span id="driver-settlement-unit-hint" className="sr-only">
              {t("settlement.unitAmountHint")}
            </span>
          </label>
        ) : null}
        {!isFrozen ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={loading || isReadOnly}
              onClick={() => void saveAssignments()}
              data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.saveAllocationsButton}
            >
              {t("settlement.saveAssignments")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              disabled={loading || isReadOnly}
              data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.freezeButton}
              onClick={() => void freezeRoster()}
            >
              {t("settlement.finalizeRoster")}
            </Button>
          </>
        ) : null}
      </div>
      {!settlementLoadError && settlements.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("settlement.noSettlement")}</p>
      ) : null}
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
