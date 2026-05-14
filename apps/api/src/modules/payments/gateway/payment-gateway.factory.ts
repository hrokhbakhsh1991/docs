import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "../../../config/config.service";
import type { IPaymentGateway } from "./payment-gateway.interface";
import { MockPaymentGateway } from "./mock-payment-gateway";
import { StripeLikePaymentGatewayPlaceholder } from "./stripe-like-payment-gateway.placeholder";
import { StripePaymentGateway } from "./stripe-payment-gateway";
import { ZibalPaymentGateway } from "./zibal-payment-gateway";

/**
 * Resolves a gateway implementation by provider slug (`mock`, `stripe`, `zibal`, …).
 */
@Injectable()
export class PaymentGatewayFactory {
  constructor(
    private readonly mockGateway: MockPaymentGateway,
    private readonly stripePlaceholder: StripeLikePaymentGatewayPlaceholder,
    private readonly stripeLive: StripePaymentGateway,
    private readonly zibalGateway: ZibalPaymentGateway,
    private readonly config: ConfigService
  ) {}

  forProvider(paymentProvider: string): IPaymentGateway {
    const p = paymentProvider.trim().toLowerCase();
    if (p === "stripe") {
      return this.config.getStripeSecretKey().length > 0 ? this.stripeLive : this.stripePlaceholder;
    }
    if (p === "zibal") {
      if (!this.config.getZibalMerchant() || !this.config.getZibalCallbackUrl()) {
        throw new BadRequestException({
          error: {
            code: "PAYMENT_PROVIDER_NOT_CONFIGURED",
            message: "Zibal requires ZIBAL_MERCHANT and ZIBAL_CALLBACK_URL"
          }
        });
      }
      return this.zibalGateway;
    }
    return this.mockGateway;
  }
}
