import type { CreatePaymentIntentGatewayInput, PaymentIntentGatewayResult } from "./payment-gateway.types";

/**
 * Vendor-neutral payment port. Implementations must require `CreatePaymentIntentGatewayInput.idempotencyKey`
 * and delegate dedupe to `IdempotencyKeyStore` (or equivalent persistence).
 */
export interface IPaymentGateway {
  readonly providerId: string;

  createPaymentIntent(_input: CreatePaymentIntentGatewayInput): Promise<PaymentIntentGatewayResult>;
}
