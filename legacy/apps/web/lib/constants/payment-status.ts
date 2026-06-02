import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

/**
 * Values accepted on `PATCH .../payment` (public DTO / OpenAPI subset).
 * Backend entity also has `Failed` and `Refunded`; transitions below mirror
 * `validatePaymentTransition` but options are filtered to this public set.
 */
const PUBLIC_PATCH_PAYMENT_STATUSES = new Set<RegistrationPaymentStatus>([
  "NotPaid",
  "Partial",
  "Paid",
]);

/**
 * Mirrors `validatePaymentTransition` next-status lists
 * (`apps/api/src/modules/registrations/registrations.service.ts`),
 * keyed by persisted payment status string (handles non-typed API values).
 */
const PAYMENT_STATUS_ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  NotPaid: ["Paid", "Failed"],
  Paid: ["Refunded"],
  Failed: ["NotPaid", "Paid"],
  Partial: [],
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

function filterToPublicPatchStatuses(
  values: readonly string[],
): RegistrationPaymentStatus[] {
  const out: RegistrationPaymentStatus[] = [];
  for (const v of values) {
    if (PUBLIC_PATCH_PAYMENT_STATUSES.has(v as RegistrationPaymentStatus)) {
      out.push(v as RegistrationPaymentStatus);
    }
  }
  return out;
}

/**
 * Payment `<Select>` options: effective + persisted + allowed next statuses
 * that are both allowed by the service transition matrix and valid on the public PATCH DTO.
 * Cancelled/Rejected registrations cannot receive payment updates per the same validator.
 */
export function paymentStatusSelectOptions(
  persistedPaymentStatus: RegistrationPaymentStatus | string,
  effectivePaymentStatus: RegistrationPaymentStatus | string,
  registrationStatus: RegistrationStatus,
): RegistrationPaymentStatus[] {
  const persisted = String(persistedPaymentStatus) as RegistrationPaymentStatus;
  const effective = String(effectivePaymentStatus) as RegistrationPaymentStatus;

  if (registrationStatus === "Cancelled" || registrationStatus === "Rejected") {
    return uniquePreservingOrder([effective, persisted]);
  }

  const rawNext = PAYMENT_STATUS_ALLOWED_TRANSITIONS[String(persisted)] ?? [];
  const allowed = filterToPublicPatchStatuses(rawNext);
  return uniquePreservingOrder([effective, persisted, ...allowed]);
}
