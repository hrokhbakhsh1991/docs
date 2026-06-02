import { Inject, Injectable } from "@nestjs/common";
import type { IPaymentGateway } from "./payment-gateway.interface";
import type { CreatePaymentIntentGatewayInput, PaymentIntentGatewayResult } from "./payment-gateway.types";
import type { IdempotencyKeyStore } from "./payment-idempotency-key.store";
import { PAYMENT_GATEWAY_IDEMPOTENCY_STORE } from "./payment-idempotency-key.store";

/**
 * Stripe-shaped adapter **without** SDK/network calls — safe placeholder for wiring and tests.
 * Swap for a real `stripe` implementation behind {@link IPaymentGateway} when credentials exist.
 */
@Injectable()
export class StripeLikePaymentGatewayPlaceholder implements IPaymentGateway {
  readonly providerId = "stripe";

  constructor(
    @Inject(PAYMENT_GATEWAY_IDEMPOTENCY_STORE) private readonly idempotencyStore: IdempotencyKeyStore
  ) {}

  async createPaymentIntent(input: CreatePaymentIntentGatewayInput): Promise<PaymentIntentGatewayResult> {
    const { value } = await this.idempotencyStore.runOnce(
      {
        tenantId: input.tenantId,
        operation: `${this.providerId}:create_payment_intent`,
        idempotencyKey: input.idempotencyKey
      },
      async () => {
        const suffix = input.registrationId.replace(/-/g, "").slice(0, 12);
        return {
          provider: this.providerId,
          providerPaymentId: `pi_placeholder_${suffix}`,
          clientSecret: `pi_placeholder_${suffix}_secret_placeholder`,
          status: "requires_payment_method" as const
        } satisfies PaymentIntentGatewayResult;
      }
    );
    return value;
  }
}
