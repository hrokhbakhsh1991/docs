import type { BookingCreateFormState, BookingCreateTourOption } from "@/features/bookings/bookings-create-types";
import { departureInputFromTour } from "@/features/bookings/bookings-create-logic";

import type { OperatorTourDetailResponse } from "./operator-tour-detail-types";

export function mapTourDetailToCreateOption(
  detail: OperatorTourDetailResponse
): BookingCreateTourOption {
  return {
    id: detail.id,
    title: detail.projection.title,
    departureAt: detail.projection.departureAt,
  };
}

export function initRegisterFormFromTour(tour: BookingCreateTourOption): BookingCreateFormState {
  return {
    tourId: tour.id,
    guestLabel: "",
    guestEmail: "",
    guestPhone: "",
    partySize: "1",
    departureAt: departureInputFromTour(tour),
  };
}

export type TourRegisterPageState =
  | { readonly type: "locked" }
  | { readonly type: "loading_tour" }
  | { readonly type: "ready" }
  | { readonly type: "submitting" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "not_found" };

export function resolveTourRegisterPageState(input: {
  readonly canManage: boolean;
  readonly loadingTour: boolean;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly tourNotFound: boolean;
}): TourRegisterPageState {
  if (!input.canManage) {
    return { type: "locked" };
  }
  if (input.submitting) {
    return { type: "submitting" };
  }
  if (input.loadingTour) {
    return { type: "loading_tour" };
  }
  if (input.tourNotFound) {
    return { type: "not_found" };
  }
  if (input.error !== null) {
    return { type: "error", message: input.error };
  }
  return { type: "ready" };
}

export function buildTourRegisterSuccessRedirect(tourId: string): string {
  const params = new URLSearchParams();
  params.set("status", "pending");
  params.set("tourId", tourId.trim());
  return `/bookings?${params.toString()}`;
}

/** @deprecated Use buildTourRegisterSuccessRedirect(tourId) */
export const TOUR_REGISTER_SUCCESS_REDIRECT = "/bookings?status=pending";
