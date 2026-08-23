/**
 * Booking duplicate-protection capability contract (CW4-07).
 * Documents host probe kinds + partial-unique SoT without importing persistence.
 * Urban email-only policy lives in workspace-urban — not here.
 */

/** Active booking rows considered for duplicate enforcement. */
export const BOOKING_DUPLICATE_ACTIVE_STATUS_EXCLUSIONS = [
  "cancelled",
  "rejected",
] as const;

/** Application-layer duplicate probe kinds exposed via BookingPublicPort. */
export const BOOKING_DUPLICATE_PROBE_KINDS = [
  "user",
  "label",
  "email",
  "nationalId",
  "phone",
] as const;

export type BookingDuplicateProbeKind = (typeof BOOKING_DUPLICATE_PROBE_KINDS)[number];

/** Host domain error when partial uniques or probes reject a guest insert. */
export const BOOKING_GUEST_DUPLICATE_DOMAIN_ERROR = "BOOKING_GUEST_DUPLICATE" as const;

/**
 * PostgreSQL partial unique indexes on operator_registrations (active guests).
 * Predicate: status NOT IN ('cancelled', 'rejected') unless noted.
 */
export const BOOKING_ACTIVE_GUEST_PARTIAL_UNIQUES = [
  {
    name: "uq_operator_reg_active_email",
    keys: ["tenant_id", "tour_id", "lower(guest_email)"],
    note: "email present + active",
  },
  {
    name: "uq_operator_reg_active_self",
    keys: ["tenant_id", "tour_id", "submitted_by_user_id"],
    note: "active and registrantTarget is not other",
  },
  {
    name: "uq_operator_reg_active_label",
    keys: ["tenant_id", "tour_id", "lower(guest_label)"],
    note: "active",
  },
  {
    name: "uq_operator_reg_active_national_id",
    keys: ["tenant_id", "tour_id", "registration_intake.nationalId"],
    note: "nationalId present + active",
  },
] as const;

/** Maps each probe kind to its BookingPublicPort finder (documentation contract). */
export const BOOKING_DUPLICATE_PROBE_PORT_METHODS = {
  user: "findDuplicateByTourGuest",
  label: "findDuplicateByTourGuestLabel",
  email: "findDuplicateByTourEmail",
  nationalId: "findDuplicateByTourGuestNationalId",
  phone: "findDuplicateByTourGuestPhone",
} as const satisfies Record<BookingDuplicateProbeKind, string>;

export function isBookingDuplicateProbeKind(value: string): value is BookingDuplicateProbeKind {
  return (BOOKING_DUPLICATE_PROBE_KINDS as readonly string[]).includes(value);
}
