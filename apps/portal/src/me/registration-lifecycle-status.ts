export type RegistrationLifecycleStatus =
  | "pending"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "cancelled";

const REGISTRATION_LIFECYCLE_STATUSES: readonly RegistrationLifecycleStatus[] = [
  "pending",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
];

/** Narrow BFF/wire status; unknown → null (caller fail-closes). Shared server+client. */
export function parseRegistrationLifecycleStatus(
  value: string
): RegistrationLifecycleStatus | null {
  return (REGISTRATION_LIFECYCLE_STATUSES as readonly string[]).includes(value)
    ? (value as RegistrationLifecycleStatus)
    : null;
}
