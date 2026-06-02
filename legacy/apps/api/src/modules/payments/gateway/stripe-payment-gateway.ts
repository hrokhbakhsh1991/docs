import { Inject, Injectable } from "@nestjs/common";

import { ConfigService } from "../../../config/config.service";
import type { IPaymentGateway } from "./payment-gateway.interface";
import { createStripePaymentGateway } from "./stripe-payment-gateway.impl";
import type { IdempotencyKeyStore } from "./payment-idempotency-key.store";
import { PAYMENT_GATEWAY_IDEMPOTENCY_STORE } from "./payment-idempotency-key.store";

/**
 * Live Stripe {@link IPaymentGateway} using the official Node SDK.
 * Prefer {@link PaymentGatewayFactory.forTenant} for tenant-scoped credentials.
 */
@Injectable()
export class StripePaymentGateway implements IPaymentGateway {
  readonly providerId = "stripe";

  constructor(
    @Inject(PAYMENT_GATEWAY_IDEMPOTENCY_STORE) private readonly idempotencyStore: IdempotencyKeyStore,
    private readonly config: ConfigService,
  ) {}

  async createPaymentIntent(
    input: Parameters<IPaymentGateway["createPaymentIntent"]>[0],
  ): ReturnType<IPaymentGateway["createPaymentIntent"]> {
    const secret = this.config.getStripeSecretKey();
    return createStripePaymentGateway(this.idempotencyStore, secret).createPaymentIntent(input);
  }
}

export { createStripePaymentGateway } from "./stripe-payment-gateway.impl";
