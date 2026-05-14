import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import Stripe from "stripe";
import { ConfigService } from "../../../config/config.service";
import type { IPaymentGateway } from "./payment-gateway.interface";
import type { CreatePaymentIntentGatewayInput, PaymentIntentGatewayResult } from "./payment-gateway.types";
import type { IdempotencyKeyStore } from "./payment-idempotency-key.store";
import { PAYMENT_GATEWAY_IDEMPOTENCY_STORE } from "./payment-idempotency-key.store";

function mapStripePaymentIntentStatus(status: string): PaymentIntentGatewayResult["status"] {
  switch (status) {
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
    case "requires_capture":
      return "requires_payment_method";
    case "processing":
      return "processing";
    case "succeeded":
      return "succeeded";
    case "canceled":
      return "canceled";
    default:
      return "requires_payment_method";
  }
}

/**
 * Live Stripe {@link IPaymentGateway} using the official Node SDK.
 * Enabled when {@link ConfigService.getStripeSecretKey} is non-empty; otherwise use the placeholder adapter.
 */
@Injectable()
export class StripePaymentGateway implements IPaymentGateway {
  readonly providerId = "stripe";

  constructor(
    @Inject(PAYMENT_GATEWAY_IDEMPOTENCY_STORE) private readonly idempotencyStore: IdempotencyKeyStore,
    private readonly config: ConfigService
  ) {}

  async createPaymentIntent(input: CreatePaymentIntentGatewayInput): Promise<PaymentIntentGatewayResult> {
    const secret = this.config.getStripeSecretKey();
    if (!secret) {
      throw new InternalServerErrorException({
        error: {
          code: "STRIPE_NOT_CONFIGURED",
          message: "Stripe secret key is not configured"
        }
      });
    }

    const { value } = await this.idempotencyStore.runOnce(
      {
        tenantId: input.tenantId,
        operation: `${this.providerId}:create_payment_intent`,
        idempotencyKey: input.idempotencyKey
      },
      async () => {
        const stripe = new Stripe(secret);
        const metadata: Record<string, string> = {
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          ...(input.metadata ?? {})
        };
        const pi = await stripe.paymentIntents.create(
          {
            amount: input.amount,
            currency: input.currency.trim().toLowerCase(),
            metadata,
            automatic_payment_methods: { enabled: true }
          },
          { idempotencyKey: input.idempotencyKey.slice(0, 255) }
        );
        return {
          provider: this.providerId,
          providerPaymentId: pi.id,
          clientSecret: pi.client_secret ?? undefined,
          status: mapStripePaymentIntentStatus(pi.status)
        } satisfies PaymentIntentGatewayResult;
      }
    );
    return value;
  }
}
