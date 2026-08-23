/**
 * DEC-CW-01 Option B — neutral member display semantics (wire vocabulary stays native).
 * Portal i18n maps semantic → localized label; persistence/API retain workspace strings.
 */
export type MemberRegistrationDisplayStatus =
  | "pending_review"
  | "accepted"
  | "waitlisted"
  | "rejected"
  | "cancelled";

export const MEMBER_REGISTRATION_DISPLAY_STATUSES: readonly MemberRegistrationDisplayStatus[] = [
  "pending_review",
  "accepted",
  "waitlisted",
  "rejected",
  "cancelled",
];

export function isMemberRegistrationDisplayStatus(
  value: string,
): value is MemberRegistrationDisplayStatus {
  return (MEMBER_REGISTRATION_DISPLAY_STATUSES as readonly string[]).includes(value);
}
