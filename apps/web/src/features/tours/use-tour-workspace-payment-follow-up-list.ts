"use client";

import { useCallback, useEffect, useState } from "react";

import {
  buildTourOperationalRosterHref,
  type TourOperationalRosterResponse,
} from "@/features/tours/tour-workspace-transport-logic";
import type { TourWorkspacePaymentFollowUpParticipantRow } from "@/features/tours/tour-workspace-payment-follow-up-logic";
import {
  resolvePaymentFollowUpLoadOutcome,
  toPaymentFollowUpHttpError,
} from "@/features/tours/tour-workspace-payment-follow-up-load";

type PaymentFollowUpListState = {
  readonly loading: boolean;
  readonly error: string | null;
  readonly rosterDegraded: boolean;
  readonly rows: readonly TourWorkspacePaymentFollowUpParticipantRow[];
  readonly refresh: () => void;
};

async function loadOperationalRosterForFollowUp(
  tourId: string,
  signal: AbortSignal
): Promise<TourOperationalRosterResponse["items"]> {
  const response = await fetch(buildTourOperationalRosterHref(tourId, "operational"), {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(toPaymentFollowUpHttpError("TOUR_ROSTER_HTTP", response.status));
  }
  const payload = (await response.json()) as TourOperationalRosterResponse;
  return payload.items ?? [];
}

export function useTourWorkspacePaymentFollowUpList(
  tourId: string,
  refreshNonce = 0
): PaymentFollowUpListState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rosterDegraded, setRosterDegraded] = useState(false);
  const [rows, setRows] = useState<readonly TourWorkspacePaymentFollowUpParticipantRow[]>([]);
  const [fetchNonce, setFetchNonce] = useState(0);

  const refresh = useCallback(() => {
    setFetchNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    const normalizedTourId = tourId.trim();
    if (normalizedTourId.length === 0) {
      setRows([]);
      setLoading(false);
      setError(null);
      setRosterDegraded(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setRosterDegraded(false);

    void (async () => {
      try {
        const rosterResult = await Promise.allSettled([
          loadOperationalRosterForFollowUp(normalizedTourId, controller.signal),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        const roster =
          rosterResult[0]?.status === "fulfilled"
            ? { ok: true as const, items: rosterResult[0].value }
            : {
                ok: false as const,
                error:
                  rosterResult[0]?.reason instanceof Error
                    ? rosterResult[0].reason.message
                    : "TOUR_ROSTER_FETCH_FAILED",
              };

        const outcome = resolvePaymentFollowUpLoadOutcome({ roster });
        setRows(outcome.rows);
        setError(outcome.error);
        setRosterDegraded(outcome.rosterDegraded);
      } catch (loadError: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        setRows([]);
        setError(loadError instanceof Error ? loadError.message : "PAYMENT_FOLLOW_UP_LIST_FAILED");
        setRosterDegraded(false);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [fetchNonce, refreshNonce, tourId]);

  return { loading, error, rosterDegraded, rows, refresh };
}
