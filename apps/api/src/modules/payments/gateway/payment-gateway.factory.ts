import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { ConfigService } from "../../../config/config.service";
import type { IPaymentGateway, PaymentGatewayFactoryPort } from "../domain/ports/payment-gateway-factory.port";
import { TenantPaymentConfigService } from "../services/tenant-payment-config.service";
import { MockPaymentGateway } from "./mock-payment-gateway";
import type { IdempotencyKeyStore } from "./payment-idempotency-key.store";
import { PAYMENT_GATEWAY_IDEMPOTENCY_STORE } from "./payment-idempotency-key.store";
import { StripeLikePaymentGatewayPlaceholder } from "./stripe-like-payment-gateway.placeholder";
import { createStripePaymentGateway } from "./stripe-payment-gateway.impl";
import { createZibalPaymentGateway } from "./zibal-payment-gateway.impl";

/**
 * Resolves a gateway implementation by tenant + provider slug (`mock`, `stripe`, `zibal`, …).
 * Tenant rows in `tenant_payment_configs` override platform env credentials per workspace.
 */
@Injectable()
export class PaymentGatewayFactory implements PaymentGatewayFactoryPort {
  constructor(
    private readonly mockGateway: MockPaymentGateway,
    private readonly stripePlaceholder: StripeLikePaymentGatewayPlaceholder,
    @Inject(PAYMENT_GATEWAY_IDEMPOTENCY_STORE)
    private readonly idempotencyStore: IdempotencyKeyStore,
    private readonly tenantPaymentConfigService: TenantPaymentConfigService,
    private readonly config: ConfigService,
  ) {}

  async forTenant(tenantId: string, paymentProvider: string): Promise<IPaymentGateway> {
    const normalizedTenantId = tenantId.trim().toLowerCase();
    if (!normalizedTenantId) {
      throw new BadRequestException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "tenantId is required to resolve payment gateway credentials",
        },
      });
    }

    const p = paymentProvider.trim().toLowerCase();
    if (
      this.config.getNodeEnv() === "production" &&
      (p === "mock_provider" || p === "mock" || p === "")
    ) {
      throw new BadRequestException({
        error: {
          code: "PAYMENT_PROVIDER_NOT_ALLOWED",
          message: "Mock payment provider is disabled in production",
        },
      });
    }

    const resolved = await this.tenantPaymentConfigService.resolveForProvider(
      normalizedTenantId,
      p,
    );

    if (p === "stripe") {
      const secretKey = resolved.provider === "stripe" ? resolved.stripe.secretKey : "";
      return secretKey.length > 0
        ? createStripePaymentGateway(this.idempotencyStore, secretKey)
        : this.stripePlaceholder;
    }

    if (p === "zibal") {
      const zibal =
        resolved.provider === "zibal"
          ? resolved.zibal
          : { merchantId: "", callbackUrl: "" };
      if (!zibal.merchantId || !zibal.callbackUrl) {
        throw new BadRequestException({
          error: {
            code: "PAYMENT_PROVIDER_NOT_CONFIGURED",
            message: "Zibal requires merchant id and callback URL (tenant config or env fallback)",
          },
        });
      }
      return createZibalPaymentGateway(
        this.idempotencyStore,
        zibal.merchantId,
        zibal.callbackUrl,
      );
    }

    return this.mockGateway;
  }
}
