/**
 * @deprecated Import {@link PaymentStatus}, {@link PAYMENT_STATUS_TRANSITIONS}, and
 * {@link isAllowedPaymentStatusTransition} from `@repo/shared-contracts` for persisted payments.
 *
 * This file re-exports the canonical contract and keeps {@link PaymentAttemptStatus} for the
 * separate in-memory attempt aggregate (`PaymentAttempt`).
 */
export {
  allowedPaymentStatusNextStates,
  isAllowedPaymentStatusTransition,
  PAYMENT_STATUS_TRANSITION_EDGES,
  PAYMENT_STATUS_TRANSITIONS,
  PAYMENT_STATUS_VALUES,
  PaymentStatus,
  PaymentStatusSchema,
  type PaymentStatus as PaymentStatusValue,
} from "@repo/shared-contracts";

export { PaymentAttemptStatus } from "./payment-attempt-status";
