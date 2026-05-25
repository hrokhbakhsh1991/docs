import { PaymentAttemptStatus } from "./payment-attempt-status";
import { canPaymentAttemptTransition } from "./payment-transition-rules";

export class PaymentTransitionForbiddenError extends Error {
  readonly code = "PAYMENT_TRANSITION_FORBIDDEN";

  constructor(
    public readonly from: PaymentAttemptStatus,
    public readonly to: PaymentAttemptStatus,
  ) {
    super(`Illegal payment attempt transition: ${from} → ${to}`);
    this.name = "PaymentTransitionForbiddenError";
  }
}

/**
 * Throws {@link PaymentTransitionForbiddenError} when `from → to` is not allow-listed
 * for in-memory {@link PaymentAttempt} status (same-state transitions are allowed).
 */
export function assertValidPaymentAttemptTransition(
  from: PaymentAttemptStatus,
  to: PaymentAttemptStatus,
): void {
  if (!canPaymentAttemptTransition(from, to)) {
    throw new PaymentTransitionForbiddenError(from, to);
  }
}

/** @deprecated Use {@link assertValidPaymentAttemptTransition}. */
export const assertValidPaymentTransition = assertValidPaymentAttemptTransition;
