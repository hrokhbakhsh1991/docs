"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  TOUR_WORKSPACE_TRANSPORT_TEST_IDS,
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
  const [unitMinor, setUnitMinor] = useState("50000");
  const [settlements, setSettlements] = useState<DriverSettlementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadSettlements = useCallback(async () => {
    const res = await fetch(`/api/tours/${encodeURIComponent(tourId)}/driver-settlements`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const payload = (await res.json()) as { settlements?: DriverSettlementRow[] };
    setSettlements(payload.settlements ?? []);
  }, [tourId]);

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  const saveAllocations = async () => {
    if (driverRegistrationId === null) return;
    setLoading(true);
    setMessage(null);
    try {
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
      if (!res.ok) throw new Error(`ALLOC_HTTP_${res.status}`);
      setMessage("Allocations saved");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "ALLOC_FAILED");
    } finally {
      setLoading(false);
    }
  };

  const freezeRoster = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await saveAllocations();
      const res = await fetch(`/api/tours/${encodeURIComponent(tourId)}/roster/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverCompensationPerSeatMinor: unitMinor,
          currency: "IRR",
        }),
      });
      if (!res.ok) throw new Error(`FREEZE_HTTP_${res.status}`);
      await loadSettlements();
      setMessage("Roster frozen — settlements generated");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "FREEZE_FAILED");
    } finally {
      setLoading(false);
    }
  };

  const approvePayable = async (settlementId: string) => {
    setLoading(true);
    try {
      await fetch(
        `/api/tours/${encodeURIComponent(tourId)}/driver-settlements/${encodeURIComponent(settlementId)}/confirm`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const res = await fetch(
        `/api/tours/${encodeURIComponent(tourId)}/driver-settlements/${encodeURIComponent(settlementId)}/approve-payable`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      if (!res.ok) throw new Error(`PAYABLE_HTTP_${res.status}`);
      await loadSettlements();
      setMessage("Finance payable opened");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "PAYABLE_FAILED");
    } finally {
      setLoading(false);
    }
  };

  const primary =
    driverRegistrationId !== null
      ? settlements.find((s) => s.driverRegistrationId === driverRegistrationId)
      : settlements[0];

  return (
    <div
      className="space-y-3 rounded-lg border p-4"
      data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.settlementPanel}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Per-seat (minor)
          <Input value={unitMinor} onChange={(e) => setUnitMinor(e.target.value)} className="mt-1 w-32" />
        </label>
        <Button
          type="button"
          size="sm"
          disabled={loading || driverRegistrationId === null}
          data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.freezeButton}
          onClick={() => void freezeRoster()}
        >
          Finalize roster
        </Button>
      </div>
      {primary ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            Billable: {primary.billableQuantity} / offered {primary.offeredSeats}
          </span>
          <span data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.settlementTotal}>
            Total: {primary.totalMinor} {primary.currency}
          </span>
          <Badge data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.settlementStatus}>{primary.status}</Badge>
          {primary.status === "draft" || primary.status === "confirmed" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.approvePayableButton}
              onClick={() => void approvePayable(primary.settlementId)}
            >
              Approve payable
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No settlement yet — finalize roster after assigning passengers.</p>
      )}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
