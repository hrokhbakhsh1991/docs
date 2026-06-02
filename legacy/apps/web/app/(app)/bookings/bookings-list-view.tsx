"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { BookingStatusBadge } from "@/components/shared/badges";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { useAuthBffQueryGateForTenant } from "@/hooks/use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { bookingKeys, tourKeys } from "@/lib/query-keys";
import { bookingsUseLiveApi, getBookings } from "@/lib/services/bookings.service";
import { getTours } from "@/lib/services/tours.service";
import { Button, Card, CardBody, EmptyState, ErrorState, LoadingState } from "@tour/ui";

import listStyles from "./bookings.module.css";

function bookingListErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "No bookings were found for your account.";
    return error.message.trim() || "Could not load bookings.";
  }
  return "Could not load bookings. Check your connection and try again.";
}

function formatBookingCreatedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function BookingsListView() {
  const router = useRouter();
  const { isHydrated, isAuthenticated } = useAuth();
  const liveApi = bookingsUseLiveApi();
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  const queryEnabled = liveApi && authBffQueryEnabled;

  const {
    data,
    isPending: bookingsLoading,
    isError: bookingsError,
    error: bookingsQueryError,
    refetch
  } = useQuery({
    queryKey: bookingKeys.list(tenantId ?? ""),
    queryFn: () => getBookings(),
    enabled: queryEnabled,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const { data: toursData } = useQuery({
    queryKey: tourKeys.catalog(tenantId ?? ""),
    queryFn: ({ signal }) => getTours({ search: "" }, { signal }),
    enabled: queryEnabled,
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const bookings = data?.items ?? [];
  const toursById = useMemo(
    () => new Map((toursData?.tours ?? []).map((t) => [t.id, t.title] as const)),
    [toursData?.tours]
  );

  return (
    <Card>
      <CardBody>
        {!isHydrated && liveApi ? (
          <LoadingState message="Loading session…" />
        ) : liveApi && !isAuthenticated ? (
          <EmptyState
            title="Sign in required"
            description="Your session is missing or expired. Sign in to view your bookings."
            action={
              <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                Sign in
              </Button>
            }
          />
        ) : bookingsLoading ? (
          <LoadingState message="Loading bookings…" />
        ) : bookingsError ? (
          <ErrorState
            title="Could not load bookings"
            message={bookingListErrorMessage(bookingsQueryError)}
            onRetry={() => void refetch()}
          />
        ) : bookings.length === 0 ? (
          <EmptyState
            title="No bookings yet"
            description="You have not registered for any tours yet."
            action={
              <Link href="/tours" className={listStyles.link}>
                Browse tours
              </Link>
            }
          />
        ) : (
          <div className={listStyles.tableWrap}>
            <table className={listStyles.table}>
              <thead>
                <tr>
                  <th scope="col">Tour</th>
                  <th scope="col">Booking status</th>
                  <th scope="col">Created</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{toursById.get(booking.tourId) ?? booking.tourId}</td>
                    <td>
                      <BookingStatusBadge status={booking.status} />
                    </td>
                    <td>{formatBookingCreatedAt(booking.createdAt)}</td>
                    <td>
                      <Link href={`/bookings/${booking.id}`} className={listStyles.link}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
