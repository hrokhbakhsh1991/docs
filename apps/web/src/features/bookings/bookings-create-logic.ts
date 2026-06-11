import type { BookingCreateFormState, BookingCreateTourOption } from "./bookings-create-types";

export type BookingCreateValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly field: keyof BookingCreateFormState; readonly message: string };

export function validateBookingCreateForm(
  form: BookingCreateFormState,
  tours: readonly BookingCreateTourOption[]
): BookingCreateValidationResult {
  if (form.tourId.trim().length === 0) {
    return { ok: false, field: "tourId", message: "TOUR_REQUIRED" };
  }
  const tour = tours.find((item) => item.id === form.tourId);
  if (tour === undefined) {
    return { ok: false, field: "tourId", message: "TOUR_NOT_FOUND" };
  }
  if (form.guestLabel.trim().length === 0) {
    return { ok: false, field: "guestLabel", message: "GUEST_REQUIRED" };
  }
  const partySize = Number(form.partySize);
  if (!Number.isFinite(partySize) || partySize <= 0) {
    return { ok: false, field: "partySize", message: "PARTY_SIZE_INVALID" };
  }
  if (form.departureAt.trim().length === 0) {
    return { ok: false, field: "departureAt", message: "DEPARTURE_REQUIRED" };
  }
  return { ok: true };
}

export function buildBookingCreatePayload(
  form: BookingCreateFormState,
  tours: readonly BookingCreateTourOption[]
): Record<string, unknown> | null {
  const validation = validateBookingCreateForm(form, tours);
  if (!validation.ok) {
    return null;
  }
  const tour = tours.find((item) => item.id === form.tourId);
  if (tour === undefined) {
    return null;
  }
  const partySize = Number(form.partySize);
  const departureAt = new Date(`${form.departureAt}T12:00:00.000Z`).toISOString();
  return {
    tourId: tour.id,
    tourTitle: tour.title,
    guestLabel: form.guestLabel.trim(),
    partySize,
    departureAt,
    ...(form.guestEmail.trim().length > 0 ? { guestEmail: form.guestEmail.trim() } : {}),
    ...(form.guestPhone.trim().length > 0 ? { guestPhone: form.guestPhone.trim() } : {}),
  };
}

export function departureInputFromTour(tour: BookingCreateTourOption | undefined): string {
  if (tour?.departureAt === null || tour?.departureAt === undefined) {
    return "";
  }
  const date = new Date(tour.departureAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export function mapToursToCreateOptions(
  items: ReadonlyArray<{ readonly id: string; readonly title: string; readonly departureAt: string | null }>
): BookingCreateTourOption[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    departureAt: item.departureAt,
  }));
}

export type BookingCreatePageState =
  | { readonly type: "locked" }
  | { readonly type: "loading_tours" }
  | { readonly type: "ready" }
  | { readonly type: "submitting" }
  | { readonly type: "error"; readonly message: string };

export function resolveBookingCreatePageState(input: {
  readonly canManage: boolean;
  readonly loadingTours: boolean;
  readonly submitting: boolean;
  readonly error: string | null;
}): BookingCreatePageState {
  if (!input.canManage) {
    return { type: "locked" };
  }
  if (input.submitting) {
    return { type: "submitting" };
  }
  if (input.loadingTours) {
    return { type: "loading_tours" };
  }
  if (input.error !== null) {
    return { type: "error", message: input.error };
  }
  return { type: "ready" };
}
