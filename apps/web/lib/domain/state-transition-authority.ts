/**
 * Authoritative state-transition reference for workspace / registration flows.
 *
 * Sources (this repo):
 * - `apps/api/src/modules/registrations/registrations.service.ts`
 *   (`validateStatusTransition`, `validatePaymentTransition`, `validatePaymentAmountConsistency`,
 *   `convertWaitlistItem`, `getOldestWaitingWaitlistItemForUpdate`, `cancelWaitlistItem`)
 * - `apps/api/src/modules/registrations/registration.entity.ts` (enums)
 * - `apps/api/src/modules/registrations/waitlist-item.entity.ts` (`WaitlistItemStatus`)
 * - `apps/api/src/modules/tours/tours.service.ts` (`isAllowedLifecycleTransition`)
 * - `docs/10-product/requirements.md` (FR-43 FIFO, FR-51 payment labels)
 * - `docs/20-frontend/domain_model_alignment.md` (API naming / alignment)
 *
 * Note: `domain_model.md` and paths like `modules/booking/`, `shared/dto/`, `shared/enums/`
 * are not present in this monorepo; rules below mirror the Nest modules above.
 *
 * Error codes:
 * - Registration status: `STATE_TRANSITION_INVALID` (409) on illegal status moves.
 * - Payment status: `PAYMENT_STATUS_TRANSITION_INVALID` (409) on illegal payment moves
 *   or when registration is `Cancelled` / `Rejected`.
 * - Waitlist convert: `STATE_TRANSITION_INVALID` for non-Waiting or non-head item;
 *   `CAPACITY_FULL` when tour is full; duplicate active registration conflicts elsewhere.
 */

import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

// --- RegistrationStatus (PATCH .../status) ---------------------------------

/** Allowed targets from `current` (excluding implicit same-status no-op). */
export const REGISTRATION_STATUS_ALLOWED_TARGETS: Record<
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
} as const;

/** No outgoing transitions in `validateStatusTransition` (except identity). */
export const REGISTRATION_TERMINAL_STATUSES: readonly RegistrationStatus[] = [
  "Rejected",
  "Cancelled",
  "NoShow",
  "Refunded",
] as const;

export function isAllowedRegistrationStatusTransition(
  from: RegistrationStatus,
  to: RegistrationStatus,
): boolean {
  if (from === to) return true;
  const next = REGISTRATION_STATUS_ALLOWED_TARGETS[from];
  return (next as readonly RegistrationStatus[]).includes(to);
}

export function isIllegalRegistrationStatusTransition(
  from: RegistrationStatus,
  to: RegistrationStatus,
): boolean {
  return !isAllowedRegistrationStatusTransition(from, to);
}

// --- RegistrationPaymentStatus (service entity + PATCH public subset) ------

/**
 * Wire values used in `validatePaymentTransition` (entity enum).
 * Public `PATCH /registrations/:id/payment` DTO only accepts `NotPaid` | `Partial` | `Paid`
 * (`UpdateRegistrationPaymentDto`); `Failed` / `Refunded` exist on persisted rows.
 */
export type RegistrationPaymentWireStatus =
  | RegistrationPaymentStatus
  | "Failed"
  | "Refunded";

/** Allowed `next` given persisted `current` (excluding implicit same-status). */
export const PAYMENT_STATUS_ALLOWED_TARGETS: Record<
  RegistrationPaymentWireStatus,
  readonly RegistrationPaymentWireStatus[]
> = {
  NotPaid: ["Paid", "Failed"],
  Paid: ["Refunded"],
  Failed: ["NotPaid", "Paid"],
  Partial: [],
  Refunded: [],
} as const;

/** No outgoing payment transitions in the service map (except identity). */
export const PAYMENT_TERMINAL_WIRE_STATUSES: readonly RegistrationPaymentWireStatus[] = [
  "Refunded",
] as const;

/**
 * Payment updates are rejected outright when registration is terminal for payments
 * (`validatePaymentTransition` first guard).
 */
export const REGISTRATION_STATUSES_BLOCKING_PAYMENT_PATCH: readonly RegistrationStatus[] = [
  "Cancelled",
  "Rejected",
] as const;

export function isRegistrationBlockingPaymentPatch(
  registrationStatus: RegistrationStatus,
): boolean {
  return (REGISTRATION_STATUSES_BLOCKING_PAYMENT_PATCH as readonly RegistrationStatus[]).includes(
    registrationStatus,
  );
}

export function isAllowedPaymentStatusTransition(
  registrationStatus: RegistrationStatus,
  fromPayment: RegistrationPaymentWireStatus,
  toPayment: RegistrationPaymentWireStatus,
): boolean {
  if (isRegistrationBlockingPaymentPatch(registrationStatus)) return false;
  if (fromPayment === toPayment) return true;
  const next = PAYMENT_STATUS_ALLOWED_TARGETS[fromPayment] ?? [];
  return (next as readonly RegistrationPaymentWireStatus[]).includes(toPayment);
}

/** Extra invariants on `paidAmount` with `nextPaymentStatus` (same error code family). */
export const PAYMENT_AMOUNT_RULES = {
  notPaidWithPositivePaidAmountForbidden: true,
  partialRequiresPositivePaidAmountWhenProvided: true,
} as const;

// --- WaitlistItemStatus → Registration (convert) ---------------------------

export const WAITLIST_ITEM_STATUS = {
  Waiting: "Waiting",
  Converted: "Converted",
  Cancelled: "Cancelled",
} as const;

export type WaitlistItemStatusWire =
  (typeof WAITLIST_ITEM_STATUS)[keyof typeof WAITLIST_ITEM_STATUS];

/**
 * FIFO rule (backend): only the row with minimum `created_at` among
 * `(tenant_id, tour_id)` rows with `status = 'Waiting'`, ordered `ASC`, may convert.
 * Implemented in `getOldestWaitingWaitlistItemForUpdate` + id equality check in
 * `convertWaitlistItem` → `STATE_TRANSITION_INVALID` if not head.
 *
 * Product: `FR-43` — waitlist ordering FIFO for MVP.
 */
export const WAITLIST_CONVERT_ONLY_OLDEST_WAITING_RULE =
  "Only the oldest Waiting waitlist row (by created_at ASC, per tenant+tour) may be converted." as const;

/** Effect of successful convert: new registration `Accepted` + `NotPaid` payment. */
export const WAITLIST_CONVERT_REGISTRATION_OUTCOME = {
  registrationStatus: "Accepted",
  paymentStatus: "NotPaid",
} as const;

/** Allowed waitlist status moves from service (excluding identity). */
export const WAITLIST_STATUS_ALLOWED_TARGETS: Record<
  WaitlistItemStatusWire,
  readonly WaitlistItemStatusWire[]
> = {
  Waiting: ["Converted", "Cancelled"],
  Converted: [],
  Cancelled: [],
} as const;

export const WAITLIST_TERMINAL_STATUSES: readonly WaitlistItemStatusWire[] = [
  "Converted",
  "Cancelled",
] as const;

// --- TourLifecycleStatus (PATCH tour — separate domain) ---------------------

export type TourLifecycleWireStatus = "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";

export const TOUR_LIFECYCLE_ALLOWED_TARGETS: Record<
  TourLifecycleWireStatus,
  readonly TourLifecycleWireStatus[]
> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
} as const;

export const TOUR_TERMINAL_LIFECYCLE_STATUSES: readonly TourLifecycleWireStatus[] = [
  "CLOSED",
  "CANCELLED",
] as const;

export function isAllowedTourLifecycleTransition(
  from: TourLifecycleWireStatus,
  to: TourLifecycleWireStatus,
): boolean {
  if (from === to) return true;
  return (TOUR_LIFECYCLE_ALLOWED_TARGETS[from] as readonly TourLifecycleWireStatus[]).includes(
    to,
  );
}

// --- Single TS-friendly “table” (edges) for tooling / tests ------------------

/** Directed edges `(from, to)` where `from !== to` and backend allows the move. */
export const ALL_AUTHORIZED_NON_IDENTITY_EDGES: ReadonlyArray<{
  domain:
    | "registrationStatus"
    | "paymentWireStatus"
    | "waitlistItemStatus"
    | "tourLifecycleStatus";
  from: string;
  to: string;
}> = [
  ...(
    Object.entries(REGISTRATION_STATUS_ALLOWED_TARGETS) as [
      RegistrationStatus,
      readonly RegistrationStatus[],
    ][]
  ).flatMap(([from, targets]) =>
    targets.map((to) => ({ domain: "registrationStatus" as const, from, to })),
  ),
  ...(
    Object.entries(PAYMENT_STATUS_ALLOWED_TARGETS) as [
      RegistrationPaymentWireStatus,
      readonly RegistrationPaymentWireStatus[],
    ][]
  ).flatMap(([from, targets]) =>
    targets.map((to) => ({ domain: "paymentWireStatus" as const, from, to })),
  ),
  ...(
    Object.entries(WAITLIST_STATUS_ALLOWED_TARGETS) as [
      WaitlistItemStatusWire,
      readonly WaitlistItemStatusWire[],
    ][]
  ).flatMap(([from, targets]) =>
    targets.map((to) => ({ domain: "waitlistItemStatus" as const, from, to })),
  ),
  ...(
    Object.entries(TOUR_LIFECYCLE_ALLOWED_TARGETS) as [
      TourLifecycleWireStatus,
      readonly TourLifecycleWireStatus[],
    ][]
  ).flatMap(([from, targets]) =>
    targets.map((to) => ({ domain: "tourLifecycleStatus" as const, from, to })),
  ),
] as const;
