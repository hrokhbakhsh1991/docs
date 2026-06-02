import { Inject, Injectable } from "@nestjs/common";

import { ConfigService } from "../../../config/config.service";
import type { IPaymentGateway } from "./payment-gateway.interface";
import { createZibalPaymentGateway } from "./zibal-payment-gateway.impl";
import type { IdempotencyKeyStore } from "./payment-idempotency-key.store";
import { PAYMENT_GATEWAY_IDEMPOTENCY_STORE } from "./payment-idempotency-key.store";

/**
 * Zibal (Iran) payment request → returns a hosted checkout URL.
 * Prefer {@link PaymentGatewayFactory.forTenant} for tenant-scoped credentials.
 */
@Injectable()
export class ZibalPaymentGateway implements IPaymentGateway {
  readonly providerId = "zibal";

  constructor(
    @Inject(PAYMENT_GATEWAY_IDEMPOTENCY_STORE) private readonly idempotencyStore: IdempotencyKeyStore,
    private readonly config: ConfigService,
  ) {}

  async createPaymentIntent(
    input: Parameters<IPaymentGateway["createPaymentIntent"]>[0],
  ): ReturnType<IPaymentGateway["createPaymentIntent"]> {
    return createZibalPaymentGateway(
      this.idempotencyStore,
      this.config.getZibalMerchant(),
      this.config.getZibalCallbackUrl(),
    ).createPaymentIntent(input);
  }
}

export { createZibalPaymentGateway } from "./zibal-payment-gateway.impl";
