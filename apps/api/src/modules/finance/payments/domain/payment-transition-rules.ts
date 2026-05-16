import { PaymentStatus } from "./payment-status";

/**
 * Directed edges `(from, to)` for payment attempts. Pairs not listed are **illegal** for controlled transitions.
 *
 * Lifecycle (happy path): `initiated` → `pending` → `authorized` → `captured` → `refunded`.
 * Failure / void paths end in `failed`; `refunded` is terminal from `captured`.
 *
 * TODO: **Retry policies** — whether `failed` may spawn a new attempt vs same row (idempotency rules).
 * TODO: **Async capture** — timed `authorized` → `captured` / auto-void rules.
 * TODO: **Dispute handling** — chargeback signals vs ledger (may extend this graph).
 */
export const PAYMENT_ALLOWED_TRANSITIONS: ReadonlyArray<readonly [PaymentStatus, PaymentStatus]> = [
  [PaymentStatus.INITIATED, PaymentStatus.PENDING],
  [PaymentStatus.INITIATED, PaymentStatus.FAILED],
  [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED],
  [PaymentStatus.PENDING, PaymentStatus.FAILED],
  [PaymentStatus.AUTHORIZED, PaymentStatus.CAPTURED],
  [PaymentStatus.AUTHORIZED, PaymentStatus.FAILED],
  [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED]
];

const allowedKey = (from: PaymentStatus, to: PaymentStatus): string => `${from}→${to}`;

const ALLOWED_SET: ReadonlySet<string> = new Set(
  PAYMENT_ALLOWED_TRANSITIONS.map(([from, to]) => allowedKey(from, to))
);

export const PaymentTransitionRules = {
  allowedEdges: PAYMENT_ALLOWED_TRANSITIONS,

  canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    if (from === to) {
      return true;
    }
    return ALLOWED_SET.has(allowedKey(from, to));
  }
} as const;

export function canPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return PaymentTransitionRules.canTransition(from, to);
}
