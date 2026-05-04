import type { RegistrationStatus } from "@repo/types";

/**
 * Mirrors `RegistrationsService.validateStatusTransition` allowed targets
 * (`apps/api/src/modules/registrations/registrations.service.ts`).
 * Same-status is always allowed by the backend without listing it here.
 */
export const REGISTRATION_STATUS_ALLOWED_TRANSITIONS: Record<
  RegistrationStatus,
  readonly RegistrationStatus[]
> = {
  Pending: ["Accepted", "AcceptedPaid", "Rejected", "Cancelled"],
  Accepted: ["AcceptedPaid", "Rejected", "Cancelled", "NoShow"],
  AcceptedPaid: ["Rejected", "Cancelled", "Refunded"],
  Rejected: [],
  Cancelled: [],
  NoShow: [],
  Refunded: [],
};

function uniquePreservingOrder<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of items) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

/** Values shown in `<Select>`: current effective value, persisted row, then allowed next statuses. */
export function registrationStatusSelectOptions(
  persistedStatus: RegistrationStatus,
  effectiveStatus: RegistrationStatus,
): RegistrationStatus[] {
  const allowed = REGISTRATION_STATUS_ALLOWED_TRANSITIONS[persistedStatus] ?? [];
  return uniquePreservingOrder([effectiveStatus, persistedStatus, ...allowed]);
}
