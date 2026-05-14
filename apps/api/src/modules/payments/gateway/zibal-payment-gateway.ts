import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "../../../config/config.service";
import type { IPaymentGateway } from "./payment-gateway.interface";
import type { CreatePaymentIntentGatewayInput, PaymentIntentGatewayResult } from "./payment-gateway.types";
import type { IdempotencyKeyStore } from "./payment-idempotency-key.store";

type ZibalRequestResponse = {
  message: string;
  result: number;
  trackId?: number;
};

const ZIBAL_REQUEST_URL = "https://gateway.zibal.ir/v1/request";

/**
 * Zibal (Iran) payment request → returns a hosted checkout URL.
 * Amount must be in **IRR** (Rials) as an integer, per Zibal API.
 */
@Injectable()
export class ZibalPaymentGateway implements IPaymentGateway {
  readonly providerId = "zibal";

  constructor(
    private readonly idempotencyStore: IdempotencyKeyStore,
    private readonly config: ConfigService
  ) {}

  async createPaymentIntent(input: CreatePaymentIntentGatewayInput): Promise<PaymentIntentGatewayResult> {
    const merchant = this.config.getZibalMerchant();
    const callbackUrl = this.config.getZibalCallbackUrl();
    if (!merchant) {
      throw new InternalServerErrorException({
        error: {
          code: "ZIBAL_NOT_CONFIGURED",
          message: "Zibal merchant id is not configured"
        }
      });
    }
    if (!callbackUrl) {
      throw new InternalServerErrorException({
        error: {
          code: "ZIBAL_CALLBACK_NOT_CONFIGURED",
          message: "ZIBAL_CALLBACK_URL is not configured"
        }
      });
    }
    if (input.currency.trim().toUpperCase() !== "IRR") {
      throw new BadRequestException({
        error: {
          code: "PAYMENT_GATEWAY_CURRENCY_UNSUPPORTED",
          message: "Zibal only supports IRR"
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
        const amount = Math.round(Number(input.amount));
        if (!Number.isFinite(amount) || amount < 1) {
          throw new BadRequestException({
            error: {
              code: "VALIDATION_FIELD_FORMAT_INVALID",
              message: "Amount must be a positive integer for Zibal"
            }
          });
        }
        const res = await fetch(ZIBAL_REQUEST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchant,
            amount,
            callbackUrl,
            description: `Booking ${input.registrationId}`,
            orderId: input.registrationId.replace(/-/g, "").slice(0, 32),
            mobile: undefined
          })
        });
        if (!res.ok) {
          throw new InternalServerErrorException({
            error: {
              code: "ZIBAL_HTTP_ERROR",
              message: `Zibal request failed with HTTP ${res.status}`
            }
          });
        }
        const body = (await res.json()) as ZibalRequestResponse;
        if (body.result !== 100 || body.trackId === undefined) {
          throw new InternalServerErrorException({
            error: {
              code: "ZIBAL_REQUEST_REJECTED",
              message: body.message || `Zibal result code ${body.result}`
            }
          });
        }
        const trackId = String(body.trackId);
        const checkoutUrl = `https://gateway.zibal.ir/start/${trackId}`;
        return {
          provider: this.providerId,
          providerPaymentId: trackId,
          checkoutUrl,
          status: "requires_payment_method" as const
        } satisfies PaymentIntentGatewayResult;
      }
    );
    return value;
  }
}
