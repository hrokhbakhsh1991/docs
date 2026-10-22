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
import { createAbortTimeout } from "@/utils/create-abort-timeout";

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
  const response = await fetch(buildTourOperationalRosterHref(tourId, "unpaid"), {
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

    let cancelled = false;
    const request = createAbortTimeout(25_000);
    setLoading(true);
    setError(null);
    setRosterDegraded(false);

    void (async () => {
      try {
        const rosterResult = await Promise.allSettled([
          loadOperationalRosterForFollowUp(normalizedTourId, request.signal),
        ]);

        if (cancelled) {
          return;
        }
        if (request.timedOut()) {
          setRows([]);
          setError("TOUR_ROSTER_FETCH_TIMEOUT");
          setRosterDegraded(false);
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
        if (cancelled) {
          return;
        }
        setRows([]);
        setError(
          request.timedOut()
            ? "TOUR_ROSTER_FETCH_TIMEOUT"
            : loadError instanceof Error
              ? loadError.message
              : "PAYMENT_FOLLOW_UP_LIST_FAILED"
        );
        setRosterDegraded(false);
      } finally {
        request.dispose();
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      request.dispose();
    };
  }, [fetchNonce, refreshNonce, tourId]);

  return { loading, error, rosterDegraded, rows, refresh };
}
