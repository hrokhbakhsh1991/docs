import type {
  CreatePaymentIntentGatewayInput,
  PaymentIntentGatewayResult,
} from "../payment-gateway.types";

export const PAYMENT_GATEWAY_FACTORY_PORT = Symbol("PAYMENT_GATEWAY_FACTORY_PORT");

/**
 * Vendor-neutral payment port. Implementations must require `CreatePaymentIntentGatewayInput.idempotencyKey`
 * and delegate dedupe to `IdempotencyKeyStore` (or equivalent persistence).
 */
export interface IPaymentGateway {
  readonly providerId: string;

  createPaymentIntent(_input: CreatePaymentIntentGatewayInput): Promise<PaymentIntentGatewayResult>;
}

/** Resolves a tenant-scoped gateway by provider slug (`mock`, `stripe`, `zibal`, …). */
export interface PaymentGatewayFactoryPort {
  forTenant(tenantId: string, paymentProvider: string): Promise<IPaymentGateway>;
}
