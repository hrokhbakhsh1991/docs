export type BookingCreateFormState = {
  readonly tourId: string;
  readonly guestLabel: string;
  readonly guestEmail: string;
  readonly guestPhone: string;
  readonly partySize: string;
  readonly departureAt: string;
};

export type BookingCreateTourOption = {
  readonly id: string;
  readonly title: string;
  readonly departureAt: string | null;
};

export type BookingCreateResponse = {
  readonly id?: string;
  readonly status?: string;
  readonly code?: string;
};

export const BOOKINGS_CREATE_TEST_IDS = {
  page: "operator-bookings-create-page",
  form: "operator-bookings-create-form",
  tourSelect: "operator-bookings-create-tour",
  guestInput: "operator-bookings-create-guest",
  partyInput: "operator-bookings-create-party",
  departureInput: "operator-bookings-create-departure",
  submitButton: "operator-bookings-create-submit",
  locked: "operator-bookings-create-locked",
  success: "operator-bookings-create-success",
} as const;

export const DEFAULT_BOOKING_CREATE_FORM: BookingCreateFormState = {
  tourId: "",
  guestLabel: "",
  guestEmail: "",
  guestPhone: "",
  partySize: "1",
  departureAt: "",
};
