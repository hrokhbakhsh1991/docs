import { InternalServerErrorException } from "@nestjs/common";
import Stripe from "stripe";

import type { IPaymentGateway } from "./payment-gateway.interface";
import type { CreatePaymentIntentGatewayInput, PaymentIntentGatewayResult } from "./payment-gateway.types";
import type { IdempotencyKeyStore } from "./payment-idempotency-key.store";

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

async function createStripePaymentIntentWithSecret(
  idempotencyStore: IdempotencyKeyStore,
  secretKey: string,
  input: CreatePaymentIntentGatewayInput,
): Promise<PaymentIntentGatewayResult> {
  if (!secretKey) {
    throw new InternalServerErrorException({
      error: {
        code: "STRIPE_NOT_CONFIGURED",
        message: "Stripe secret key is not configured",
      },
    });
  }

  const providerId = "stripe";
  const { value } = await idempotencyStore.runOnce(
    {
      tenantId: input.tenantId,
      operation: `${providerId}:create_payment_intent`,
      idempotencyKey: input.idempotencyKey,
    },
    async () => {
      const stripe = new Stripe(secretKey);
      const metadata: Record<string, string> = {
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        ...(input.metadata ?? {}),
      };
      const pi = await stripe.paymentIntents.create(
        {
          amount: input.amount,
          currency: input.currency.trim().toLowerCase(),
          metadata,
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey: input.idempotencyKey.slice(0, 255) },
      );
      return {
        provider: providerId,
        providerPaymentId: pi.id,
        clientSecret: pi.client_secret ?? undefined,
        status: mapStripePaymentIntentStatus(pi.status),
      } satisfies PaymentIntentGatewayResult;
    },
  );
  return value;
}

/** Tenant-scoped Stripe adapter using an explicit secret key (not global env). */
export function createStripePaymentGateway(
  idempotencyStore: IdempotencyKeyStore,
  secretKey: string,
): IPaymentGateway {
  return {
    providerId: "stripe",
    createPaymentIntent: (input) =>
      createStripePaymentIntentWithSecret(idempotencyStore, secretKey, input),
  };
}
