/**
 * Transition policy aligned with backend invariants:
 * - `apps/api/src/modules/registrations/registrations.service.ts`
 *   (`validateStatusTransition`, `validatePaymentTransition`)
 * - Waitlist FIFO: only the first row in an ordered waitlist array may convert (`index === 0`).
 *
 * UI must only offer values from `getAllowedRegistrationTransitions` /
 * `getAllowedPaymentTransitions` (plus the persisted current value where needed).
 */

import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

/** Persisted aggregate payment status (`registration.entity.ts` / `@repo/types`). */
export type PaymentStatus = RegistrationPaymentStatus;

/**
 * Allowed *next* registration statuses from `current` (excludes implicit same-state).
 * Mirrors `validateStatusTransition` in `RegistrationsService`.
 */
export const REGISTRATION_TRANSITIONS: Record<RegistrationStatus, RegistrationStatus[]> = {
  Pending: ["Accepted", "AcceptedPaid", "Rejected", "Cancelled"],
  Accepted: ["AcceptedPaid", "Rejected", "Cancelled", "NoShow"],
  AcceptedPaid: ["Rejected", "Cancelled", "Refunded"],
  Rejected: [],
  Cancelled: [],
  NoShow: [],
  Refunded: [],
};

/**
 * Allowed *next* payment statuses from `current` (excludes implicit same-state).
 * Mirrors `validatePaymentTransition` payment-status map (entity enum).
 * Callers must still block updates when registration is `Cancelled` or `Rejected`
 * (service rejects all payment transitions in that case).
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  NotPaid: ["Paid", "Failed"],
  Paid: ["Refunded"],
  Failed: ["NotPaid", "Paid"],
  Partial: [],
  Refunded: [],
};

/** `Completed` is not an API `RegistrationStatus`; treat as terminal for UI/product guards. */
export type RegistrationStatusOrCompleted = RegistrationStatus | "Completed";

export const TERMINAL_REGISTRATION_STATES: readonly RegistrationStatusOrCompleted[] = [
  "NoShow",
  "Rejected",
  "Cancelled",
  "Refunded",
  "Completed",
] as const;

export const TERMINAL_PAYMENT_STATES: readonly PaymentStatus[] = [
  "Refunded",
  "Partial",
] as const;

/** Only non-terminal outgoing targets (never includes illegal or same-state). */
export function getAllowedRegistrationTransitions(
  status: RegistrationStatus,
): readonly RegistrationStatus[] {
  if (isTerminalRegistrationState(status)) {
    return [];
  }
  return REGISTRATION_TRANSITIONS[status];
}

/** Only non-terminal outgoing targets for the persisted payment row. */
export function getAllowedPaymentTransitions(
  status: PaymentStatus,
): readonly PaymentStatus[] {
  if (isTerminalPaymentState(status)) {
    return [];
  }
  return PAYMENT_TRANSITIONS[status] ?? [];
}

export function isTerminalRegistrationState(
  status: RegistrationStatusOrCompleted,
): boolean {
  return (TERMINAL_REGISTRATION_STATES as readonly RegistrationStatusOrCompleted[]).includes(
    status,
  );
}

export function isTerminalPaymentState(status: PaymentStatus): boolean {
  return (TERMINAL_PAYMENT_STATES as readonly PaymentStatus[]).includes(status);
}

/**
 * FIFO UI rule: only the first item in a waitlist list ordered oldest-first may convert.
 * Backend enforces oldest by `created_at ASC` per tenant+tour; callers should pass a
 * similarly ordered array and use this for `index`.
 */
export function convertAllowed(index: number): boolean {
  return index === 0;
}
