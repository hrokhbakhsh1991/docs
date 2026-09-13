"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import type { AppLocale } from "@/i18n/routing";
import {
  TOUR_WORKSPACE_TRANSPORT_TEST_IDS,
  normalizeDriverCompensationPerSeat,
  type DriverSettlementRow,
} from "@/features/tours/tour-workspace-transport-logic";

type DriverSettlementPanelProps = {
  readonly tourId: string;
  readonly driverRegistrationId: string | null;
  readonly passengerIds: readonly string[];
};

export function DriverSettlementPanel({
  tourId,
  driverRegistrationId,
  passengerIds,
}: DriverSettlementPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.workspace.transport");
  const [unitMinor, setUnitMinor] = useState("50000");
  const [settlements, setSettlements] = useState<DriverSettlementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [settlementLoadError, setSettlementLoadError] = useState(false);

  const loadSettlements = useCallback(async (): Promise<boolean> => {
    setSettlementLoadError(false);
    try {
      const res = await fetch(`/api/tours/${encodeURIComponent(tourId)}/driver-settlements`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("SETTLEMENTS_LOAD_FAILED");
      const payload = (await res.json()) as { settlements?: DriverSettlementRow[] };
      setSettlements(payload.settlements ?? []);
      return true;
    } catch {
      setSettlements([]);
      setSettlementLoadError(true);
      return false;
    }
  }, [tourId]);

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  const saveAllocations = async () => {
    if (driverRegistrationId === null) return;
    const res = await fetch(`/api/tours/${encodeURIComponent(tourId)}/transport-allocations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allocations: passengerIds.map((passengerRegistrationId) => ({
          driverRegistrationId,
          passengerRegistrationId,
        })),
      }),
    });
    if (!res.ok) throw new Error("ALLOC_FAILED");
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
      setMessage(
        loaded ? t("settlement.rosterFrozen") : t("settlement.rosterFrozenLoadFailed")
      );
    } catch (e: unknown) {
      setMessage(e instanceof Error && e.message === "ALLOC_FAILED"
        ? t("settlement.allocationFailed")
        : t("settlement.freezeFailed"));
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
      const res = await fetch(
        `/api/tours/${encodeURIComponent(tourId)}/driver-settlements/${encodeURIComponent(settlementId)}/approve-payable`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      if (!res.ok) throw new Error(`PAYABLE_HTTP_${res.status}`);
      await loadSettlements();
      setMessage(t("settlement.financePayableOpened"));
    } catch (e: unknown) {
      setMessage(t("settlement.payableFailed"));
    } finally {
      setLoading(false);
    }
  };

  const primary =
    driverRegistrationId !== null
      ? settlements.find((s) => s.driverRegistrationId === driverRegistrationId)
      : settlements[0];

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

  return (
    <div
      className="space-y-3 rounded-lg border p-4"
      data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.settlementPanel}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          {t("settlement.unitPerSeat")}
          <Input
            value={unitMinor}
            inputMode="numeric"
            aria-describedby="driver-settlement-unit-hint"
            onChange={(e) => setUnitMinor(e.target.value)}
            className="mt-1 w-32"
          />
          <span id="driver-settlement-unit-hint" className="sr-only">
            {t("settlement.unitAmountHint")}
          </span>
        </label>
        <Button
          type="button"
          size="sm"
          disabled={loading || driverRegistrationId === null}
          data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.freezeButton}
          onClick={() => void freezeRoster()}
        >
          {t("settlement.finalizeRoster")}
        </Button>
      </div>
      {primary ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            {t("settlement.billableSeats", {
              billable: primary.billableQuantity,
              offered: primary.offeredSeats,
            })}
          </span>
          <span data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.settlementTotal}>
            {t("settlement.total", {
              amount: formatMinorAmount(primary.totalMinor, primary.currency, locale),
            })}
          </span>
          <Badge data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.settlementStatus}>
            {settlementStatusLabel(primary.status)}
          </Badge>
          {primary.status === "draft" || primary.status === "confirmed" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.approvePayableButton}
              onClick={() => void approvePayable(primary.settlementId)}
            >
              {t("settlement.approvePayable")}
            </Button>
          ) : null}
        </div>
      ) : settlementLoadError ? (
        <p className="text-sm text-destructive">{t("settlement.loadFailed")}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("settlement.noSettlement")}</p>
      )}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
