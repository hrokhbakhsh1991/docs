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
import { mergePaymentFollowUpParticipants } from "@/features/tours/tour-workspace-payment-follow-up-logic";
import type { TourWorkspacePaymentFollowUpParticipantRow } from "@/features/tours/tour-workspace-payment-follow-up-logic";

type PaymentFollowUpListState = {
  readonly loading: boolean;
  readonly error: string | null;
  readonly rows: readonly TourWorkspacePaymentFollowUpParticipantRow[];
  readonly refresh: () => void;
};

export function useTourWorkspacePaymentFollowUpList(
  tourId: string,
  refreshNonce = 0
): PaymentFollowUpListState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<readonly TourWorkspacePaymentFollowUpParticipantRow[]>([]);
  const [fetchNonce, setFetchNonce] = useState(0);

  const refresh = useCallback(() => {
    setFetchNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    void refreshNonce;
  }, [refreshNonce]);

  useEffect(() => {
    const normalizedTourId = tourId.trim();
    if (normalizedTourId.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const pendingQuery = buildBookingsApiQuery(
      {
        ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
        view: "ops",
        status: "pending",
        tourId: normalizedTourId,
      },
      { limit: 100 }
    );

    void Promise.all([
      fetch(`/api/bookings?${pendingQuery}`, {
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`BOOKINGS_PENDING_HTTP_${response.status}`);
        }
        const payload = (await response.json()) as BookingsListResponse;
        return payload.items ?? [];
      }),
      fetch(buildTourOperationalRosterHref(normalizedTourId, "operational"), {
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`TOUR_ROSTER_HTTP_${response.status}`);
        }
        const payload = (await response.json()) as TourOperationalRosterResponse;
        return payload.items ?? [];
      }),
    ])
      .then(([pendingBookings, rosterRows]) => {
        if (controller.signal.aborted) {
          return;
        }
        setRows(
          mergePaymentFollowUpParticipants({
            pendingBookings: pendingBookings as readonly BookingListItem[],
            rosterRows,
          })
        );
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setRows([]);
        setError(loadError instanceof Error ? loadError.message : "PAYMENT_FOLLOW_UP_LIST_FAILED");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [fetchNonce, tourId]);

  return { loading, error, rows, refresh };
}
