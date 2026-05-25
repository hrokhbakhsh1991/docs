import { PaymentAttemptStatus } from "./payment-attempt-status";

/**
 * Directed edges for in-memory {@link PaymentAttempt} rows (not `payments.status`).
 * Persisted payment FSM: `@repo/shared-contracts` → {@link PAYMENT_STATUS_TRANSITIONS}.
 */
export const PAYMENT_ATTEMPT_ALLOWED_TRANSITIONS: ReadonlyArray<
  readonly [PaymentAttemptStatus, PaymentAttemptStatus]
> = [
  [PaymentAttemptStatus.INITIATED, PaymentAttemptStatus.PENDING],
  [PaymentAttemptStatus.INITIATED, PaymentAttemptStatus.FAILED],
  [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.AUTHORIZED],
  [PaymentAttemptStatus.PENDING, PaymentAttemptStatus.FAILED],
  [PaymentAttemptStatus.AUTHORIZED, PaymentAttemptStatus.CAPTURED],
  [PaymentAttemptStatus.AUTHORIZED, PaymentAttemptStatus.FAILED],
  [PaymentAttemptStatus.CAPTURED, PaymentAttemptStatus.REFUNDED],
];

const allowedKey = (from: PaymentAttemptStatus, to: PaymentAttemptStatus): string =>
  `${from}→${to}`;

const ALLOWED_SET: ReadonlySet<string> = new Set(
  PAYMENT_ATTEMPT_ALLOWED_TRANSITIONS.map(([from, to]) => allowedKey(from, to)),
);

export const PaymentAttemptTransitionRules = {
  allowedEdges: PAYMENT_ATTEMPT_ALLOWED_TRANSITIONS,

  canTransition(from: PaymentAttemptStatus, to: PaymentAttemptStatus): boolean {
    if (from === to) {
      return true;
    }
    return ALLOWED_SET.has(allowedKey(from, to));
  },
} as const;

export function canPaymentAttemptTransition(
  from: PaymentAttemptStatus,
  to: PaymentAttemptStatus,
): boolean {
  return PaymentAttemptTransitionRules.canTransition(from, to);
}

/** @deprecated Use {@link canPaymentAttemptTransition} — name collided with persisted payment status. */
export const canPaymentTransition = canPaymentAttemptTransition;
