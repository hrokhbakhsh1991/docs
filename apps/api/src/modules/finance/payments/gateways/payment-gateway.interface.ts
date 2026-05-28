import type { PaymentIntent } from "./payment-intent";
import type { PaymentResult, RefundRequest, RefundResult } from "./payment-result";

/**
 * Vendor-neutral payment gateway port (finance bounded context).
 *
 * TODO: `StripePaymentGateway` adapter — real API calls + idempotent client usage.
 * TODO: `ZibalPaymentGateway` adapter — IRR settlement + local compliance hooks.
 * TODO: `reconciliation worker` — compare PSP settlement files vs `payments` / ledger projections.
 *
 * **Do not** bind real credentials in this repository; adapters load secrets from env/KMS at runtime.
 */
export interface IPaymentGateway {
  readonly providerId: string;

  createPaymentIntent(_intent: PaymentIntent): Promise<PaymentResult>;

  /** Optional — not all PSPs expose synchronous refund on same port. */
  refundPayment?(_request: RefundRequest): Promise<RefundResult>;
}
