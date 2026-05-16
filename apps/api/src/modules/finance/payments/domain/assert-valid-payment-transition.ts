import { PaymentStatus } from "./payment-status";
import { canPaymentTransition } from "./payment-transition-rules";

export class PaymentTransitionForbiddenError extends Error {
  readonly code = "PAYMENT_TRANSITION_FORBIDDEN";

  constructor(
    public readonly from: PaymentStatus,
    public readonly to: PaymentStatus
  ) {
    super(`Illegal payment transition: ${from} → ${to}`);
    this.name = "PaymentTransitionForbiddenError";
  }
}

/**
 * Throws {@link PaymentTransitionForbiddenError} when `from → to` is not allow-listed
 * (same-state transitions are no-ops and allowed).
 *
 * **Call sites:** guard before mutating `PaymentAttempt.status` once persistence exists.
 */
export function assertValidPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canPaymentTransition(from, to)) {
    throw new PaymentTransitionForbiddenError(from, to);
  }
}
