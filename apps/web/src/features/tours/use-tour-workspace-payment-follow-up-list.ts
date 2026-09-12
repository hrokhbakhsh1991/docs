"use client";

import { useCallback, useEffect, useState } from "react";

import {
  buildBookingsApiQuery,
} from "@/features/bookings/bookings-command-center-logic";
import type {
  BookingListItem,
  BookingsListResponse,
} from "@/features/bookings/bookings-command-center-types";
import { DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY } from "@/features/bookings/bookings-command-center-types";
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

async function loadPendingBookingsForFollowUp(
  tourId: string,
  signal: AbortSignal
): Promise<readonly BookingListItem[]> {
  const pendingQuery = buildBookingsApiQuery(
    {
      ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
      view: "ops",
      status: "pending",
      tourId,
    },
    { limit: 100 }
  );
  const response = await fetch(`/api/bookings?${pendingQuery}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(toPaymentFollowUpHttpError("BOOKINGS_PENDING_HTTP", response.status));
  }
  const payload = (await response.json()) as BookingsListResponse;
  return payload.items ?? [];
}

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
        const [pendingResult, rosterResult] = await Promise.allSettled([
          loadPendingBookingsForFollowUp(normalizedTourId, controller.signal),
          loadOperationalRosterForFollowUp(normalizedTourId, controller.signal),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        const pending =
          pendingResult.status === "fulfilled"
            ? { ok: true as const, items: pendingResult.value }
            : {
                ok: false as const,
                error:
                  pendingResult.reason instanceof Error
                    ? pendingResult.reason.message
                    : "BOOKINGS_PENDING_FETCH_FAILED",
              };
        const roster =
          rosterResult.status === "fulfilled"
            ? { ok: true as const, items: rosterResult.value }
            : {
                ok: false as const,
                error:
                  rosterResult.reason instanceof Error
                    ? rosterResult.reason.message
                    : "TOUR_ROSTER_FETCH_FAILED",
              };

        const outcome = resolvePaymentFollowUpLoadOutcome({ pending, roster });
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
